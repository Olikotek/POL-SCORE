// src/useStore.ts
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Course, Flight, Hole, Player, Round, Store, Tournament } from '@/types';

async function fetchStore(activeTournamentId?: string | null): Promise<{
  store: Store;
  tournaments: Tournament[];
  activeTournament: Tournament | null;
  leaguePoints: any[];
  registrations: any[];
  logoUrl: string | null;
}> {
  // 1. Turnieje, ustawienia i rejestracje
  const [tournamentsRes, settingsRes, registrationsRes] = await Promise.all([
    supabase.from('tournaments').select('*').order('date', { ascending: false }),
    supabase.from('tournament_settings').select('*').maybeSingle(),
    supabase.from('tournament_registrations').select('*'),
  ]);

  const tournaments: Tournament[] = (tournamentsRes.data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    courseName: t.course_name,
    date: t.date,
    isLeague: t.is_league,
    isPolishOpen: t.is_polish_open,
    status: t.status,
    round1CourseId: t.round1_course_id,
    round2CourseId: t.round2_course_id,
    round1Approved: t.round1_approved,
    round2Started: t.round2_started,
  }));

  let activeTournament: Tournament | null = null;
  if (tournaments.length > 0) {
    activeTournament =
      tournaments.find((t) => t.id === activeTournamentId) ||
      tournaments.find((t) => t.status === 'active') ||
      tournaments[0];
  }

  // 2. Budujemy zapytania z filtrem turnieju
  let r1Query = supabase.from('scores').select('*').eq('round', 1).limit(1000);
  let r2Query = supabase.from('scores').select('*').eq('round', 2).limit(1000);
  let flightsQuery = supabase.from('flights').select('*').order('name').limit(1000);

  if (activeTournament?.id) {
    r1Query = r1Query.eq('tournament_id', activeTournament.id);
    r2Query = r2Query.eq('tournament_id', activeTournament.id);
    flightsQuery = flightsQuery.eq('tournament_id', activeTournament.id);
  }

  // 3. Pobieramy R1 (972 wiersze) i R2 (918 wierszy) w dwóch niezależnych żądaniach
  const [
    coursesRes,
    courseHolesRes,
    playersRes,
    flightsRes,
    flightPlayersRes,
    scoresR1Res,
    scoresR2Res,
    leaguePointsRes,
  ] = await Promise.all([
    supabase.from('courses').select('*').order('name'),
    supabase.from('course_holes').select('*').order('course_id, number'),
    supabase.from('players').select('*').order('name').limit(3000),
    flightsQuery,
    supabase.from('flight_players').select('*').limit(3000),
    r1Query,
    r2Query,
    supabase.from('league_points').select('*'),
  ]);

  const firstError =
    coursesRes.error ||
    courseHolesRes.error ||
    playersRes.error ||
    flightsRes.error ||
    flightPlayersRes.error ||
    scoresR1Res.error ||
    scoresR2Res.error ||
    settingsRes.error ||
    tournamentsRes.error ||
    leaguePointsRes.error ||
    registrationsRes.error;

  if (firstError) throw firstError;

  // Łączymy R1 i R2 w jedną tablicę
  const scoresRows = [...(scoresR1Res.data ?? []), ...(scoresR2Res.data ?? [])];

  const courses: Course[] = (coursesRes.data ?? []).map((c) => ({ id: c.id, name: c.name }));
  const courseHoles = courseHolesRes.data ?? [];
  const settings = settingsRes.data;

  const round1CourseId = activeTournament?.round1CourseId ?? settings?.round1_course_id ?? null;
  const round2CourseId = activeTournament?.round2CourseId ?? settings?.round2_course_id ?? round1CourseId;
  const round1Approved = activeTournament ? activeTournament.round1Approved : (settings?.round1_approved ?? false);
  const round2Started = activeTournament ? activeTournament.round2Started : (settings?.round2_started ?? false);
  const tournamentName = activeTournament ? activeTournament.name : (settings?.tournament_name ?? 'Mistrzostwa Polski');

  function holesForCourse(courseId: string | null): Hole[] {
    if (!courseId) return [];
    return (courseHoles.filter((h) => h.course_id === courseId) as { number: number; par: number; meters: number }[])
      .map((h) => ({ number: h.number, par: h.par, meters: h.meters }));
  }

  const holesByCourse: Record<string, Hole[]> = {};
  for (const c of courses) {
    holesByCourse[c.id] = holesForCourse(c.id);
  }

  let holesR1 = holesForCourse(round1CourseId);
  let holesR2 = holesForCourse(round2CourseId);

  if (holesR1.length === 0 && holesR2.length > 0) holesR1 = holesR2;
  if (holesR2.length === 0 && holesR1.length > 0) holesR2 = holesR1;

  const flightsRows = flightsRes.data ?? [];
  const flightPlayers = flightPlayersRes.data ?? [];

  // Filtrujemy tylko graczy, którzy mają dołki w turnieju
  const activePlayerIds = new Set<string>();
  scoresRows.forEach((s) => {
    if (s.player_id) activePlayerIds.add(String(s.player_id).toLowerCase());
  });
  flightPlayers.forEach((fp) => {
    if (fp.player_id) activePlayerIds.add(String(fp.player_id).toLowerCase());
  });

  const rawPlayers = playersRes.data ?? [];
  const participatingPlayers =
    activeTournament?.id && activePlayerIds.size > 0
      ? rawPlayers.filter((p) => activePlayerIds.has(String(p.id).toLowerCase()))
      : rawPlayers;

  const players: Player[] = participatingPlayers.map((p) => {
    const scores: Record<Round, number[]> = { 1: Array(18).fill(0), 2: Array(18).fill(0) };

    scoresRows
      .filter((s) => String(s.player_id).toLowerCase() === String(p.id).toLowerCase())
      .forEach((s) => {
        const r = Number(s.round ?? s.round_number ?? 1);
        const h = Number(s.hole_number ?? s.hole ?? 0);
        const val = Number(s.strokes ?? s.score ?? 0);

        if ((r === 1 || r === 2) && h >= 1 && h <= 18) {
          scores[r as Round][h - 1] = val;
        }
      });

    const linkedFlightIds = flightPlayers
      .filter((fp) => String(fp.player_id).toLowerCase() === String(p.id).toLowerCase())
      .map((fp) => fp.flight_id);

    const flightId: Record<Round, string | null> = {
      1: flightsRows.find((f) => f.round === 1 && linkedFlightIds.includes(f.id))?.id ?? null,
      2: flightsRows.find((f) => f.round === 2 && linkedFlightIds.includes(f.id))?.id ?? null,
    };

    return {
      id: p.id,
      name: p.name,
      category: p.category,
      avatar: p.avatar ?? undefined,
      club: p.club ?? undefined,
      flag: p.flag ?? 'PL',
      flagImage: p.flag_image ?? undefined,
      isAmateur: p.is_amateur,
      isActive: p.is_active ?? true,
      userId: p.user_id ?? undefined,
      email: p.email ?? undefined,
      gender: p.gender ?? undefined,
      preferredFoot: p.preferred_foot ?? undefined,
      birthDate: p.birth_date ?? undefined,
      city: p.city ?? undefined,
      ballModel: p.ball_model ?? undefined,
      flightId,
      scores,
    };
  });

  const flights: Flight[] = flightsRows.map((f) => ({
    id: f.id,
    name: f.name,
    code: f.code,
    round: f.round as Round,
    startHole: f.start_hole,
    playerIds: flightPlayers.filter((fp) => fp.flight_id === f.id).map((fp) => fp.player_id),
  }));

  return {
    store: {
      tournamentName,
      courses,
      round1CourseId,
      round2CourseId,
      holesByRound: { 1: holesR1, 2: holesR2 },
      holesByCourse,
      players,
      flights,
      round1Approved,
      round2Started,
    },
    tournaments,
    activeTournament,
    leaguePoints: leaguePointsRes.data ?? [],
    registrations: registrationsRes.data ?? [],
    logoUrl: settings?.logo_url ?? null,
  };
}

