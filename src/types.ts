// src/types.ts
export type View = 'wyniki' | 'teetimes' | 'admin' | 'karta';
export type Category = 'Men' | 'Women' | 'Senior' | 'Junior' | 'Senior+';
export const CATEGORIES: Category[] = ['Men', 'Women', 'Senior', 'Junior', 'Senior+'];

export type Round = 1 | 2;
export const ROUNDS: Round[] = [1, 2];

export type Country = { code: string; name: string };
export const COUNTRIES: Country[] = [
  { code: 'PL', name: 'Polska' },
  { code: 'DE', name: 'Niemcy' },
  { code: 'GB', name: 'Wielka Brytania' },
  { code: 'US', name: 'USA' },
  { code: 'FR', name: 'Francja' },
  { code: 'IT', name: 'Włochy' },
  { code: 'ES', name: 'Hiszpania' },
  { code: 'CZ', name: 'Czechy' },
  { code: 'SK', name: 'Słowacja' },
  { code: 'UA', name: 'Ukraina' },
  { code: 'SE', name: 'Szwecja' },
  { code: 'NL', name: 'Holandia' },
];

export function flagEmoji(code: string): string {
  const cleanCode = (code || 'PL').toLowerCase().trim();
  return `https://flagcdn.com/w40/${cleanCode}.png`;
}

export type Course = {
  id: string;
  name: string;
};

export type Hole = {
  number: number;
  par: number;
  meters: number;
};

export type Player = {
  id: string;
  name: string;
  category: Category;
  avatar?: string;
  club?: string;
  flag: string;
  flagImage?: string;
  isAmateur: boolean;
  isActive?: boolean;
  userId?: string;
  email?: string;
  gender?: 'Male' | 'Female';
  preferredFoot?: 'Right' | 'Left';
  birthDate?: string;
  city?: string;
  ballModel?: string;
  flightId: Record<Round, string | null>;
  scores: Record<Round, number[]>;
};

export type Flight = {
  id: string;
  name: string;
  code: string;
  round: Round;
  playerIds: string[];
  startHole: number;
  teeTime?: string;
};

export type Tournament = {
  id: string;
  name: string;
  courseName?: string;
  date: string;
  isLeague: boolean;
  isPolishOpen: boolean;
  status: 'draft' | 'active' | 'completed';
  round1CourseId: string | null;
  round2CourseId: string | null;
  round1Approved: boolean;
  round2Started: boolean;
};

export type LeaguePointRecord = {
  id: string;
  tournamentId: string;
  playerId: string;
  rank: number;
  strokes: number;
  points: number;
  category: Category | string;
};

export type ClubInfo = {
  id?: string;
  name: string;
  logoUrl?: string;
  city?: string;
};

export type Store = {
  tournamentName: string;
  courses: Course[];
  round1CourseId: string | null;
  round2CourseId: string | null;
  holesByRound: Record<Round, Hole[]>;
  holesByCourse: Record<string, Hole[]>;
  players: Player[];
  flights: Flight[];
  round1Approved: boolean;
  round2Started: boolean;
};

export type ScoreStyle = {
  label: string;
  className: string;
};