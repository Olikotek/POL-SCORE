// src/leagueScoring.ts
import type { Category } from '@/types';

// Oficjalna tabela punktowa PFFG (reguła 92%)
export const POSITION_POINTS: Record<number, number> = {
  1: 100, 2: 92, 3: 85, 4: 78, 5: 72, 6: 66, 7: 61, 8: 56, 9: 52, 10: 48,
  11: 44, 12: 40, 13: 37, 14: 34, 15: 31, 16: 28, 17: 26, 18: 24, 19: 22, 20: 20,
  21: 18, 22: 16, 23: 15, 24: 14, 25: 13, 26: 12, 27: 11, 28: 10, 29: 9, 30: 8,
  31: 7, 32: 6, 33: 5, 34: 4, 35: 3, 36: 2, 37: 1,
};

export function getBasePointsForPosition(pos: number): number {
  if (pos <= 0) return 0;
  return POSITION_POINTS[pos] ?? (pos <= 50 ? 1 : 0);
}

// Obliczenie sumy uderzeń na ostatnich N dołkach (Countback: 9, 6, 3, 2, 1)
export function getCountbackStrokes(scoresR1: number[] = [], scoresR2: number[] = [], lastHolesCount: number): number {
  const activeRoundScores = scoresR2.some((s) => s > 0) ? scoresR2 : scoresR1;
  const played = activeRoundScores.filter((s) => s > 0);
  if (played.length < lastHolesCount) return 9999;
  return played.slice(-lastHolesCount).reduce((a, b) => a + b, 0);
}

// Porównanie dwóch graczy wg regulaminu tie-breakera: 9, 6, 3, 2, 1 ostatni dołek
export function compareCountback(
  pA: { scoresR1?: number[]; scoresR2?: number[] },
  pB: { scoresR1?: number[]; scoresR2?: number[] }
): number {
  const r1A = pA.scoresR1 || [];
  const r2A = pA.scoresR2 || [];
  const r1B = pB.scoresR1 || [];
  const r2B = pB.scoresR2 || [];

  const intervals = [9, 6, 3, 2, 1];
  for (const n of intervals) {
    const sumA = getCountbackStrokes(r1A, r2A, n);
    const sumB = getCountbackStrokes(r1B, r2B, n);
    if (sumA !== sumB) {
      return sumA - sumB; // Mniej uderzeń = wyższa pozycja
    }
  }
  return 0; // Idealny remis
}

export interface PlayerRankResult {
  playerId: string;
  rank: number;
  strokes: number;
  points: number;
  category?: Category;
  club?: string;
  isPlayoffCandidate?: boolean;
}

// Pełne rozstrzygnięcie pozycji i punktów
export function calculateOfficialLeaguePoints(
  players: {
    id: string;
    strokes: number;
    scoresR1?: number[];
    scoresR2?: number[];
    category?: Category;
    club?: string;
    overrideRank?: number; // Ręczna dogrywka ustalona w Adminie
  }[]
): PlayerRankResult[] {
  // Sortowanie: 1. Wymuszone miejsce z dogrywki, 2. Suma uderzeń, 3. Countback (9,6,3,2,1)
  const sorted = [...players].sort((a, b) => {
    if (a.overrideRank !== undefined && b.overrideRank !== undefined) {
      return a.overrideRank - b.overrideRank;
    }
    if (a.overrideRank !== undefined) return -1;
    if (b.overrideRank !== undefined) return 1;

    if (a.strokes !== b.strokes) {
      return a.strokes - b.strokes;
    }

    return compareCountback(a, b);
  });

  return sorted.map((p, idx) => {
    const finalRank = p.overrideRank !== undefined ? p.overrideRank : idx + 1;
    const points = getBasePointsForPosition(finalRank);

    // Gracz kwalifikuje się do dogrywki o podium (TOP 3), jeśli ma taki sam wynik uderzeń jak ktoś z podium
    const isPlayoffCandidate =
      finalRank <= 3 ||
      sorted.some((other, oIdx) => oIdx <= 2 && other.id !== p.id && other.strokes === p.strokes);

<<<<<<< HEAD
  const best6 = regular.slice(0, 6).reduce((sum, val) => sum + val, 0);

  const polishOpen = playerLeagueResults
    .filter((r) => r.isPolishOpen)
    .map((r) => r.points)
    .map((r) => r.points)
    .reduce((sum, val) => sum + val, 0);

  const totalPoints = Number((best6 + polishOpen).toFixed(2));

  return {
    totalPoints,
    roundsCount: playerLeagueResults.length,
    countedPoints: totalPoints,
  };
}

// Minimalne wymogi startów do oficjalnej klasyfikacji
export const MIN_ROUNDS_REQUIRED: Record<Category, number> = {
  Men: 4,
  Senior: 4,
  Women: 3,
  Junior: 3,
  'Senior+': 3,
};
=======
    return {
      playerId: p.id,
      rank: finalRank,
      strokes: p.strokes,
      points,
      category: p.category,
      club: p.club,
      isPlayoffCandidate,
    };
  });
}
>>>>>>> 57bb9bf (Fix build and sync all components)
