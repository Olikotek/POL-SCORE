// src/actions.ts
import { supabase } from '@/lib/supabase';
import type { Category, Course, Flight, Hole, Player, Round, Tournament, ClubInfo } from '@/types';
import { randomCode, relative } from '@/scoring';

// --- ZARZĄDZANIE TURNIEJAMI ---
export async function createTournament(data: {
  name: string;
  courseName?: string;
  date: string;
  isLeague: boolean;
  isPolishOpen: boolean;
}): Promise<Tournament> {
  const { data: created, error } = await supabase
    .from('tournaments')
    .insert({
      name: data.name,
      course_name: data.courseName || null,
      date: data.date,
      is_league: data.isLeague,
      is_polish_open: data.isPolishOpen,
      status: 'active',
    })
    .select()
    .single();

  if (error) {
    alert(`Błąd tworzenia turnieju: ${error.message}`);
    throw error;
  }

  return {
    id: created.id,
    name: created.name,
    courseName: created.course_name,
    date: created.date,
    isLeague: created.is_league,
    isPolishOpen: created.is_polish_open,
    status: created.status,
    round1CourseId: created.round1_course_id,
    round2CourseId: created.round2_course_id,
    round1Approved: created.round1_approved,
    round2Started: created.round2_started,
  };
}

export async function updateTournament(
  id: string,
  data: {
    name?: string;
    courseName?: string;
    date?: string;
    isLeague?: boolean;
    isPolishOpen?: boolean;
  }
) {
  const payload: Record<string, any> = {};
  if (data.name !== undefined) payload.name = data.name;
  if (data.courseName !== undefined) payload.course_name = data.courseName || null;
  if (data.date !== undefined) payload.date = data.date;
  if (data.isLeague !== undefined) payload.is_league = data.isLeague;
  if (data.isPolishOpen !== undefined) payload.is_polish_open = data.isPolishOpen;

  const { data: result, error } = await supabase
    .from('tournaments')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    alert(`Błąd edycji turnieju: ${error.message}`);
    throw error;
  }

  return result;
}

export async function completeTournament(
  tournamentId: string,
  pointsData: { playerId: string; rank: number; strokes: number; points: number; category: string }[]
) {
  if (pointsData.length > 0) {
    const rows = pointsData.map((p) => ({
      tournament_id: tournamentId,
      player_id: p.playerId,
      rank: p.rank,
      strokes: p.strokes,
      points: p.points,
      category: p.category,
    }));

    const { error: ptsError } = await supabase
      .from('league_points')
      .upsert(rows, { onConflict: 'tournament_id,player_id' });

    if (ptsError) {
      alert(`Błąd zapisu punktów ligowych: ${ptsError.message}`);
      throw ptsError;
    }
  }

  const { error: tError } = await supabase
    .from('tournaments')
    .update({ status: 'completed' })
    .eq('id', tournamentId);

  if (tError) {
    alert(`Błąd zamykania turnieju: ${tError.message}`);
    throw tError;
  }
}

export async function deleteTournament(id: string) {
  const { error } = await supabase.from('tournaments').delete().eq('id', id);
  if (error) {
    alert(`Błąd usuwania turnieju: ${error.message}`);
    throw error;
  }
}

// --- ZARZĄDZANIE POLEM ---
export async function createCourse(name: string): Promise<Course> {
  const { data, error } = await supabase.from('courses').insert({ name }).select().single();
  if (error) throw error;
  const courseId = data.id;
  const holeRows = Array.from({ length: 18 }, (_, i) => ({
    course_id: courseId,
    number: i + 1,
    par: 4,
    meters: 100,
  }));
  const { error: holeError } = await supabase.from('course_holes').insert(holeRows);
  if (holeError) throw holeError;
  return { id: courseId, name: data.name };
}

export async function updateCourseHole(
  courseId: string,
  number: number,
  field: 'par' | 'meters',
  value: number
) {
  const { error } = await supabase
    .from('course_holes')
    .update({ [field]: value })
    .eq('course_id', courseId)
    .eq('number', number);
  if (error) throw error;
}

export async function deleteCourse(id: string) {
  const { error } = await supabase.from('courses').delete().eq('id', id);
  if (error) throw error;
}

