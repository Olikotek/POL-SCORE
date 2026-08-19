import type { Hole, Player, Round, ScoreStyle } from './types';
import { ROUNDS } from './types';

export const relative = (scores: number[], holes: Hole[]) =>
  scores.reduce((sum, score, index) => (score > 0 && index < holes.length ? sum + score - holes[index].par : sum), 0);

export function combinedRelative(player: Player, holesR1: Hole[], holesR2: Hole[]) {
  return relative(player.scores[1], holesR1) + relative(player.scores[2], holesR2);
}

export const relativeLabel = (value: number) => (value === 0 ? 'E' : value > 0 ? `+${value}` : `${value}`);

export const relativeColor = (value: number) =>
  value < 0 ? 'text-rose-600' : value > 0 ? 'text-slate-700' : 'text-slate-600';

export const scoreStyle = (delta: number): ScoreStyle => {
  if (delta <= -2) return { label: 'Eagle lub lepiej', className: 'score-eagle' };
  if (delta === -1) return { label: 'Birdie', className: 'score-birdie' };
  if (delta === 0) return { label: 'Par', className: 'score-par' };
  if (delta === 1) return { label: 'Bogey', className: 'score-bogey' };
  if (delta === 2) return { label: 'Double bogey', className: 'score-double' };
  return { label: 'Triple bogey lub gorzej', className: 'score-triple' };
};

export const totalPar = (holes: Hole[]) => holes.reduce((sum, hole) => sum + hole.par, 0);

export const subtotal = (scores: number[], holes: Hole[], start: number, end: number) => {
  const slice = scores.slice(start, end);
  const parSlice = holes.slice(start, end);
  const sum = slice.reduce((a, b) => a + (b > 0 ? b : 0), 0);
  const rel = slice.reduce((a, b, i) => (b > 0 && parSlice[i] ? a + b - parSlice[i].par : a), 0);
  return { sum, rel };
};

export const totalStrokes = (scores: number[]) => scores.reduce((a, b) => a + (b > 0 ? b : 0), 0);

export const freshId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

export const randomCode = () => String(Math.floor(1000 + Math.random() * 9000));

export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase() || '??';

export const holesPlayed = (scores: number[]) => scores.filter((s) => s > 0).length;

export function thruLabel(player: Player): string {
  const r1 = holesPlayed(player.scores[1]);
  const r2 = holesPlayed(player.scores[2]);
  if (r2 === 18) return 'F';
  if (r2 > 0) return String(18 + r2);
  if (r1 === 18) return 'F1';
  if (r1 === 0) return '–';
  return String(r1);
}

export type StatCategory = 'total' | 'out' | 'inn' | 'par3' | 'par4' | 'par5' | 'birdies' | 'pars' | 'bogeys';

export type StatResult = { value: number; display: string; lowerBetter: boolean };

export function computeStat(scores: number[], holes: Hole[], stat: StatCategory): StatResult {
  switch (stat) {
    case 'total':
      return { value: relative(scores, holes), display: relativeLabel(relative(scores, holes)), lowerBetter: true };
    case 'out': {
      const rel = subtotal(scores, holes, 0, 9).rel;
      return { value: rel, display: relativeLabel(rel), lowerBetter: true };
    }
    case 'inn': {
      const rel = subtotal(scores, holes, 9, 18).rel;
      return { value: rel, display: relativeLabel(rel), lowerBetter: true };
    }
    case 'par3':
      return { value: parRel(scores, holes, 3), display: relativeLabel(parRel(scores, holes, 3)), lowerBetter: true };
    case 'par4':
      return { value: parRel(scores, holes, 4), display: relativeLabel(parRel(scores, holes, 4)), lowerBetter: true };
    case 'par5':
      return { value: parRel(scores, holes, 5), display: relativeLabel(parRel(scores, holes, 5)), lowerBetter: true };
    case 'birdies':
      return { value: -countBirdies(scores, holes), display: String(countBirdies(scores, holes)), lowerBetter: true };
    case 'pars':
      return { value: -countPars(scores, holes), display: String(countPars(scores, holes)), lowerBetter: true };
    case 'bogeys':
      return { value: countBogeys(scores, holes), display: String(countBogeys(scores, holes)), lowerBetter: true };
    default:
      return { value: 0, display: '–', lowerBetter: true };
  }
}

const isNegatedCountStat = (stat: StatCategory) => stat === 'birdies' || stat === 'pars';

export function combinedStat(player: Player, holesR1: Hole[], holesR2: Hole[], stat: StatCategory): StatResult {
  const a = computeStat(player.scores[1], holesR1, stat);
  const b = computeStat(player.scores[2], holesR2, stat);
  const value = a.value + b.value;
  if (isNegatedCountStat(stat)) return { value, display: String(-value), lowerBetter: true };
  if (stat === 'bogeys') return { value, display: String(value), lowerBetter: true };
  return { value, display: relativeLabel(value), lowerBetter: true };
}

