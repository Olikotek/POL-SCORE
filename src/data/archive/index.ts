// src/data/archive/index.ts
import { ROUND_6_DATA } from './round6_2026';

export interface StaticArchiveTournament {
  id: string;
  name: string;
  date: string;
  courseName: string;
  isLeague: boolean;
  isPolishOpen?: boolean;
  holes: { 1: any[]; 2: any[] };
  players: any[];
}

export const ARCHIVE_REGISTRY: StaticArchiveTournament[] = [
  ROUND_6_DATA,
  // Tutaj w przyszłości dodajesz: ROUND_7_DATA, ROUND_8_DATA itd.
];