export function useStore() {
  const [store, setStore] = useState<Store | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [activeTournament, setActiveTournament] = useState<Tournament | null>(null);
  const [activeTournamentId, setActiveTournamentId] = useState<string | null>(() =>
    localStorage.getItem('pffg_active_tournament')
  );
  const [leaguePoints, setLeaguePoints] = useState<any[]>([]);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);

  const load = async () => {
    try {
      const res = await fetchStore(activeTournamentId);
      setStore(res.store);
      setTournaments(res.tournaments);
      setActiveTournament(res.activeTournament);
      setLeaguePoints(res.leaguePoints);
      setRegistrations(res.registrations);
      setLogoUrl(res.logoUrl);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Nie udało się połączyć z bazą danych turnieju.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(session?.user ?? null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
      load();
    });

    load();

    const scheduleReload = () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(load, 250);
    };

    const channel = supabase
      .channel('tournament-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'courses' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'course_holes' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'flights' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'flight_players' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_settings' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'league_points' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_registrations' }, scheduleReload)
      .subscribe();

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
      authListener.subscription.unsubscribe();
    };
  }, [activeTournamentId]);

  const selectTournament = (id: string) => {
    setActiveTournamentId(id);
    localStorage.setItem('pffg_active_tournament', id);
  };

  const userProfile =
    store?.players.find(
      (p: any) =>
        (currentUser?.id && p.userId === currentUser.id) ||
        (currentUser?.email && p.email?.toLowerCase() === currentUser.email.toLowerCase()) ||
        (currentUser?.email &&
          p.name &&
          currentUser.email.toLowerCase().includes(p.name.toLowerCase().replace(/\s+/g, '')))
    ) ?? null;

  return {
    store,
    tournaments,
    activeTournament,
    setActiveTournamentId: selectTournament,
    leaguePoints,
    registrations,
    logoUrl,
    currentUser,
    userProfile,
    loading,
    error,
    refresh: load,
  };
}