const parRel = (scores: number[], holes: Hole[], par: number) => {
  let rel = 0;
  scores.forEach((s, i) => {
    if (s > 0 && holes[i] && holes[i].par === par) rel += s - holes[i].par;
  });
  return rel;
};

const countBirdies = (scores: number[], holes: Hole[]) =>
  scores.reduce((acc, s, i) => (s > 0 && holes[i] && s - holes[i].par <= -1 ? acc + 1 : acc), 0);

const countPars = (scores: number[], holes: Hole[]) =>
  scores.reduce((acc, s, i) => (s > 0 && holes[i] && s - holes[i].par === 0 ? acc + 1 : acc), 0);

const countBogeys = (scores: number[], holes: Hole[]) =>
  scores.reduce((acc, s, i) => (s > 0 && holes[i] && s - holes[i].par >= 1 ? acc + 1 : acc), 0);

const ORDINAL_SUFFIX = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export const ordinalLabel = (rank: number) => ORDINAL_SUFFIX(rank);

export function rankDisplay(rank: number | undefined, allRanks: number[]): string {
  if (rank === undefined) return '–';
  const tiedCount = allRanks.filter((r) => r === rank).length;
  if (tiedCount > 1) return `T${rank}`;
  return ORDINAL_SUFFIX(rank);
}

export function computeRanks(values: number[], lowerBetter: boolean): number[] {
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => (lowerBetter ? a.v - b.v : b.v - a.v));
  const ranks: number[] = new Array(values.length).fill(0);
  let lastValue: number | null = null;
  let lastRank = 0;
  indexed.forEach((entry, idx) => {
    if (lastValue === null || entry.v !== lastValue) {
      lastRank = idx + 1;
      lastValue = entry.v;
    }
    ranks[entry.i] = lastRank;
  });
  return ranks;
}

export function statRankMap(
  players: Player[],
  holesR1: Hole[],
  holesR2: Hole[],
  stat: StatCategory,
  round: Round | 'combined'
): Map<string, number> {
  const values = players.map((p) =>
    round === 'combined' ? combinedStat(p, holesR1, holesR2, stat).value : computeStat(p.scores[round], round === 1 ? holesR1 : holesR2, stat).value
  );
  const ranks = computeRanks(values, true);
  const map = new Map<string, number>();
  players.forEach((p, i) => map.set(p.id, ranks[i]));
  return map;
}

export function honourOrder(
  entries: { id: string; scores: number[] }[],
  holes: Hole[],
  currentHoleIndex: number
): string[] {
  if (currentHoleIndex <= 0) {
    return [...entries]
      .sort((a, b) => {
        const diff = relative(a.scores, holes) - relative(b.scores, holes);
        return diff !== 0 ? diff : a.id.localeCompare(b.id);
      })
      .map((e) => e.id);
  }
  const prevHoleIndex = currentHoleIndex - 1;
  const scored = entries.filter((e) => e.scores[prevHoleIndex] > 0);
  const unscored = entries.filter((e) => e.scores[prevHoleIndex] <= 0);

  const sortedScored = [...scored].sort((a, b) => {
    const aPrev = a.scores[prevHoleIndex];
    const bPrev = b.scores[prevHoleIndex];
    if (aPrev !== bPrev) return aPrev - bPrev;
    for (let h = prevHoleIndex - 1; h >= 0; h--) {
      const aH = a.scores[h];
      const bH = b.scores[h];
      if (aH > 0 && bH > 0 && aH !== bH) return aH - bH;
    }
    const diff = relative(a.scores, holes) - relative(b.scores, holes);
    return diff !== 0 ? diff : a.id.localeCompare(b.id);
  });

  const sortedUnscored = [...unscored].sort((a, b) => {
    const diff = relative(a.scores, holes) - relative(b.scores, holes);
    return diff !== 0 ? diff : a.id.localeCompare(b.id);
  });

  return [...sortedScored, ...sortedUnscored].map((e) => e.id);
}

export function holeStats(players: Player[], holes: Hole[], round: Round, holeIndex: number) {
  const scores = players.map((p) => p.scores[round][holeIndex]).filter((s) => s > 0);
  const par = holes[holeIndex]?.par ?? 4;
  const total = scores.length;
  const sum = scores.reduce((a, b) => a + b, 0);
  const avg = total > 0 ? sum / total : 0;
  let eagle = 0, birdie = 0, parCount = 0, bogey = 0, double = 0, other = 0;
  scores.forEach((s) => {
    const delta = s - par;
    if (delta <= -2) eagle++;
    else if (delta === -1) birdie++;
    else if (delta === 0) parCount++;
    else if (delta === 1) bogey++;
    else if (delta === 2) double++;
    else other++;
  });
  const parOrBetter = eagle + birdie + parCount;
  const parOrBetterPct = total > 0 ? Math.round((parOrBetter / total) * 100) : 0;
  return { avg, total, par, eagle, birdie, parCount, bogey, double, other, parOrBetterPct };
}

