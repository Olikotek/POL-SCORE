// src/leagueScoring.ts
import type { Category } from '@/types';

// Tabela punktów (reguła 92% z regulaminu)
export const POINTS_TABLE: number[] = [
  100, 92, 85, 78, 72, 66, 61, 56, 52, 48,
  44, 40, 37, 34, 31, 29, 27, 25, 23, 21,
  19, 17, 15, 13, 11, 9, 8, 7, 6, 5, 4, 3, 2, 1
];

export function getPointsForRank(rank: number): number {
  if (rank < 1) return 0;
  if (rank <= POINTS_TABLE.length) return POINTS_TABLE[rank - 1];
  return 0;
}

// Obliczanie punktów za turniej z podziałem remisów
export function calculateTournamentPoints(
  sortedPlayers: { id: string; rank: number; strokes: number; category: Category; club?: string }[]
): { playerId: string; rank: number; strokes: number; points: number; category: Category; club?: string }[] {
  const rankGroups = new Map<number, typeof sortedPlayers>();

  sortedPlayers.forEach((p) => {
    const list = rankGroups.get(p.rank) || [];
    list.push(p);
    rankGroups.set(p.rank, list);
  });

  const result: { playerId: string; rank: number; strokes: number; points: number; category: Category; club?: string }[] = [];

  rankGroups.forEach((players, rank) => {
    const count = players.length;
    let totalPointsForGroup = 0;
    for (let i = 0; i < count; i++) {
      totalPointsForGroup += getPointsForRank(rank + i);
    }
    const pointsPerPlayer = count > 0 ? totalPointsForGroup / count : 0;
    players.forEach((p) => {
      result.push({
        playerId: p.id,
        rank: p.rank,
        strokes: p.strokes,
        points: Number(pointsPerPlayer.toFixed(2)),
        category: p.category,
        club: p.club,
      });
    });
  });

  return result;
}

// Zliczanie rankingu generalnego zawodnika (TOP 6 rund regularnych + Polish Open)
export function computeSeasonStanding(
  playerLeagueResults: { isPolishOpen: boolean; points: number }[]
): { totalPoints: number; roundsCount: number; countedPoints: number } {
  const regular = playerLeagueResults
    .filter((r) => !r.isPolishOpen)
    .map((r) => r.points)
    .sort((a, b) => b - a);

  const best6 = regular.slice(0, 6).reduce((sum, val) => sum + val, 0);

  const polishOpen = playerLeagueResults
    .filter((r) => r.isPolishOpen)
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