export async function setRoundCourse(round: 1 | 2, courseId: string | null, activeTournamentId?: string | null) {
  const col = round === 1 ? 'round1_course_id' : 'round2_course_id';
  if (activeTournamentId) {
    const { error } = await supabase.from('tournaments').update({ [col]: courseId }).eq('id', activeTournamentId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('tournament_settings').update({ [col]: courseId }).eq('id', 1);
    if (error) throw error;
  }
}

export async function setTournamentName(name: string, activeTournamentId?: string | null) {
  if (activeTournamentId) {
    const { error } = await supabase.from('tournaments').update({ name }).eq('id', activeTournamentId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('tournament_settings').update({ tournament_name: name }).eq('id', 1);
    if (error) throw error;
  }
}

// --- ZARZĄDZANIE ZAWODNIKAMI ---
export async function addPlayer(data: {
  name: string;
  category: Category;
  avatar?: string;
  club?: string;
  flag: string;
  flagImage?: string;
  isAmateur: boolean;
  isActive?: boolean;
  ball_model?: string;
  city?: string;
  gender?: string;
  preferred_foot?: string;
  birth_date?: string;
  email?: string;
}) {
  const payload = {
    name: data.name,
    category: data.category,
    avatar: data.avatar || null,
    club: data.club || null,
    ball_model: data.ball_model || null,
    city: data.city || null,
    gender: data.gender || 'Male',
    preferred_foot: data.preferred_foot || 'Right',
    birth_date: data.birth_date || null,
    email: data.email || null,
    flag: data.flag || 'PL',
    flag_image: data.flagImage || null,
    is_amateur: data.isAmateur,
    is_active: data.isActive ?? true,
  };

  const { data: inserted, error } = await supabase.from('players').insert(payload).select().single();
  if (error) {
    alert(`[BŁĄD DODAWANIA ZAWODNIKA]\n${error.message}`);
    throw error;
  }
  return inserted;
}

export async function updatePlayer(id: string, data: {
  name: string;
  category: Category;
  avatar?: string;
  club?: string;
  flag: string;
  flagImage?: string;
  isAmateur: boolean;
  isActive?: boolean;
  ball_model?: string;
  city?: string;
  gender?: string;
  preferred_foot?: string;
  birth_date?: string;
  email?: string;
}) {
  const payload = {
    name: data.name,
    category: data.category,
    avatar: data.avatar || null,
    club: data.club || null,
    ball_model: data.ball_model || null,
    city: data.city || null,
    gender: data.gender || 'Male',
    preferred_foot: data.preferred_foot || 'Right',
    birth_date: data.birth_date || null,
    email: data.email || null,
    flag: data.flag || 'PL',
    flag_image: data.flagImage || null,
    is_amateur: data.isAmateur,
    is_active: data.isActive ?? true,
  };

  const { error } = await supabase
    .from('players')
    .update(payload)
    .eq('id', id);

  if (error) {
    alert(`[BŁĄD EDYCJI ZAWODNIKA ID: ${id}]\n${error.message}`);
    throw error;
  }
}

export async function togglePlayerActive(id: string, isActive: boolean) {
  const { error } = await supabase
    .from('players')
    .update({ is_active: isActive })
    .eq('id', id);

  if (error) {
    alert(`[BŁĄD ZMIANY STATUSU ID: ${id}]\n${error.message}`);
    throw error;
  }
}

export async function deletePlayer(id: string) {
  const { error } = await supabase.from('players').delete().eq('id', id);
  if (error) {
    alert(`[BŁĄD USUWANIA ZAWODNIKA ID: ${id}]\n${error.message}`);
    throw error;
  }
}

export async function removePlayerFromTournament(playerId: string, tournamentId?: string | null) {
  if (!tournamentId) return;

  await supabase
    .from('scores')
    .delete()
    .eq('player_id', playerId)
    .eq('tournament_id', tournamentId);

  const { data: flightRows } = await supabase
    .from('flights')
    .select('id')
    .eq('tournament_id', tournamentId);

  if (flightRows && flightRows.length > 0) {
    const flightIds = flightRows.map((f: any) => f.id);
    await supabase
      .from('flight_players')
      .delete()
      .eq('player_id', playerId)
      .in('flight_id', flightIds);
  }
}

// --- ZARZĄDZANIE KLUBAMI I LOGOTYPAMI ---
export async function saveClubLogo(clubName: string, logoUrl: string) {
  const cleanName = clubName.trim();
  if (!cleanName) return;

  try {
    localStorage.setItem(`pffg_club_logo_${cleanName}`, logoUrl);
  } catch (e) {
    console.error('LocalStorage write error:', e);
  }

  try {
    const { error: upsertError } = await supabase
      .from('clubs')
      .upsert({ name: cleanName, logo_url: logoUrl }, { onConflict: 'name' });

    if (upsertError) {
      console.warn('Tabela clubs nie istnieje lub brak RLS:', upsertError);
    }
  } catch (err) {
    console.warn('Błąd podczas zapisu do tabeli clubs:', err);
  }

  try {
    await supabase
      .from('players')
      .update({ flag_image: logoUrl })
      .eq('club', cleanName);
  } catch (e) {
    console.error('Błąd aktualizacji flag_image u graczy:', e);
  }
}

export async function fetchClubs(): Promise<Record<string, string>> {
  const map: Record<string, string> = {};

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('pffg_club_logo_')) {
        const clubName = key.replace('pffg_club_logo_', '');
        const url = localStorage.getItem(key);
        if (url) map[clubName] = url;
      }
    }
  } catch (e) {
    console.error('LocalStorage read error:', e);
  }

  try {
    const { data, error } = await supabase.from('clubs').select('name, logo_url');
    if (!error && data) {
      data.forEach((c: any) => {
        if (c.name && c.logo_url) {
          map[c.name.trim()] = c.logo_url;
          localStorage.setItem(`pffg_club_logo_${c.name.trim()}`, c.logo_url);
        }
      });
    }
  } catch (err) {
    console.warn('Tabela clubs niedostępna, używam danych z profili/local storage.');
  }

  return map;
}

