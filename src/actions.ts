import { supabase } from '@/lib/supabase';
import type { Category, Course, Flight, Hole, Player, Round, Tournament } from '@/types';
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
// ---------------------------------------

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

export async function addPlayer(data: {
  name: string;
  category: Category;
  avatar?: string;
  club?: string;
  flag: string;
  flagImage?: string;
  isAmateur: boolean;
  isActive?: boolean;
}) {
  const payload = {
    name: data.name,
    category: data.category,
    avatar: data.avatar || null,
    club: data.club || null,
    flag: data.flag,
    flag_image: data.flagImage || null,
    is_amateur: data.isAmateur,
    is_active: data.isActive ?? true,
  };

  const { error } = await supabase.from('players').insert(payload);
  if (error) {
    alert(`[BŁĄD DODAWANIA ZAWODNIKA]\nKod: ${error.code}\nWiadomość: ${error.message}\nSzczegóły: ${error.details}\nWskazówka: ${error.hint}`);
    console.error('Błąd addPlayer:', error);
    throw error;
  }
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
}) {
  const payload = {
    name: data.name,
    category: data.category,
    avatar: data.avatar || null,
    club: data.club || null,
    flag: data.flag,
    flag_image: data.flagImage || null,
    is_amateur: data.isAmateur,
    is_active: data.isActive ?? true,
  };

  const { error } = await supabase
    .from('players')
    .update(payload)
    .eq('id', id);

  if (error) {
    alert(`[BŁĄD EDYCJI ZAWODNIKA ID: ${id}]\nKod: ${error.code}\nWiadomość: ${error.message}\nSzczegóły: ${error.details}\nWskazówka: ${error.hint}`);
    console.error('Błąd updatePlayer:', error);
    throw error;
  }
}

export async function togglePlayerActive(id: string, isActive: boolean) {
  const { error } = await supabase
    .from('players')
    .update({ is_active: isActive })
    .eq('id', id);

  if (error) {
    alert(`[BŁĄD ZMIANY STATUSU ID: ${id}]\nKod: ${error.code}\nWiadomość: ${error.message}\nSzczegóły: ${error.details}\nWskazówka: ${error.hint}`);
    console.error('Błąd togglePlayerActive:', error);
    throw error;
  }
}

export async function deletePlayer(id: string) {
  const { error } = await supabase.from('players').delete().eq('id', id);
  if (error) {
    alert(`[BŁĄD USUWANIA ZAWODNIKA ID: ${id}]\nKod: ${error.code}\nWiadomość: ${error.message}`);
    throw error;
  }
}

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

export async function saveScore(playerId: string, round: Round, holeNumber: number, strokes: number, tournamentId?: string | null) {
  const { error } = await supabase
    .from('scores')
    .upsert(
      {
        player_id: playerId,
        round,
        hole_number: holeNumber,
        strokes,
        tournament_id: tournamentId || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'player_id,round,hole_number' }
    );
  if (error) throw error;
}

export async function saveHoleScores(
  players: { id: string; scores: number[] }[],
  round: Round,
  holeIndex: number,
  tournamentId?: string | null
) {
  const rows = players
    .filter((p) => p.scores[holeIndex] > 0)
    .map((p) => ({
      player_id: p.id,
      round,
      hole_number: holeIndex + 1,
      strokes: p.scores[holeIndex],
      tournament_id: tournamentId || null,
      updated_at: new Date().toISOString(),
    }));
  if (rows.length === 0) return;
  const { error } = await supabase
    .from('scores')
    .upsert(rows, { onConflict: 'player_id,round,hole_number' });
  if (error) throw error;
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
export async function deleteTournament(id: string) {
  const { error } = await supabase.from('tournaments').delete().eq('id', id);
  if (error) {
    alert(`Błąd usuwania turnieju: ${error.message}`);
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

export async function setLogoUrl(url: string | null) {
  const { error } = await supabase
    .from('tournament_settings')
    .update({ logo_url: url })
    .eq('id', 1);
  if (error) throw error;
}

export async function registerPlayerForTournament(tournamentId: string, playerId: string, paymentMethod: string = 'on_site') {
  const { error } = await supabase
    .from('tournament_registrations')
    .insert({
      tournament_id: tournamentId,
      player_id: playerId,
      payment_method: paymentMethod,
    });
  if (error && !error.message.includes('duplicate key')) throw error;
}