export type FormEntry = { round: Round; holeNumber: number; delta: number };

export function recentForm(player: Player, holesR1: Hole[], holesR2: Hole[], count = 4): FormEntry[] {
  const timeline: FormEntry[] = [];
  player.scores[1].forEach((s, i) => {
    if (s > 0 && holesR1[i]) timeline.push({ round: 1, holeNumber: i + 1, delta: s - holesR1[i].par });
  });
  player.scores[2].forEach((s, i) => {
    if (s > 0 && holesR2[i]) timeline.push({ round: 2, holeNumber: i + 1, delta: s - holesR2[i].par });
  });
  return timeline.slice(-count);
}

export type Curiosities = {
  longestBirdieStreak: { player: Player; streak: number } | null;
  bounceBacks: { player: Player; count: number }[];
  mostPars: { player: Player; count: number } | null;
  hardestHole: { number: number; avgRel: number } | null;
};

export function computeCuriosities(players: Player[], holesR1: Hole[], holesR2: Hole[]): Curiosities {
  let longest: { player: Player; streak: number } | null = null;
  const bounceBackCounts: { player: Player; count: number }[] = [];
  let mostPars: { player: Player; count: number } | null = null;

  players.forEach((p) => {
    let maxStreak = 0;
    let bounceBack = 0;
    let parsCount = 0;
    ROUNDS.forEach((r) => {
      const holes = r === 1 ? holesR1 : holesR2;
      let streak = 0;
      let prevWasBogeyPlus = false;
      p.scores[r].forEach((s, i) => {
        if (s <= 0 || !holes[i]) {
          streak = 0;
          prevWasBogeyPlus = false;
          return;
        }
        const delta = s - holes[i].par;
        if (delta <= -1) {
          streak += 1;
          if (prevWasBogeyPlus) bounceBack += 1;
        } else {
          streak = 0;
        }
        if (delta === 0) parsCount += 1;
        prevWasBogeyPlus = delta >= 1;
        maxStreak = Math.max(maxStreak, streak);
      });
    });
    if (!longest || maxStreak > longest.streak) longest = { player: p, streak: maxStreak };
    if (bounceBack > 0) bounceBackCounts.push({ player: p, count: bounceBack });
    if (!mostPars || parsCount > mostPars.count) mostPars = { player: p, count: parsCount };
  });

  bounceBackCounts.sort((a, b) => b.count - a.count);

  let hardestHole: { number: number; avgRel: number } | null = null;
  const allHoles: { hole: Hole; round: Round; holeIndex: number }[] = [
    ...holesR1.map((h, idx) => ({ hole: h, round: 1 as Round, holeIndex: idx })),
    ...holesR2.map((h, idx) => ({ hole: h, round: 2 as Round, holeIndex: idx })),
  ];
  allHoles.forEach(({ hole, round, holeIndex }) => {
    const deltas: number[] = [];
    players.forEach((p) => {
      const s = p.scores[round][holeIndex];
      if (s > 0) deltas.push(s - hole.par);
    });
    if (deltas.length === 0) return;
    const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    if (!hardestHole || avg > hardestHole.avgRel) hardestHole = { number: hole.number, avgRel: avg };
  });

  const longestResult = longest as { player: Player; streak: number } | null;
  const mostParsResult = mostPars as { player: Player; count: number } | null;
  return {
    longestBirdieStreak: longestResult && longestResult.streak > 1 ? longestResult : null,
    bounceBacks: bounceBackCounts.slice(0, 3),
    mostPars: mostParsResult && mostParsResult.count > 0 ? mostParsResult : null,
    hardestHole,
  };
}

// --- PUNKTACJA LIGI PFFG ---
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

export function calculateTournamentPoints(
  sortedPlayers: { id: string; rank: number; strokes: number; category: any; club?: string }[]
) {
  const rankGroups = new Map<number, typeof sortedPlayers>();
  sortedPlayers.forEach((p) => {
    const list = rankGroups.get(p.rank) || [];
    list.push(p);
    rankGroups.set(p.rank, list);
  });

  const result: { playerId: string; rank: number; strokes: number; points: number; category: any; club?: string }[] = [];

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

export function computeSeasonStanding(playerLeagueResults: { isPolishOpen: boolean; points: number }[]) {
  const regular = playerLeagueResults
    .filter((r) => !r.isPolishOpen)
    .map((r) => r.points)
    .sort((a, b) => b - a);

  const best6 = regular.slice(0, 6).reduce((sum, val) => sum + val, 0);
  const polishOpen = playerLeagueResults
    .filter((r) => r.isPolishOpen)
    .reduce((sum, val) => sum + val.points, 0);

  const totalPoints = Number((best6 + polishOpen).toFixed(2));
  return { totalPoints, roundsCount: playerLeagueResults.length };
}

export const MIN_ROUNDS_REQUIRED: Record<string, number> = {
  Men: 4,
  Senior: 4,
  Women: 3,
  Junior: 3,
  'Senior+': 3,
};