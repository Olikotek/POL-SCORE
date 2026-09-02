// src/components/PlayerModal.tsx
import { useMemo, useState, memo } from 'react';
import {
  Award,
  BarChart3,
  Flame,
  Info,
  Target,
  TrendingDown,
  X,
  ZoomIn,
  Zap,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { Category, Hole, Player, Round, Store, Tournament } from '@/types';
import { CATEGORIES, ROUNDS, flagEmoji } from '@/types';
import {
  combinedStat,
  holeStats,
  rankDisplay,
  relative,
  relativeLabel,
  recentForm,
  statRankMap,
  subtotal,
  totalPar,
  totalStrokes,
  type StatCategory,
} from '@/scoring';

const TOTAL_CARDS: { key: StatCategory; label: string }[] = [
  { key: 'total', label: 'SUMA OGÓLNA' },
  { key: 'out', label: 'FRONT 9 (OUT)' },
  { key: 'inn', label: 'BACK 9 (IN)' },
];

const PAR_CARDS: { key: StatCategory; label: string }[] = [
  { key: 'par3', label: 'PAR 3 LEADERBOARD' },
  { key: 'par4', label: 'PAR 4 LEADERBOARD' },
  { key: 'par5', label: 'PAR 5 LEADERBOARD' },
];

const PERF_CARDS: { key: StatCategory; label: string }[] = [
  { key: 'eagles', label: 'MOST EAGLES' },
  { key: 'birdies', label: 'MOST BIRDIES' },
  { key: 'parBreakers', label: 'PAR BREAKERS' },
  { key: 'pars', label: 'MOST PARS' },
  { key: 'parsOrBetter', label: 'PARS OR BETTER' },
  { key: 'bogeys', label: 'BOGEY I WIĘCEJ' },
];

const STREAK_CARDS: { key: StatCategory; label: string }[] = [
  { key: 'birdieStreak', label: 'BIRDIE OR BETTER STREAK' },
  { key: 'bogeyFreeStreak', label: 'BOGEY FREE STREAK' },
];

const AVERAGE_CARDS: { key: StatCategory; label: string }[] = [
  { key: 'scoringAvg', label: 'SCORING AVERAGE' },
  { key: 'avgFront9', label: 'FRONT 9 AVERAGE' },
  { key: 'avgBack9', label: 'BACK 9 AVERAGE' },
];

function ScoreShape({ value, par, size = 'md' }: { value: number | null; par: number; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? '26px' : '36px';
  const fontSize = size === 'sm' ? '11px' : '14px';

  if (!value || value === 0) {
    return (
      <div style={{ width: dim, height: dim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize, fontWeight: '800', color: '#94a3b8' }}>
        –
      </div>
    );
  }

  const delta = value - par;

  if (value === 1) {
    return (
      <div style={{ position: 'relative', width: dim, height: dim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg viewBox="0 0 26 26" style={{ position: 'absolute', width: size === 'sm' ? '28px' : '40px', height: size === 'sm' ? '28px' : '40px', left: '-1px', top: '-1px' }}>
          <g transform="translate(1,1)">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#fff" stroke="#000" strokeWidth="4" strokeLinejoin="round" />
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#fff" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#fff" stroke="#000" strokeWidth="1" strokeLinejoin="round" />
          </g>
        </svg>
        <span style={{ position: 'relative', zIndex: 1, color: '#000', fontSize, fontWeight: '900' }}>{value}</span>
      </div>
    );
  }

  let style: React.CSSProperties = {
    width: dim,
    height: dim,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize,
    fontWeight: '900',
    color: '#0f172a',
  };

  if (delta <= -2) {
    style = { ...style, borderRadius: '50%', backgroundColor: '#ef4444', border: '1.5px solid #000', color: '#fff' };
  } else if (delta === -1) {
    style = { ...style, borderRadius: '50%', backgroundColor: '#fca5a5', color: '#000' };
  } else if (delta === 0) {
    style = { ...style, background: 'transparent' };
  } else if (delta === 1) {
    style = { ...style, backgroundColor: '#e2e8f0', color: '#000', borderRadius: '4px' };
  } else if (delta >= 2) {
    style = { ...style, backgroundColor: '#94a3b8', color: '#fff', borderRadius: '4px' };
  }

  return <div style={style}>{value}</div>;
}

const StatMiniScorecard = memo(function StatMiniScorecard({
  player,
  statKey,
  holesR1,
  holesR2,
  round2Started,
}: {
  player: Player;
  statKey: StatCategory;
  holesR1: Hole[];
  holesR2: Hole[];
  round2Started?: boolean;
}) {
  const hasR2Scores = player.scores[2] && player.scores[2].some((s) => s > 0);
  const r2Enabled = Boolean(round2Started || hasR2Scores);

  const [round, setRound] = useState<Round>(r2Enabled && round2Started ? 2 : 1);
  const holes = round === 1 ? holesR1 : holesR2;
  const scores = player.scores[round] || [];

  const targetHoleIndices = useMemo(() => {
    const indices: number[] = [];
    holes.forEach((h, idx) => {
      const s = scores[idx] || 0;
      if (statKey === 'par3' && h.par === 3) indices.push(idx);
      else if (statKey === 'par4' && h.par === 4) indices.push(idx);
      else if (statKey === 'par5' && h.par === 5) indices.push(idx);
      else if (statKey === 'out' || statKey === 'avgFront9') {
        if (idx < 9) indices.push(idx);
      } else if (statKey === 'inn' || statKey === 'avgBack9') {
        if (idx >= 9) indices.push(idx);
      } else if (statKey === 'birdies' && s > 0 && s - h.par === -1) {
        indices.push(idx);
      } else if (statKey === 'eagles' && s > 0 && s - h.par <= -2) {
        indices.push(idx);
      } else if ((statKey === 'parBreakers' || statKey === 'birdieStreak') && s > 0 && s - h.par <= -1) {
        indices.push(idx);
      } else if (statKey === 'pars' && s > 0 && s - h.par === 0) {
        indices.push(idx);
      } else if (statKey === 'parsOrBetter' && s > 0 && s - h.par <= 0) {
        indices.push(idx);
      } else if (statKey === 'bogeys' && s > 0 && s - h.par >= 1) {
        indices.push(idx);
      } else if (statKey === 'total' || statKey === 'scoringAvg' || statKey === 'bogeyFreeStreak') {
        indices.push(idx);
      }
    });
    return indices;
  }, [holes, scores, statKey]);

  const playedIndices = targetHoleIndices.filter((idx) => (scores[idx] || 0) > 0);
  const subtotalScore = playedIndices.reduce((acc, idx) => acc + (scores[idx] || 0), 0);
  const subtotalPar = playedIndices.reduce((acc, idx) => acc + holes[idx].par, 0);
  const subtotalRel = playedIndices.length > 0 ? subtotalScore - subtotalPar : 0;

  return (
    <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px', marginTop: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '10px', fontWeight: 800, color: '#475569' }}>RUNDA:</span>
          {ROUNDS.map((r) => {
            const isDisabled = r === 2 && !r2Enabled;
            return (
              <button
                key={r}
                type="button"
                onClick={() => !isDisabled && setRound(r)}
                disabled={isDisabled}
                style={{
                  padding: '3px 10px',
                  borderRadius: '4px',
                  border: '1px solid',
                  borderColor: round === r ? '#0284c7' : '#cbd5e1',
                  background: round === r ? '#0284c7' : isDisabled ? '#f1f5f9' : '#ffffff',
                  color: round === r ? '#ffffff' : isDisabled ? '#94a3b8' : '#0f172a',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  opacity: isDisabled ? 0.6 : 1,
                }}
              >
                R{r}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a' }}>
          Do Par:{' '}
          <span style={{ color: subtotalRel < 0 ? '#ef4444' : '#0f172a' }}>
            {playedIndices.length > 0 ? relativeLabel(subtotalRel) : '–'}
          </span>{' '}
          ({subtotalScore > 0 ? `${subtotalScore} ud.` : 'brak wyników'})
        </div>
      </div>

      {targetHoleIndices.length === 0 ? (
        <div style={{ padding: '8px', textAlign: 'center', color: '#94a3b8', fontSize: '11px' }}>
          Brak dołków spełniających to kryterium w Rundzie {round}.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '11px' }}>
            <thead>
              <tr style={{ background: '#e2e8f0', color: '#475569' }}>
                <th style={{ padding: '4px', border: '1px solid #cbd5e1', fontWeight: 800 }}>#</th>
                {targetHoleIndices.map((idx) => (
                  <th key={idx} style={{ padding: '4px', border: '1px solid #cbd5e1', minWidth: '32px' }}>
                    {holes[idx].number}
                  </th>
                ))}
                <th style={{ padding: '4px', border: '1px solid #cbd5e1', fontWeight: 800 }}>SUM</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '4px', border: '1px solid #cbd5e1', fontWeight: 800, color: '#64748b' }}>Par</td>
                {targetHoleIndices.map((idx) => (
                  <td key={idx} style={{ padding: '4px', border: '1px solid #cbd5e1', color: '#64748b', fontWeight: 700 }}>
                    {holes[idx].par}
                  </td>
                ))}
                <td style={{ padding: '4px', border: '1px solid #cbd5e1', fontWeight: 800, color: '#64748b' }}>
                  {targetHoleIndices.reduce((acc, idx) => acc + holes[idx].par, 0)}
                </td>
              </tr>
              <tr style={{ background: '#ffffff' }}>
                <td style={{ padding: '4px', border: '1px solid #cbd5e1', fontWeight: 900, color: '#0284c7' }}>R{round}</td>
                {targetHoleIndices.map((idx) => (
                  <td key={idx} style={{ padding: '2px', border: '1px solid #cbd5e1' }}>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <ScoreShape value={scores[idx] || 0} par={holes[idx].par} size="sm" />
                    </div>
                  </td>
                ))}
                <td style={{ padding: '4px', border: '1px solid #cbd5e1', fontWeight: 900, color: '#0284c7' }}>
                  {subtotalScore || '–'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
});

export function PlayerModal({
  player,
  store,
  rank = 0,
  initialTab = 'personal',
  hideScorecardTab = false,
  tournaments = [],
  leaguePoints = [],
  onClose,
}: {
  player: Player;
  store: Store;
  rank?: number;
  initialTab?: 'scorecard' | 'personal' | 'rankings' | 'tournaments';
  hideScorecardTab?: boolean;
  tournaments?: Tournament[];
  leaguePoints?: any[];
  onClose: () => void;
}) {
  const holesR1 = (store.holesByRound[1] && store.holesByRound[1].length > 0)
    ? store.holesByRound[1]
    : (store.holesByRound[2] || []);

  const holesR2 = (store.holesByRound[2] && store.holesByRound[2].length > 0)
    ? store.holesByRound[2]
    : holesR1;

  const [activeView, setActiveView] = useState<'scorecard' | 'personal' | 'rankings' | 'tournaments'>(
    hideScorecardTab ? (initialTab === 'scorecard' ? 'personal' : initialTab) : initialTab
  );
  const [modalTab, setModalTab] = useState<'rozpiska' | 'statystyki'>('rozpiska');

  const [roundTab, setRoundTab] = useState<Round>(() => {
    if (store.round2Started) return 2;
    const hasR2Scores = player.scores[2] && player.scores[2].some((s) => s > 0);
    return hasR2Scores ? 2 : 1;
  });

  const [statCategoryFilter, setStatCategoryFilter] = useState<Category | 'Wszystkie'>('Wszystkie');
  const [inspectedHole, setInspectedHole] = useState<number | null>(null);
  const [showPhotoLightbox, setShowPhotoLightbox] = useState(false);
  const [activeStatCategory, setActiveStatCategory] = useState<{ key: StatCategory; label: string } | null>(null);
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);

  const holes = roundTab === 1 ? holesR1 : holesR2;

  const activeTourneyPlayers = useMemo(() => {
    const active = store.players.filter((p) => p.isActive !== false);
    if (statCategoryFilter === 'Wszystkie') return active;
    return active.filter((p) => p.category === statCategoryFilter);
  }, [store.players, statCategoryFilter]);

  // LAZY: wyliczamy rangę TYLKO wtedy, gdy użytkownik jest w zakładce statystyk
  const statRankCache = useMemo(() => {
    if (activeView !== 'scorecard' || modalTab !== 'statystyki') {
      return new Map<StatCategory, Map<string, number>>();
    }
    const map = new Map<StatCategory, Map<string, number>>();
    [...TOTAL_CARDS, ...PAR_CARDS, ...PERF_CARDS, ...STREAK_CARDS, ...AVERAGE_CARDS].forEach((c) => {
      map.set(c.key, statRankMap(activeTourneyPlayers, holesR1, holesR2, c.key, 'combined'));
    });
    return map;
  }, [activeView, modalTab, activeTourneyPlayers, holesR1, holesR2]);

  const totalRel = useMemo(
    () => relative(player.scores[1] || [], holesR1) + relative(player.scores[2] || [], holesR2),
    [player.scores, holesR1, holesR2]
  );
  const strokes = useMemo(
    () => totalStrokes(player.scores[1] || []) + totalStrokes(player.scores[2] || []),
    [player.scores]
  );
  const par = useMemo(() => totalPar(holes), [holes]);
  const out = useMemo(() => subtotal(player.scores[roundTab] || [], holes, 0, 9), [player.scores, roundTab, holes]);
  const inn = useMemo(() => subtotal(player.scores[roundTab] || [], holes, 9, 18), [player.scores, roundTab, holes]);
  const outPar = useMemo(() => holes.slice(0, 9).reduce((a, h) => a + h.par, 0), [holes]);
  const inPar = useMemo(() => holes.slice(9, 18).reduce((a, h) => a + h.par, 0), [holes]);

  const formEntries = useMemo(
    () => recentForm(player, holesR1, holesR2, 4),
    [player, holesR1, holesR2]
  );

  const playerAge = useMemo(() => {
    if (!player.birthDate) return '–';
    const birth = new Date(player.birthDate);
    if (isNaN(birth.getTime())) return '–';
    const diff = Date.now() - birth.getTime();
    const ageDate = new Date(diff);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  }, [player.birthDate]);

  const playerHistory = useMemo(() => {
    const pIdStr = String(player.id).trim();
    const rows = (leaguePoints || []).filter((lp: any) => String(lp.player_id ?? lp.playerId ?? '').trim() === pIdStr);

    let firsts = 0;
    let seconds = 0;
    let thirds = 0;
    let top10 = 0;
    let totalPoints = 0;

    const list = rows.map((lp: any) => {
      const tId = String(lp.tournament_id ?? lp.tournamentId ?? '');
      const t = (tournaments || []).find((item) => String(item.id) === tId);
      const r = Number(lp.rank) || 1;
      const pts = Number(lp.points) || 0;

      if (r === 1) firsts++;
      if (r === 2) seconds++;
      if (r === 3) thirds++;
      if (r <= 10) top10++;
      totalPoints += pts;

      return {
        id: tId,
        name: t?.name || 'Turniej Ligi PFFG',
        date: t?.date || '2026-01-01',
        courseName: t?.courseName || 'Pole Turniejowe PFFG',
        rank: r,
        points: pts,
      };
    });

    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      events: list.length,
      firsts,
      seconds,
      thirds,
      top10,
      totalPoints,
      list,
    };
  }, [player.id, leaguePoints, tournaments]);

  const cumulativeRelativeScores = useMemo(() => {
    const currentRoundScores = player.scores[roundTab] || [];
    let runningRel = 0;
    return holes.map((h, idx) => {
      const s = currentRoundScores[idx] || 0;
      if (s === 0) return null;
      runningRel += (s - h.par);
      return runningRel;
    });
  }, [player.scores, roundTab, holes]);

  const renderStatCard = (card: { key: StatCategory; label: string }) => {
    const result = combinedStat(player, holesR1, holesR2, card.key);
    const rankVal = statRankCache.get(card.key)?.get(player.id);
    const allRanksForStat = Array.from(statRankCache.get(card.key)?.values() ?? []);

    const isTop5 = rankVal !== undefined && rankVal <= 5;
    const display = rankDisplay(rankVal, allRanksForStat);

    return (
      <div
        key={card.key}
        onClick={() => {
          setActiveStatCategory(card);
          setExpandedPlayerId(null);
        }}
        className="stat-card-item"
        style={{
          cursor: 'pointer',
          padding: '10px 12px',
          borderRadius: '10px',
          background: '#ffffff',
          border: '1px solid #cbd5e1',
          boxShadow: '0 2px 4px rgba(15, 23, 42, 0.03)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '68px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '4px', marginBottom: '4px' }}>
          <span style={{ fontWeight: 800, color: '#64748b', fontSize: '9.5px', letterSpacing: '0.02em', lineHeight: '1.2' }}>
            {card.label}
          </span>
          <span
            style={{
              background: isTop5 ? '#16a34a' : '#0f172a',
              color: '#ffffff',
              padding: '2px 5px',
              borderRadius: '4px',
              fontSize: '9px',
              fontWeight: 900,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {display}
          </span>
        </div>
        <strong style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', display: 'block', lineHeight: 1 }}>
          {result.display}
        </strong>
      </div>
    );
  };

  const renderHoleCell = (h: { number: number; par: number; meters: number }, idx: number) => {
    const score = player.scores[roundTab]?.[idx] || 0;
    const isActive = inspectedHole === idx;
    const runningRel = cumulativeRelativeScores[idx];

    return (
      <button
        key={h.number}
        onClick={() => setInspectedHole(isActive ? null : idx)}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1px',
          padding: '3px 1px',
          border: isActive ? '1px solid #0f172a' : '1px solid transparent',
          borderRadius: '5px',
          background: isActive ? '#f1f5f9' : 'transparent',
          cursor: 'pointer',
          width: '100%',
        }}
      >
        <small style={{ fontWeight: 800, color: '#64748b', fontSize: '10px' }}>{h.number}</small>
        <ScoreShape value={score} par={h.par} size="sm" />
        <em style={{ fontSize: '10px', fontStyle: 'normal', color: '#64748b', fontWeight: 800 }}>
          {runningRel !== null ? relativeLabel(runningRel) : '–'}
        </em>
      </button>
    );
  };

  const inspectedStats = useMemo(() => {
    if (inspectedHole === null) return null;
    return holeStats(activeTourneyPlayers, holes, roundTab, inspectedHole);
  }, [inspectedHole, activeTourneyPlayers, holes, roundTab]);

  const inspectedHoleData = inspectedHole !== null ? holes[inspectedHole] : null;

  const categoryLeaderboard = useMemo(() => {
    if (!activeStatCategory) return [];
    return [...activeTourneyPlayers]
      .map((p) => {
        const stat = combinedStat(p, holesR1, holesR2, activeStatCategory.key);
        return {
          player: p,
          value: stat.value,
          display: stat.display,
        };
      })
      .sort((a, b) => a.value - b.value);
  }, [activeStatCategory, activeTourneyPlayers, holesR1, holesR2]);

  return (
    <>
      <div className="modal-overlay player-modal-overlay" onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }}>
        <style>{`
          .player-modal-overlay {
            overflow-x: hidden;
          }
          .player-modal-panel {
            border-radius: 14px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            max-height: 92vh;
            width: 100%;
            max-width: 740px;
            background: #ffffff;
            border: 1px solid #cbd5e1;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          }
          .mobile-form-flames-bar {
            display: flex;
          }
          .header-nav-row {
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .modal-close-main {
            background: #f1f5f9;
            border: 1.5px solid #cbd5e1;
            border-radius: 50%;
            width: 44px;
            height: 44px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            color: #0f172a;
            box-shadow: 0 2px 6px rgba(0,0,0,0.08);
            flex-shrink: 0;
          }
          .stats-grid-container {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
          }
          .stats-grid-two {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
          }

          @media (max-width: 640px) {
            .player-modal-overlay {
              padding: 0 !important;
            }
            .player-modal-panel {
              max-height: 100vh !important;
              height: 100vh !important;
              border-radius: 0 !important;
              border: none !important;
            }
            .player-modal-header {
              padding: 10px 12px 8px 12px !important;
            }
            .header-main-layout {
              flex-direction: column-reverse !important;
              gap: 8px !important;
              align-items: stretch !important;
            }
            .header-nav-row {
              justify-content: space-between !important;
              width: 100% !important;
            }
            .modal-close-main {
              width: 38px !important;
              height: 38px !important;
            }
            .player-modal-body {
              padding: 10px 10px !important;
            }
            .player-nav-tabs button {
              padding: 4px 8px !important;
              font-size: 11px !important;
            }
            .mobile-form-flames-bar {
              display: none !important;
            }
            .modal-summary-bar {
              padding: 8px 10px !important;
              gap: 4px !important;
              margin-bottom: 8px !important;
            }
            .modal-summary-bar strong {
              font-size: 16px !important;
            }
            .modal-hole-grid {
              gap: 1px !important;
              padding: 4px 1px !important;
            }
            .modal-summary-line {
              padding: 6px 8px !important;
              font-size: 10px !important;
              margin-bottom: 6px !important;
            }
            .modal-summary-line.total {
              padding: 8px 10px !important;
              font-size: 11px !important;
            }
            .hole-inspection-body {
              grid-template-columns: 1fr !important;
              gap: 8px !important;
            }
            .hole-distribution {
              border-left: none !important;
              border-top: 1px solid #e2e8f0 !important;
              padding-left: 0 !important;
              padding-top: 8px !important;
            }
            .stats-grid-container {
              grid-template-columns: repeat(2, 1fr) !important;
              gap: 6px !important;
            }
            .stats-grid-two {
              grid-template-columns: 1fr !important;
              gap: 6px !important;
            }
            .stat-card-item {
              padding: 8px 10px !important;
              min-height: 62px !important;
            }
            .stat-card-item strong {
              font-size: 16px !important;
            }
          }
        `}</style>

        <div
          className="modal-panel player-modal-panel"
          onClick={(e) => e.stopPropagation()}
        >
          {/* HEADER ZAWODNIKA */}
          <div className="player-modal-header" style={{ padding: '16px 20px', background: '#ffffff', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
            <div className="header-main-layout" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                {player.avatar ? (
                  <div style={{ position: 'relative', cursor: 'pointer', flexShrink: 0 }} onClick={() => setShowPhotoLightbox(true)} title="Powiększ zdjęcie">
                    <img src={player.avatar} alt={player.name} style={{ width: '46px', height: '46px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }} />
                    <div style={{ position: 'absolute', bottom: '0', right: '0', background: '#0f172a', color: '#fff', borderRadius: '50%', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ZoomIn size={9} />
                    </div>
                  </div>
                ) : (
                  <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: '#f1f5f9', border: '2px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '15px', color: '#64748b', flexShrink: 0 }}>
                    {player.name.slice(0, 2).toUpperCase()}
                  </div>
                )}

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    {player.flagImage ? (
                      <img src={player.flagImage} alt={player.flag} style={{ width: '18px', height: '12px', borderRadius: '2px', objectFit: 'cover', border: '1px solid #cbd5e1', flexShrink: 0 }} />
                    ) : (
                      <span className="flag-emoji" style={{ border: '1px solid #cbd5e1', borderRadius: '2px', padding: '1px 2px', lineHeight: 1, fontSize: '11px', flexShrink: 0 }}>{flagEmoji(player.flag)}</span>
                    )}
                    <h1 style={{ fontSize: '16px', fontWeight: 900, margin: 0, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {player.name}
                    </h1>
                    {player.isAmateur && (
                      <span style={{ fontSize: '9px', background: '#7ea128', color: '#fff', padding: '1px 4px', borderRadius: '3px', fontWeight: 800, flexShrink: 0 }}>
                        AM
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginTop: '2px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <span>Wiek: <b>{playerAge}</b></span>
                    <span>Miejscowość: <b>{player.city ? `${player.city}, ${player.flag}` : player.flag}</b></span>
                  </div>
                </div>
              </div>

              <div className="header-nav-row">
                <div className="player-nav-tabs" style={{ display: 'flex', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '30px', padding: '2px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                  <button
                    onClick={() => setActiveView('personal')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '20px',
                      border: 'none',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: activeView === 'personal' ? '#0284c7' : 'transparent',
                      color: activeView === 'personal' ? '#ffffff' : '#0284c7',
                    }}
                  >
                    Profil
                  </button>
                  <button
                    onClick={() => setActiveView('tournaments')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '20px',
                      border: 'none',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: activeView === 'tournaments' ? '#0284c7' : 'transparent',
                      color: activeView === 'tournaments' ? '#ffffff' : '#0284c7',
                    }}
                  >
                    Turnieje
                  </button>
                  <button
                    onClick={() => setActiveView('rankings')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '20px',
                      border: 'none',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: activeView === 'rankings' ? '#0284c7' : 'transparent',
                      color: activeView === 'rankings' ? '#ffffff' : '#0284c7',
                    }}
                  >
                    Rankingi
                  </button>
                  {!hideScorecardTab && (
                    <button
                      onClick={() => setActiveView('scorecard')}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '20px',
                        border: 'none',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        background: activeView === 'scorecard' ? '#0284c7' : 'transparent',
                        color: activeView === 'scorecard' ? '#ffffff' : '#64748b',
                      }}
                    >
                      Karta
                    </button>
                  )}
                </div>

                <button className="modal-close-main" onClick={onClose} title="Zamknij">
                  <X size={22} />
                </button>
              </div>
            </div>
          </div>

          {/* GŁÓWNA ZAWARTOŚĆ OKNA */}
          <div className="player-modal-body" style={{ padding: '14px 18px', overflowY: 'auto', overflowX: 'hidden', flex: 1, background: '#fcfdfd' }}>
            {/* ZAKŁADKA 1: PROFIL */}
            {activeView === 'personal' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    DANE ZAWODNIKA
                  </h3>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <div style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9' }}>
                    <small style={{ fontSize: '10px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>WIEK</small>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>{playerAge}</div>
                  </div>

                  <div style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9' }}>
                    <small style={{ fontSize: '10px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>MIEJSCOWOŚĆ / KRAJ</small>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                      {player.city ? `${player.city}, ${player.flag}` : player.flag}
                    </div>
                  </div>

                  <div style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9' }}>
                    <small style={{ fontSize: '10px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>KLUB FOOTGOLFA</small>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                      {player.club ?? 'Brak'}
                    </div>
                  </div>

                  <div style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9' }}>
                    <small style={{ fontSize: '10px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>MODEL PIŁKI MECZOWEJ</small>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#0284c7', marginTop: '2px' }}>
                      {player.ballModel || (player as any).ball_model || 'Nie podano'}
                    </div>
                  </div>

                  <div style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <small style={{ fontSize: '10px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>LEPSZA NOGA</small>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                        {player.preferredFoot === 'Left' ? 'Lewa' : player.preferredFoot === 'Right' ? 'Prawa' : 'Prawa'}
                      </div>
                    </div>
                    <div>
                      <small style={{ fontSize: '10px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>PŁEĆ</small>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                        {player.gender === 'Female' ? 'Kobieta' : 'Mężczyzna'}
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: '10px 12px' }}>
                    <small style={{ fontSize: '10px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>STATUS LICENCJI</small>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: player.isAmateur ? '#7ea128' : '#0284c7', marginTop: '2px' }}>
                      {player.isAmateur ? 'Amator (AM)' : 'PRO / Zawodnik Licencjonowany'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ZAKŁADKA 2: RANKINGI */}
            {activeView === 'rankings' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    OFICJALNE RANKINGI LIGI PFFG 2026
                  </h3>
                </div>

                <div style={{ overflowX: 'auto', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', WebkitOverflowScrolling: 'touch' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left', minWidth: '450px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }}>
                        <th style={{ padding: '8px 10px' }}>Ranking</th>
                        <th style={{ padding: '8px 6px', textAlign: 'center' }}>Kategoria</th>
                        <th style={{ padding: '8px 6px', textAlign: 'center' }}>Turnieje</th>
                        <th style={{ padding: '8px 6px', textAlign: 'center' }}>1. m.</th>
                        <th style={{ padding: '8px 6px', textAlign: 'center' }}>2. m.</th>
                        <th style={{ padding: '8px 6px', textAlign: 'center' }}>3. m.</th>
                        <th style={{ padding: '8px 6px', textAlign: 'center' }}>TOP 10</th>
                        <th style={{ padding: '8px 6px', textAlign: 'center', color: '#0284c7' }}>Punkty</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Pozycja</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 800, color: '#0284c7' }}>Liga PFFG</td>
                        <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                          <span style={{ padding: '2px 6px', borderRadius: '10px', background: '#0b1329', color: '#ffffff', fontSize: '10px', fontWeight: 800 }}>Absolut</span>
                        </td>
                        <td style={{ padding: '8px 6px', textAlign: 'center' }}>{playerHistory.events}</td>
                        <td style={{ padding: '8px 6px', textAlign: 'center' }}>{playerHistory.firsts || '–'}</td>
                        <td style={{ padding: '8px 6px', textAlign: 'center' }}>{playerHistory.seconds || '–'}</td>
                        <td style={{ padding: '8px 6px', textAlign: 'center' }}>{playerHistory.thirds || '–'}</td>
                        <td style={{ padding: '8px 6px', textAlign: 'center' }}>{playerHistory.top10 || '–'}</td>
                        <td style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 800, color: '#0284c7' }}>{playerHistory.totalPoints.toFixed(2)}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                          {rank === 1 ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '4px', background: '#fef08a', color: '#854d0e', fontWeight: 900, fontSize: '11px', border: '1px solid #fde047' }}>1</span>
                          ) : rank === 2 ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '4px', background: '#f1f5f9', color: '#334155', fontWeight: 900, fontSize: '11px', border: '1px solid #cbd5e1' }}>2</span>
                          ) : rank === 3 ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '4px', background: '#ffedd5', color: '#9a3412', fontWeight: 900, fontSize: '11px', border: '1px solid #fed7aa' }}>3</span>
                          ) : (
                            <span style={{ fontWeight: 800, fontSize: '12px', color: '#0f172a' }}>{rank > 0 ? rank : '–'}</span>
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '8px 10px', fontWeight: 800, color: '#0284c7' }}>Liga PFFG</td>
                        <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                          <span style={{ padding: '2px 6px', borderRadius: '10px', background: '#0284c7', color: '#ffffff', fontSize: '10px', fontWeight: 800 }}>{player.category}</span>
                        </td>
                        <td style={{ padding: '8px 6px', textAlign: 'center' }}>{playerHistory.events}</td>
                        <td style={{ padding: '8px 6px', textAlign: 'center' }}>{playerHistory.firsts || '–'}</td>
                        <td style={{ padding: '8px 6px', textAlign: 'center' }}>{playerHistory.seconds || '–'}</td>
                        <td style={{ padding: '8px 6px', textAlign: 'center' }}>{playerHistory.thirds || '–'}</td>
                        <td style={{ padding: '8px 6px', textAlign: 'center' }}>{playerHistory.top10 || '–'}</td>
                        <td style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 800, color: '#0284c7' }}>{playerHistory.totalPoints.toFixed(2)}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                          {rank === 1 ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '4px', background: '#fef08a', color: '#854d0e', fontWeight: 900, fontSize: '11px', border: '1px solid #fde047' }}>1</span>
                          ) : rank === 2 ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '4px', background: '#f1f5f9', color: '#334155', fontWeight: 900, fontSize: '11px', border: '1px solid #cbd5e1' }}>2</span>
                          ) : rank === 3 ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '4px', background: '#ffedd5', color: '#9a3412', fontWeight: 900, fontSize: '11px', border: '1px solid #fed7aa' }}>3</span>
                          ) : (
                            <span style={{ fontWeight: 800, fontSize: '12px', color: '#0f172a' }}>{rank > 0 ? rank : '–'}</span>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ZAKŁADKA 3: TURNIEJE */}
            {activeView === 'tournaments' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    ROZEGRANE TURNIEJE 2026 ({playerHistory.list.length})
                  </h3>
                </div>

                <div style={{ overflowX: 'auto', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', WebkitOverflowScrolling: 'touch' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left', minWidth: '400px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }}>
                        <th style={{ padding: '8px 10px' }}>Data</th>
                        <th style={{ padding: '8px 10px' }}>Turniej</th>
                        <th style={{ padding: '8px 10px' }}>Pole</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center' }}>Miejsce</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', color: '#0284c7' }}>Punkty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {playerHistory.list.map((t) => (
                        <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 10px', color: '#64748b', whiteSpace: 'nowrap' }}>{t.date}</td>
                          <td style={{ padding: '8px 10px', fontWeight: 800, color: '#0284c7' }}>{t.name}</td>
                          <td style={{ padding: '8px 10px', color: '#475569' }}>{t.courseName}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            {t.rank === 1 ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '4px', background: '#fef08a', color: '#854d0e', fontWeight: 900, fontSize: '11px', border: '1px solid #fde047' }}>
                                1
                              </span>
                            ) : t.rank === 2 ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '4px', background: '#f1f5f9', color: '#334155', fontWeight: 900, fontSize: '11px', border: '1px solid #cbd5e1' }}>
                                2
                              </span>
                            ) : t.rank === 3 ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '4px', background: '#ffedd5', color: '#9a3412', fontWeight: 900, fontSize: '11px', border: '1px solid #fed7aa' }}>
                                3
                              </span>
                            ) : (
                              <span style={{ fontWeight: 800, fontSize: '12px', color: '#0f172a' }}>
                                {t.rank}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 900, color: '#0284c7', fontSize: '12px' }}>
                            {t.points.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                      {playerHistory.list.length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ padding: '14px', textAlign: 'center', color: '#94a3b8' }}>
                            Brak zakończonych turniejów z wynikami.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ZAKŁADKA 4: KARTA WYNIKÓW I STATYSTYKI */}
            {activeView === 'scorecard' && (
              <>
                <div className="modal-summary-bar" style={{ background: '#ffffff', padding: '10px 12px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', border: '1px solid #e2e8f0', borderRadius: '8px', textAlign: 'center', marginBottom: '10px' }}>
                  <div>
                    <small style={{ color: '#64748b', fontWeight: '800', fontSize: '9px' }}>UDERZENIA</small>
                    <strong style={{ fontSize: '18px', fontWeight: '900', display: 'block', color: '#0f172a' }}>{strokes || '–'}</strong>
                  </div>
                  <div>
                    <small style={{ color: '#64748b', fontWeight: '800', fontSize: '9px' }}>DO PAR</small>
                    <strong style={{ fontSize: '18px', fontWeight: '900', display: 'block', color: totalRel < 0 ? '#ef4444' : '#0f172a' }}>
                      {relativeLabel(totalRel)}
                    </strong>
                  </div>
                  <div>
                    <small style={{ color: '#64748b', fontWeight: '800', fontSize: '9px' }}>PAR POLA</small>
                    <strong style={{ fontSize: '18px', fontWeight: '900', display: 'block', color: '#0f172a' }}>{par}</strong>
                  </div>
                </div>

                <div className="form-badge-bar mobile-form-flames-bar" style={{ padding: '8px 12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '6px' }}>
                  <small style={{ color: '#64748b', fontWeight: '800', fontSize: '9px' }}>FORMA (OSTATNIE DOŁKI)</small>
                  <div className="form-flames" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {formEntries.length === 0 && <span className="muted" style={{ fontSize: '11px', color: '#94a3b8' }}>Brak wyników</span>}
                    {formEntries.map((e, i) => (
                      <span
                        key={i}
                        className={`form-chip ${e.delta < 0 ? 'hot' : e.delta === 0 ? 'neutral' : 'cold'}`}
                        style={{
                          padding: '2px 6px',
                          borderRadius: '12px',
                          fontSize: '10px',
                          fontWeight: '700',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          background: e.delta < 0 ? '#fef2f2' : e.delta === 0 ? '#f8fafc' : '#f1f5f9',
                          color: e.delta < 0 ? '#ef4444' : e.delta === 0 ? '#475569' : '#64748b',
                        }}
                      >
                        {e.delta < 0 ? <Flame size={11} color="#ef4444" /> : null}
                        {e.delta <= -1
                          ? 'Birdie'
                          : e.delta === 0
                            ? 'Par'
                            : e.delta === 1
                              ? 'Bogey'
                              : `${e.delta > 0 ? '+' : ''}${e.delta}`}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="modal-tabs" style={{ display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: '3px', marginBottom: '10px' }}>
                  <button
                    className={modalTab === 'rozpiska' ? 'active' : ''}
                    onClick={() => setModalTab('rozpiska')}
                    style={{ flex: 1, padding: '6px 8px', fontWeight: '800', fontSize: '11px', border: 'none', borderRadius: '6px', background: modalTab === 'rozpiska' ? '#ffffff' : 'transparent', color: modalTab === 'rozpiska' ? '#0f172a' : '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', boxShadow: modalTab === 'rozpiska' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none' }}
                  >
                    <BarChart3 size={13} /> Rozpiska dołków
                  </button>
                  <button
                    className={modalTab === 'statystyki' ? 'active' : ''}
                    onClick={() => setModalTab('statystyki')}
                    style={{ flex: 1, padding: '6px 8px', fontWeight: '800', fontSize: '11px', border: 'none', borderRadius: '6px', background: modalTab === 'statystyki' ? '#ffffff' : 'transparent', color: modalTab === 'statystyki' ? '#0f172a' : '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', boxShadow: modalTab === 'statystyki' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none' }}
                  >
                    <TrendingDown size={13} /> Tabele statystyk
                  </button>
                </div>

                {modalTab === 'rozpiska' && (
                  <div className="modal-section">
                    <div className="round-switcher" style={{ marginBottom: '8px' }}>
                      {ROUNDS.map((r) => (
                        <button
                          key={r}
                          className={roundTab === r ? 'active' : ''}
                          onClick={() => {
                            setRoundTab(r);
                            setInspectedHole(null);
                          }}
                          disabled={r === 2 && !store.round2Started}
                        >
                          Runda {r}
                        </button>
                      ))}
                    </div>

                    <p className="modal-section-title" style={{ fontSize: '10px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px' }}>
                      <Info size={12} /> Kliknij dołek, aby zobaczyć statystyki turniejowe
                    </p>

                    <div className="modal-hole-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: '1px', background: '#ffffff', padding: '4px 1px', borderRadius: '8px 8px 0 0', border: '1px solid #e2e8f0', borderBottom: 'none' }}>
                      {holes.slice(0, 9).map((h, i) => renderHoleCell(h, i))}
                    </div>
                    <div className="modal-summary-line" style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', fontSize: '11px', fontWeight: '800', color: '#ffffff', background: '#0b1329', borderRadius: '0 0 8px 8px', marginBottom: '8px' }}>
                      <span style={{ letterSpacing: '0.04em' }}>SUMA OUT</span>
                      <span style={{ color: '#38bdf8' }}>
                        {out.sum || '–'} uderzeń / Par {outPar}
                        {out.sum ? ` (${relativeLabel(out.rel)})` : ''}
                      </span>
                    </div>

                    <div className="modal-hole-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: '1px', background: '#ffffff', padding: '4px 1px', borderRadius: '8px 8px 0 0', border: '1px solid #e2e8f0', borderBottom: 'none' }}>
                      {holes.slice(9, 18).map((h, i) => renderHoleCell(h, i + 9))}
                    </div>
                    <div className="modal-summary-line" style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', fontSize: '11px', fontWeight: '800', color: '#ffffff', background: '#0b1329', borderRadius: '0 0 8px 8px', marginBottom: '8px' }}>
                      <span style={{ letterSpacing: '0.04em' }}>SUMA IN</span>
                      <span style={{ color: '#38bdf8' }}>
                        {inn.sum || '–'} uderzeń / Par {inPar}
                        {inn.sum ? ` (${relativeLabel(inn.rel)})` : ''}
                      </span>
                    </div>

                    <div className="modal-summary-line total" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#1e293b', borderRadius: '8px', fontSize: '11px', fontWeight: '800', color: '#fff' }}>
                      <span>ŁĄCZNIE (R{roundTab})</span>
                      <span style={{ color: '#38bdf8' }}>
                        {totalStrokes(player.scores[roundTab] || []) || '–'} uderzenia / Par {par}{' '}
                        {totalStrokes(player.scores[roundTab] || [])
                          ? `(${relativeLabel(relative(player.scores[roundTab] || [], holes))})`
                          : ''}
                      </span>
                    </div>

                    {inspectedStats && inspectedHoleData && (
                      <div className="hole-inspection-panel" style={{ marginTop: '12px', padding: '12px', borderRadius: '8px', background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                        <div className="hole-inspection-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <div>
                            <p className="eyebrow" style={{ fontSize: '9px', color: '#64748b', margin: 0, fontWeight: '700' }}>
                              DOŁEK {inspectedHoleData.number} · PAR {inspectedHoleData.par} · {inspectedHoleData.meters} M
                            </p>
                            <h3 style={{ fontSize: '13px', margin: '2px 0 0 0', fontWeight: '800', color: '#0f172a' }}>Statystyki turniejowe dołka</h3>
                          </div>
                          <button className="modal-close sm" onClick={() => setInspectedHole(null)} style={{ border: 'none', background: '#f1f5f9', borderRadius: '50%', padding: '3px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <X size={14} />
                          </button>
                        </div>

                        <div className="hole-inspection-body" style={{ display: 'grid', gridTemplateColumns: '100px 120px 1fr', gap: '10px', alignItems: 'center' }}>
                          <div className="hole-inspect-avg" style={{ textAlign: 'center', padding: '6px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                            <small style={{ color: '#64748b', fontSize: '9px', fontWeight: '800', display: 'block', marginBottom: '2px' }}>ŚREDNIA</small>
                            <strong style={{ fontSize: '17px', fontWeight: '900', color: '#0f172a', display: 'block', lineHeight: '1.1' }}>
                              {inspectedStats.total > 0 ? inspectedStats.avg.toFixed(2) : '–'}
                            </strong>
                            <small style={{ color: '#94a3b8', fontSize: '8px', display: 'block', marginTop: '1px' }}>wszyscy</small>
                          </div>

                          <div className="hole-par-ring" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <div
                              style={{
                                width: '44px',
                                height: '44px',
                                borderRadius: '50%',
                                background: `conic-gradient(#10b981 ${inspectedStats.parOrBetterPct}%, #e2e8f0 0)`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative',
                              }}
                            >
                              <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '10px', color: '#0f172a' }}>
                                {inspectedStats.parOrBetterPct}%
                              </div>
                            </div>
                            <small style={{ color: '#64748b', fontSize: '8px', fontWeight: '700', marginTop: '2px' }}>PAR/LEPIEJ</small>
                          </div>

                          <div className="hole-distribution" style={{ display: 'flex', flexDirection: 'column', gap: '2px', borderLeft: '1px solid #e2e8f0', paddingLeft: '10px' }}>
                            <small style={{ color: '#64748b', fontSize: '8px', fontWeight: '800', marginBottom: '1px' }}>ROZKŁAD</small>
                            {inspectedStats.eagle > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: '700', color: '#0f172a' }}>
                                <span>Eagle</span>
                                <span>{inspectedStats.eagle}</span>
                              </div>
                            )}
                            {inspectedStats.birdie > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: '700', color: '#0f172a' }}>
                                <span>Birdie</span>
                                <span>{inspectedStats.birdie}</span>
                              </div>
                            )}
                            {inspectedStats.parCount > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: '700', color: '#0f172a' }}>
                                <span>Par</span>
                                <span>{inspectedStats.parCount}</span>
                              </div>
                            )}
                            {inspectedStats.bogey > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: '700', color: '#0f172a' }}>
                                <span>Bogey</span>
                                <span>{inspectedStats.bogey}</span>
                              </div>
                            )}
                            {inspectedStats.double > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: '700', color: '#0f172a' }}>
                                <span>Double</span>
                                <span>{inspectedStats.double}</span>
                              </div>
                            )}
                            {inspectedStats.other > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: '700', color: '#0f172a' }}>
                                <span>Inne</span>
                                <span>{inspectedStats.other}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {modalTab === 'statystyki' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', paddingBottom: '4px', flexWrap: 'nowrap', WebkitOverflowScrolling: 'touch' }}>
                      {(['Wszystkie', ...CATEGORIES] as (Category | 'Wszystkie')[]).map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setStatCategoryFilter(cat)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '16px',
                            border: '1px solid',
                            borderColor: statCategoryFilter === cat ? '#1b88cc' : '#cbd5e1',
                            background: statCategoryFilter === cat ? '#eff6ff' : '#ffffff',
                            color: statCategoryFilter === cat ? '#1b88cc' : '#475569',
                            fontSize: '11px',
                            fontWeight: statCategoryFilter === cat ? 800 : 600,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                          }}
                        >
                          {cat === 'Wszystkie' ? 'Wszystkie' : cat}
                        </button>
                      ))}
                    </div>

                    <div>
                      <p style={{ fontSize: '10px', fontWeight: 900, color: '#475569', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        <TrendingDown size={12} color="#1b88cc" /> WYNIKI CAŁKOWITE
                      </p>
                      <div className="stats-grid-container">
                        {TOTAL_CARDS.map(renderStatCard)}
                      </div>
                    </div>

                    <div>
                      <p style={{ fontSize: '10px', fontWeight: 900, color: '#475569', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        <Target size={12} color="#1b88cc" /> RANKINGI WEDŁUG PAR
                      </p>
                      <div className="stats-grid-container">
                        {PAR_CARDS.map(renderStatCard)}
                      </div>
                    </div>

                    <div>
                      <p style={{ fontSize: '10px', fontWeight: 900, color: '#475569', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        <Award size={12} color="#1b88cc" /> SKUTECZNOŚĆ
                      </p>
                      <div className="stats-grid-container">
                        {PERF_CARDS.map(renderStatCard)}
                      </div>
                    </div>

                    <div>
                      <p style={{ fontSize: '10px', fontWeight: 900, color: '#475569', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        <Zap size={12} color="#f59e0b" /> SERIE (STREAKS)
                      </p>
                      <div className="stats-grid-two">
                        {STREAK_CARDS.map(renderStatCard)}
                      </div>
                    </div>

                    <div>
                      <p style={{ fontSize: '10px', fontWeight: 900, color: '#475569', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        <BarChart3 size={12} color="#0284c7" /> ŚREDNIE UDERZEŃ
                      </p>
                      <div className="stats-grid-container">
                        {AVERAGE_CARDS.map(renderStatCard)}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* MODAL KLASYFIKACJI STATYSTYK */}
      {activeStatCategory && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '10px',
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setActiveStatCategory(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '14px',
              width: '100%',
              maxWidth: '620px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            }}
          >
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0b1329', color: '#ffffff' }}>
              <div>
                <small style={{ color: '#38bdf8', fontSize: '9px', fontWeight: '800', letterSpacing: '0.04em' }}>
                  TABLICA STATYSTYCZNA PFFG · {statCategoryFilter.toUpperCase()}
                </small>
                <h3 style={{ margin: '2px 0 0 0', fontSize: '15px', fontWeight: '900', color: '#ffffff' }}>
                  {activeStatCategory.label}
                </h3>
              </div>
              <button
                onClick={() => setActiveStatCategory(null)}
                style={{
                  border: 'none',
                  background: '#1e293b',
                  color: '#ffffff',
                  borderRadius: '50%',
                  width: '42px',
                  height: '42px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
                title="Zamknij"
              >
                <X size={24} />
              </button>
            </div>

            <div style={{ overflowY: 'auto', padding: '10px 12px', flex: 1, background: '#f8fafc', WebkitOverflowScrolling: 'touch' }}>
              {categoryLeaderboard.map((item, idx) => {
                const isCurrentPlayer = item.player.id === player.id;
                const isExpanded = expandedPlayerId === item.player.id;

                return (
                  <div
                    key={item.player.id}
                    style={{
                      marginBottom: '6px',
                      borderRadius: '8px',
                      background: '#ffffff',
                      border: isCurrentPlayer ? '1.5px solid #0284c7' : '1px solid #e2e8f0',
                      overflow: 'hidden',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    }}
                  >
                    <div
                      onClick={() => setExpandedPlayerId(isExpanded ? null : item.player.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        cursor: 'pointer',
                        background: isExpanded ? '#f1f5f9' : isCurrentPlayer ? '#f0f9ff' : '#ffffff',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <span style={{ fontWeight: '900', width: '22px', fontSize: '12px', color: idx < 3 ? '#0284c7' : '#64748b' }}>
                          {idx + 1}.
                        </span>
                        {item.player.avatar ? (
                          <img src={item.player.avatar} alt={item.player.name} style={{ width: '26px', height: '26px', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800 }}>
                            {item.player.name.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                        <span style={{ fontWeight: isCurrentPlayer ? 900 : 700, fontSize: '13px', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.player.name}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: '900', fontSize: '14px', color: '#0284c7' }}>
                          {item.display}
                        </span>
                        {isExpanded ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ padding: '6px 10px 10px 10px', borderTop: '1px solid #e2e8f0', background: '#fafbfc' }}>
                        <StatMiniScorecard
                          player={item.player}
                          statKey={activeStatCategory.key}
                          holesR1={holesR1}
                          holesR2={holesR2}
                          round2Started={store.round2Started}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX ZDJĘCIA */}
      {showPhotoLightbox && player.avatar && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            backdropFilter: 'blur(5px)',
          }}
          onClick={() => setShowPhotoLightbox(false)}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <img
              src={player.avatar}
              alt={player.name}
              style={{ width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: '85vh', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', border: '2px solid #ffffff' }}
            />
            <button
              onClick={() => setShowPhotoLightbox(false)}
              style={{
                position: 'absolute',
                top: '-14px',
                right: '-14px',
                background: '#ef4444',
                color: '#ffffff',
                border: 'none',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
              }}
            >
              <X size={22} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}