// --- FLIGHTY ---
export async function createFlight(data: {
  name: string;
  round: Round;
  startHole: number;
  code?: string;
  tournamentId?: string | null;
}) {
  const flight = {
    name: data.name,
    code: data.code?.length === 4 ? data.code : randomCode(),
    round: data.round,
    start_hole: data.startHole,
    tournament_id: data.tournamentId || null,
  };
  const { data: created, error } = await supabase.from('flights').insert(flight).select().single();
  if (error) throw error;
  return created;
}

export async function updateFlight(id: string, data: { name: string; code: string; startHole: number }) {
  const { error } = await supabase
    .from('flights')
    .update({ name: data.name, code: data.code, start_hole: data.startHole })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteFlight(id: string) {
  const { error } = await supabase.from('flights').delete().eq('id', id);
  if (error) throw error;
}

export async function assignPlayerToFlight(
  playerId: string,
  flightId: string | null,
  roundFlightIds: string[],
  tournamentId?: string | null
) {
  if (roundFlightIds.length > 0) {
    const { error: delError } = await supabase
      .from('flight_players')
      .delete()
      .eq('player_id', playerId)
      .in('flight_id', roundFlightIds);
    if (delError) throw delError;
  }

  if (flightId) {
    const { error: insError } = await supabase
      .from('flight_players')
      .insert({
        player_id: playerId,
        flight_id: flightId,
        tournament_id: tournamentId || null,
      });
    if (insError) throw insError;
  }
}

// --- ZAPIS WYNIKÓW ---
async function resolveTournamentId(providedId?: string | null): Promise<string | null> {
  if (providedId) return providedId;
  const { data } = await supabase
    .from('tournaments')
    .select('id')
    .eq('status', 'active')
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id || null;
}

export async function saveScore(
  playerId: string,
  round: Round,
  holeNumber: number,
  strokes: number,
  tournamentId?: string | null
) {
  const tId = await resolveTournamentId(tournamentId);
  const rNum = Number(round);
  const hNum = Number(holeNumber);
  const val = Number(strokes) || 0;

  let query = supabase
    .from('scores')
    .delete()
    .eq('player_id', playerId)
    .eq('round', rNum)
    .eq('hole_number', hNum);

  if (tId) query = query.eq('tournament_id', tId);
  await query;

  if (val > 0) {
    const payload: any = {
      player_id: playerId,
      round: rNum,
      hole_number: hNum,
      strokes: val,
    };
    if (tId) payload.tournament_id = tId;

    const { error } = await supabase.from('scores').insert(payload);
    if (error) {
      alert(`Błąd zapisu pojedynczego wyniku: ${error.message}`);
      throw error;
    }
  }
}

export async function saveBatchScores(
  playerId: string,
  round: Round,
  scoresArray: number[],
  tournamentId?: string | null
) {
  const tId = await resolveTournamentId(tournamentId);
  const rNum = Number(round);

  let query = supabase.from('scores').delete().eq('player_id', playerId).eq('round', rNum);
  if (tId) query = query.eq('tournament_id', tId);
  const { error: delError } = await query;

  if (delError) {
    alert(`Błąd czyszczenia wyników gracza: ${delError.message}`);
    throw delError;
  }

  const rows = scoresArray
    .map((strokes, index) => {
      const row: any = {
        player_id: playerId,
        round: rNum,
        hole_number: index + 1,
        strokes: Number(strokes) || 0,
      };
      if (tId) row.tournament_id = tId;
      return row;
    })
    .filter((row) => row.strokes > 0);

  if (rows.length === 0) return;

  const { error: insError } = await supabase.from('scores').insert(rows);
  if (insError) {
    alert(`Błąd zapisu serii wyników: ${insError.message}`);
    throw insError;
  }
}

export async function saveHoleScores(
  players: { id: string; scores: number[] }[],
  round: Round,
  holeIndex: number,
  tournamentId?: string | null
) {
  const tId = await resolveTournamentId(tournamentId);
  const rNum = Number(round);
  const hNum = holeIndex + 1;
  const playerIds = players.map((p) => p.id);

  let delQuery = supabase
    .from('scores')
    .delete()
    .eq('round', rNum)
    .eq('hole_number', hNum)
    .in('player_id', playerIds);

  if (tId) delQuery = delQuery.eq('tournament_id', tId);
  const { error: delError } = await delQuery;

  if (delError) {
    alert(`Błąd usuwania poprzednich wyników dołka: ${delError.message}`);
    throw delError;
  }

  const rows = players
    .filter((p) => Number(p.scores[holeIndex]) > 0)
    .map((p) => {
      const row: any = {
        player_id: p.id,
        round: rNum,
        hole_number: hNum,
        strokes: Number(p.scores[holeIndex]),
      };
      if (tId) row.tournament_id = tId;
      return row;
    });

  if (rows.length === 0) return;

  const { error: insError } = await supabase.from('scores').insert(rows);
  if (insError) {
    alert(`Błąd zapisu wyników dołka: ${insError.message}`);
    throw insError;
  }
}

export async function setRound1Approved(approved: boolean, activeTournamentId?: string | null) {
  if (activeTournamentId) {
    const { error } = await supabase.from('tournaments').update({ round1_approved: approved }).eq('id', activeTournamentId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('tournament_settings').update({ round1_approved: approved }).eq('id', 1);
    if (error) throw error;
  }
}

export async function setRound2Started(started: boolean, activeTournamentId?: string | null) {
  if (activeTournamentId) {
    const { error } = await supabase.from('tournaments').update({ round2_started: started }).eq('id', activeTournamentId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('tournament_settings').update({ round2_started: started }).eq('id', 1);
    if (error) throw error;
  }
}

export async function reflightForRound2(
  players: Player[],
  holesR1: Hole[],
  holesR2: Hole[],
  groupSize: number,
  existingRound2Flights: Flight[],
  tournamentId?: string | null
) {
  const sorted = [...players].sort(
    (a, b) =>
      relative(a.scores[1], holesR1) + relative(a.scores[2], holesR2) -
      (relative(b.scores[1], holesR1) + relative(b.scores[2], holesR2))
  );
  const groups: string[][] = [];
  for (let i = 0; i < sorted.length; i += groupSize) {
    groups.push(sorted.slice(i, i + groupSize).map((p) => p.id));
  }

  const round2Ids = existingRound2Flights.map((f) => f.id);
  if (round2Ids.length > 0) {
    const { error: delError } = await supabase.from('flight_players').delete().in('flight_id', round2Ids);
    if (delError) throw delError;
  }

  for (const [idx, group] of groups.entries()) {
    const existing = existingRound2Flights[idx];
    if (existing) {
      const memberships = group.map((pid) => ({
        flight_id: existing.id,
        player_id: pid,
        tournament_id: tournamentId || null,
      }));
      if (memberships.length > 0) {
        const { error } = await supabase.from('flight_players').insert(memberships);
        if (error) throw error;
      }
    } else {
      const newId = crypto.randomUUID();
      const { error: fe } = await supabase.from('flights').insert({
        id: newId,
        name: `Flight ${String.fromCharCode(65 + idx)}`,
        code: randomCode(),
        round: 2,
        start_hole: 1,
        tournament_id: tournamentId || null,
      });
      if (fe) throw fe;
      const memberships = group.map((pid) => ({
        flight_id: newId,
        player_id: pid,
        tournament_id: tournamentId || null,
      }));
      if (memberships.length > 0) {
        const { error: me } = await supabase.from('flight_players').insert(memberships);
        if (me) throw me;
      }
    }
  }
}

export async function resetRoundScores(round: Round) {
  const { error } = await supabase
    .from('scores')
    .delete()
    .eq('round', round);

  if (error) {
    alert(`Błąd czyszczenia wyników rundy: ${error.message}`);
    throw error;
  }
}

export async function setLogoUrl(url: string | null) {
  const { error } = await supabase
    .from('tournament_settings')
    .update({ logo_url: url })
    .eq('id', 1);
  if (error) {
    alert(`Błąd zapisu logo: ${error.message}`);
    throw error;
  }
}

export async function registerForTournament(tournamentId: string, playerId: string, paymentMethod: string = 'on_site') {
  const { error } = await supabase
    .from('tournament_registrations')
    .upsert(
      { tournament_id: tournamentId, player_id: playerId, payment_method: paymentMethod },
      { onConflict: 'tournament_id,player_id' }
    );
  if (error && !error.message.includes('duplicate key')) {
    throw error;
  }
}

export async function fetchRegistrations(tournamentId?: string | null) {
  let query = supabase.from('tournament_registrations').select('*');
  if (tournamentId) {
    query = query.eq('tournament_id', tournamentId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}