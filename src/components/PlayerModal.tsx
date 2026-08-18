import { useMemo, useState } from 'react';
import {
  Award,
  BarChart3,
  Flame,
  Info,
  Sparkles,
  Target,
  TrendingDown,
  X,
  ZoomIn,
  Menu,
  ChevronLeft,
  CircleDot,
  Footprints,
  MapPin,
  Calendar,
  Shield,
  Trophy,
  User,
  RotateCcw,
} from 'lucide-react';
import type { Player, Round, Store } from '@/types';
import { ROUNDS, flagEmoji } from '@/types';
import {
  combinedStat,
  computeCuriosities,
  holeStats,
  ordinalLabel,
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
  { key: 'total', label: 'TOTAL' },
  { key: 'out', label: 'FRONT 9 (OUT)' },
  { key: 'inn', label: 'BACK 9 (IN)' },
];

const PAR_CARDS: { key: StatCategory; label: string }[] = [
  { key: 'par3', label: 'PAR 3' },
  { key: 'par4', label: 'PAR 4' },
  { key: 'par5', label: 'PAR 5' },
];

const PERF_CARDS: { key: StatCategory; label: string }[] = [
  { key: 'birdies', label: 'BIRDIE+' },
  { key: 'pars', label: 'PARY' },
  { key: 'bogeys', label: 'BOGEY+' },
];

const ALL_STATS: StatCategory[] = [...TOTAL_CARDS, ...PAR_CARDS, ...PERF_CARDS].map((c) => c.key);

function ScoreShape({ value, par, size = 'md' }: { value: number | null; par: number; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? '28px' : '40px';
  const fontSize = size === 'sm' ? '13px' : '16px';

  if (!value) {
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
        <svg viewBox="0 0 26 26" style={{ position: 'absolute', width: size === 'sm' ? '32px' : '44px', height: size === 'sm' ? '32px' : '44px', left: '-2px', top: '-2px' }}>
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
    style = { ...style, borderRadius: '50%', backgroundColor: '#ef4444', border: '2px solid #000', color: '#fff' };
  } else if (delta === -1) {
    style = { ...style, borderRadius: '50%', backgroundColor: '#fca5a5', color: '#000' };
  } else if (delta === 0) {
    style = { ...style, background: 'transparent' };
  } else if (delta === 1) {
    style = { ...style, backgroundColor: '#e2e8f0', color: '#000', borderRadius: '6px' };
  } else if (delta >= 2) {
    style = { ...style, backgroundColor: '#94a3b8', color: '#fff', borderRadius: '6px' };
  }

  return <div style={style}>{value}</div>;
}

export function PlayerModal({
  player,
  store,
  rank,
  onClose,
}: {
  player: Player;
  store: Store;
  rank: number;
  onClose: () => void;
}) {
  const holesR1 = store.holesByRound[1] || [];
  const holesR2 = store.holesByRound[2] || [];
  
  // Tryby główne nawigacji
  const [activeView, setActiveView] = useState<'scorecard' | 'personal' | 'rankings' | 'tournaments'>('scorecard');
  const [modalTab, setModalTab] = useState<'rozpiska' | 'statystyki' | 'ciekawostki'>('rozpiska');
  const [roundTab, setRoundTab] = useState<Round>(1);
  const [inspectedHole, setInspectedHole] = useState<number | null>(null);
  const [showPhotoLightbox, setShowPhotoLightbox] = useState(false);
  
  const [activeStatCategory, setActiveStatCategory] = useState<{ key: StatCategory; label: string } | null>(null);

  const holes = roundTab === 1 ? holesR1 : holesR2;

  const ranks = useMemo(() => {
    const map = new Map<StatCategory, Map<string, number>>();
    ALL_STATS.forEach((s) => map.set(s, statRankMap(store.players, holesR1, holesR2, s, 'combined')));
    return map;
  }, [store.players, holesR1, holesR2]);

  const totalRel = relative(player.scores[1] || [], holesR1) + relative(player.scores[2] || [], holesR2);
  const strokes = totalStrokes(player.scores[1] || []) + totalStrokes(player.scores[2] || []);
  const par = totalPar(holes);
  const out = subtotal(player.scores[roundTab] || [], holes, 0, 9);
  const inn = subtotal(player.scores[roundTab] || [], holes, 9, 18);
  const outPar = holes.slice(0, 9).reduce((a, h) => a + h.par, 0);
  const inPar = holes.slice(9, 18).reduce((a, h) => a + h.par, 0);

  const formEntries = recentForm(player, holesR1, holesR2, 4);
  const curiosities = useMemo(
    () => computeCuriosities(store.players, holesR1, holesR2),
    [store.players, holesR1, holesR2]
  );

  // Wyliczanie wieku
  const calculateAge = (birthDateString?: string) => {
    if (!birthDateString) return '–';
    const birth = new Date(birthDateString);
    if (isNaN(birth.getTime())) return '–';
    const diff = Date.now() - birth.getTime();
    const ageDate = new Date(diff);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  };

  const playerAge = calculateAge(player.birthDate);

  const renderStatCard = (card: { key: StatCategory; label: string }) => {
    const result = combinedStat(player, holesR1, holesR2, card.key);
    const rankVal = ranks.get(card.key)?.get(player.id);
    const allRanksForStat = Array.from(ranks.get(card.key)?.values() ?? []);
    
    const isTop5 = rankVal !== undefined && rankVal <= 5;
    const display = rankDisplay(rankVal, allRanksForStat);

    return (
      <div 
        className="stat-card-detail" 
        key={card.key}
        onClick={() => setActiveStatCategory(card)}
        style={{ cursor: 'pointer', padding: '14px', borderRadius: '12px', background: '#ffffff', border: '1px solid #f1f5f9', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}
      >
        <div className="stat-card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <small style={{ fontWeight: '700', color: '#64748b' }}>{card.label}</small>
          <span 
            className="rank-box"
            style={{
              background: isTop5 ? '#10b981' : '#0f172a',
              color: '#ffffff',
              padding: '2px 8px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '800',
            }}
          >
            {display}
          </span>
        </div>
        <strong className="stat-value" style={{ fontSize: '22px', fontWeight: '900', marginTop: '6px', display: 'block', color: '#0f172a' }}>
          {result.display}
        </strong>
      </div>
    );
  };

  const renderHoleCell = (h: { number: number; par: number; meters: number }, idx: number) => {
    const score = player.scores[roundTab]?.[idx] || 0;
    const isActive = inspectedHole === idx;
    return (
      <button
        className={`modal-hole-cell ${isActive ? 'inspected' : ''}`}
        key={h.number}
        onClick={() => setInspectedHole(isActive ? null : idx)}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', padding: '4px 2px', border: 'none', background: 'transparent', cursor: 'pointer' }}
      >
        <small className="modal-hole-num" style={{ fontWeight: 'bold', color: '#64748b', fontSize: '11px' }}>{h.number}</small>
        <ScoreShape value={score} par={h.par} size="sm" />
        <em className="modal-hole-rel" style={{ fontSize: '11px', fontStyle: 'normal', color: '#64748b', fontWeight: 'bold' }}>
          {score > 0 ? relativeLabel(score - h.par) : '–'}
        </em>
      </button>
    );
  };

  const inspectedStats =
    inspectedHole !== null ? holeStats(store.players, holes, roundTab, inspectedHole) : null;
  const inspectedHoleData = inspectedHole !== null ? holes[inspectedHole] : null;

  const categoryLeaderboard = useMemo(() => {
    if (!activeStatCategory) return [];
    return [...store.players]
      .map((p) => {
        const stat = combinedStat(p, holesR1, holesR2, activeStatCategory.key);
        return {
          player: p,
          value: stat.value,
          display: stat.display,
        };
      })
      .sort((a, b) => a.value - b.value);
  }, [activeStatCategory, store.players, holesR1, holesR2]);

  return (
    <>
      <div className="modal-overlay" onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        <div 
          className="modal-panel" 
          onClick={(e) => e.stopPropagation()} 
          style={{ 
            borderRadius: '16px', 
            overflow: 'hidden', 
            display: 'flex', 
            flexDirection: 'column', 
            maxHeight: '92vh', 
            width: '100%', 
            maxWidth: '740px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          }}
        >
          {/* HEADER ZAWODNIKA (BLUEGOLF STYLE) */}
          <div style={{ padding: '18px 22px', background: '#ffffff', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                {player.avatar ? (
                  <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setShowPhotoLightbox(true)} title="Powiększ zdjęcie">
                    <img src={player.avatar} alt={player.name} style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }} />
                    <div style={{ position: 'absolute', bottom: '0', right: '0', background: '#0f172a', color: '#fff', borderRadius: '50%', padding: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ZoomIn size={10} />
                    </div>
                  </div>
                ) : (
                  <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#f1f5f9', border: '2px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '18px', color: '#64748b' }}>
                    {player.name.slice(0, 2).toUpperCase()}
                  </div>
                )}

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {player.flagImage ? (
                      <img src={player.flagImage} alt={player.flag} style={{ width: '20px', height: '14px', borderRadius: '2px', objectFit: 'cover' }} />
                    ) : (
                      <span className="flag-emoji">{flagEmoji(player.flag)}</span>
                    )}
                    <h1 style={{ fontSize: '22px', fontWeight: 900, margin: 0, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>
                      {player.name}
                    </h1>
                    {player.isAmateur && (
                      <span style={{ fontSize: '10px', background: '#10b981', color: '#fff', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>
                        AM
                      </span>
                    )}

                    {/* PRZYCISK TRZECH KRESEK */}
                    <button
                      type="button"
                      onClick={() => setActiveView(activeView === 'scorecard' ? 'personal' : 'scorecard')}
                      title={activeView === 'scorecard' ? 'Przejdź do pełnego profilu' : 'Wróć do karty dołków'}
                      style={{
                        background: activeView !== 'scorecard' ? '#0284c7' : '#f8fafc',
                        color: activeView !== 'scorecard' ? '#ffffff' : '#64748b',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '4px 6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginLeft: '4px',
                      }}
                    >
                      <Menu size={15} />
                    </button>
                  </div>

                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginTop: '4px', display: 'flex', gap: '14px' }}>
                    <span>AGE: <b>{playerAge}</b></span>
                    <span>RESIDENCE: <b>{player.city ? `${player.city}, ${player.flag}` : player.flag}</b></span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* PRZEŁĄCZNIK ZAKŁADEK BLUEGOLF STYLE */}
                <div style={{ display: 'flex', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '30px', padding: '3px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                  <button
                    onClick={() => setActiveView('personal')}
                    style={{
                      padding: '4px 14px',
                      borderRadius: '20px',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: activeView === 'personal' ? '#0284c7' : 'transparent',
                      color: activeView === 'personal' ? '#ffffff' : '#0284c7',
                    }}
                  >
                    Personal
                  </button>
                  <button
                    onClick={() => setActiveView('tournaments')}
                    style={{
                      padding: '4px 14px',
                      borderRadius: '20px',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: activeView === 'tournaments' ? '#0284c7' : 'transparent',
                      color: activeView === 'tournaments' ? '#ffffff' : '#0284c7',
                    }}
                  >
                    Tournaments
                  </button>
                  <button
                    onClick={() => setActiveView('rankings')}
                    style={{
                      padding: '4px 14px',
                      borderRadius: '20px',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: activeView === 'rankings' ? '#0284c7' : 'transparent',
                      color: activeView === 'rankings' ? '#ffffff' : '#0284c7',
                    }}
                  >
                    Rankings
                  </button>
                  <button
                    onClick={() => setActiveView('scorecard')}
                    style={{
                      padding: '4px 14px',
                      borderRadius: '20px',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: activeView === 'scorecard' ? '#0284c7' : 'transparent',
                      color: activeView === 'scorecard' ? '#ffffff' : '#64748b',
                    }}
                  >
                    Karta
                  </button>
                </div>

                <button className="modal-close" onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <X size={17} />
                </button>
              </div>
            </div>
          </div>

          {/* GŁÓWNA ZAWARTOŚĆ OKNA */}
          <div style={{ padding: '20px', overflowY: 'auto', flex: 1, background: '#fcfdfd' }}>
            {/* ZAKŁADKA 1: PERSONAL (BIO W STYLU BLUEGOLF) */}
            {activeView === 'personal' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    BIO
                  </h3>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
                    <small style={{ fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>AGE</small>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>{playerAge}</div>
                  </div>

                  <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
                    <small style={{ fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>RESIDENCE / MIEJSCOWOŚĆ</small>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                      {player.city ? `${player.city}, ${player.flag}` : player.flag}
                    </div>
                  </div>

                  <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
                    <small style={{ fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>FOOTGOLF CLUB</small>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                      {player.club ?? 'None'}
                    </div>
                  </div>

                  <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
                    <small style={{ fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>PIŁKA MECZOWA / BALL MODEL</small>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#0284c7', marginTop: '2px' }}>
                      {player.ballModel || 'Nie podano'}
                    </div>
                  </div>

                  <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <small style={{ fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>LEPSZA NOGA</small>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                        {player.preferredFoot === 'Left' ? 'Lewa' : player.preferredFoot === 'Right' ? 'Prawa' : 'Prawa'}
                      </div>
                    </div>
                    <div>
                      <small style={{ fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>PŁEĆ / GENDER</small>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                        {player.gender === 'Female' ? 'Kobieta' : 'Mężczyzna'}
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: '14px 18px' }}>
                    <small style={{ fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>STATUS LICENCJI</small>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: player.isAmateur ? '#10b981' : '#0284c7', marginTop: '2px' }}>
                      {player.isAmateur ? 'Amator (AM)' : 'PRO / Zawodnik Licencjonowany'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ZAKŁADKA 2: RANKINGS (TABELA RANKINGÓW PFFG / FIFG) */}
            {activeView === 'rankings' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    2026 PFFG & FIFG RANKINGS
                  </h3>
                </div>

                <div style={{ overflowX: 'auto', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '11px', fontWeight: 800 }}>
                        <th style={{ padding: '10px 14px' }}>Rankings</th>
                        <th style={{ padding: '10px 8px', textAlign: 'center' }}>Events</th>
                        <th style={{ padding: '10px 8px', textAlign: 'center' }}>1st</th>
                        <th style={{ padding: '10px 8px', textAlign: 'center' }}>2nd</th>
                        <th style={{ padding: '10px 8px', textAlign: 'center' }}>3rd</th>
                        <th style={{ padding: '10px 8px', textAlign: 'center' }}>Top 10</th>
                        <th style={{ padding: '10px 8px', textAlign: 'center', color: '#0284c7' }}>Points</th>
                        <th style={{ padding: '10px 14px', textAlign: 'right' }}>Standing</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 14px', fontWeight: 800, color: '#0284c7' }}>Liga PFFG – Absolut</td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>1</td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>{rank === 1 ? '1' : '–'}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>{rank === 2 ? '1' : '–'}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>{rank === 3 ? '1' : '–'}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>{rank <= 10 ? '1' : '–'}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 800, color: '#0284c7' }}>100.00</td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800 }}>{rank}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '12px 14px', fontWeight: 800, color: '#0284c7' }}>Liga PFFG – {player.category}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>1</td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>{rank === 1 ? '1' : '–'}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>{rank === 2 ? '1' : '–'}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>{rank === 3 ? '1' : '–'}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>{rank <= 10 ? '1' : '–'}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 800, color: '#0284c7' }}>100.00</td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800 }}>{rank}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ZAKŁADKA 3: TOURNAMENTS (HISTORIA ZAWODÓW) */}
            {activeView === 'tournaments' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    TOURNAMENTS 2026
                  </h3>
                </div>

                <div style={{ overflowX: 'auto', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '11px', fontWeight: 800 }}>
                        <th style={{ padding: '10px 14px' }}>Date</th>
                        <th style={{ padding: '10px 14px' }}>Tournament</th>
                        <th style={{ padding: '10px 14px' }}>Course</th>
                        <th style={{ padding: '10px 10px', textAlign: 'center' }}>Scores</th>
                        <th style={{ padding: '10px 8px', textAlign: 'center' }}>Place</th>
                        <th style={{ padding: '10px 14px', textAlign: 'right', color: '#0284c7' }}>Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ padding: '12px 14px', color: '#64748b' }}>Bieżący</td>
                        <td style={{ padding: '12px 14px', fontWeight: 800, color: '#0284c7' }}>{store.tournamentName}</td>
                        <td style={{ padding: '12px 14px', color: '#475569' }}>Pole Turniejowe PFFG</td>
                        <td style={{ padding: '12px 10px', textAlign: 'center', fontFamily: 'monospace' }}>
                          {totalStrokes(player.scores[1]) || '–'} - {totalStrokes(player.scores[2]) || '–'} = <b>{strokes || '–'}</b>
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 800 }}>{rank}</td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#0284c7' }}>100.00</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ZAKŁADKA 4: STANDARDOWA KARTA WYNIKÓW I ROZPISKA DOŁKÓW */}
            {activeView === 'scorecard' && (
              <>
                {/* Podsumowanie uderzeń */}
                <div className="modal-summary-bar" style={{ background: '#ffffff', padding: '14px 20px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', border: '1px solid #e2e8f0', borderRadius: '10px', textAlign: 'center', marginBottom: '14px' }}>
                  <div>
                    <small style={{ color: '#64748b', fontWeight: '800', fontSize: '10px' }}>UDERZENIA</small>
                    <strong style={{ fontSize: '22px', fontWeight: '900', display: 'block', color: '#0f172a' }}>{strokes || '–'}</strong>
                  </div>
                  <div>
                    <small style={{ color: '#64748b', fontWeight: '800', fontSize: '10px' }}>DO PAR</small>
                    <strong style={{ fontSize: '22px', fontWeight: '900', display: 'block', color: totalRel < 0 ? '#ef4444' : '#0f172a' }}>
                      {relativeLabel(totalRel)}
                    </strong>
                  </div>
                  <div>
                    <small style={{ color: '#64748b', fontWeight: '800', fontSize: '10px' }}>PAR POLA</small>
                    <strong style={{ fontSize: '22px', fontWeight: '900', display: 'block', color: '#0f172a' }}>{par}</strong>
                  </div>
                </div>

                {/* Forma */}
                <div className="form-badge-bar" style={{ padding: '10px 14px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <small style={{ color: '#64748b', fontWeight: '800', fontSize: '10px' }}>FORMA (OSTATNIE DOŁKI)</small>
                  <div className="form-flames" style={{ display: 'flex', gap: '6px' }}>
                    {formEntries.length === 0 && <span className="muted">Brak wyników</span>}
                    {formEntries.map((e, i) => (
                      <span
                        key={i}
                        className={`form-chip ${e.delta < 0 ? 'hot' : e.delta === 0 ? 'neutral' : 'cold'}`}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '16px',
                          fontSize: '11px',
                          fontWeight: '700',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          background: e.delta < 0 ? '#fef2f2' : e.delta === 0 ? '#f8fafc' : '#f1f5f9',
                          color: e.delta < 0 ? '#ef4444' : e.delta === 0 ? '#475569' : '#64748b',
                        }}
                      >
                        {e.delta < 0 ? <Flame size={12} color="#ef4444" /> : null}
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

                {/* Podzakładki karty dołków */}
                <div className="modal-tabs" style={{ display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: '4px', marginBottom: '14px' }}>
                  <button
                    className={modalTab === 'rozpiska' ? 'active' : ''}
                    onClick={() => setModalTab('rozpiska')}
                    style={{ flex: 1, padding: '8px 10px', fontWeight: '800', fontSize: '12px', border: 'none', borderRadius: '6px', background: modalTab === 'rozpiska' ? '#ffffff' : 'transparent', color: modalTab === 'rozpiska' ? '#0f172a' : '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxShadow: modalTab === 'rozpiska' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none' }}
                  >
                    <BarChart3 size={14} /> Rozpiska dołków
                  </button>
                  <button
                    className={modalTab === 'statystyki' ? 'active' : ''}
                    onClick={() => setModalTab('statystyki')}
                    style={{ flex: 1, padding: '8px 10px', fontWeight: '800', fontSize: '12px', border: 'none', borderRadius: '6px', background: modalTab === 'statystyki' ? '#ffffff' : 'transparent', color: modalTab === 'statystyki' ? '#0f172a' : '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxShadow: modalTab === 'statystyki' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none' }}
                  >
                    <TrendingDown size={14} /> Statystyki
                  </button>
                  <button
                    className={modalTab === 'ciekawostki' ? 'active' : ''}
                    onClick={() => setModalTab('ciekawostki')}
                    style={{ flex: 1, padding: '8px 10px', fontWeight: '800', fontSize: '12px', border: 'none', borderRadius: '6px', background: modalTab === 'ciekawostki' ? '#ffffff' : 'transparent', color: modalTab === 'ciekawostki' ? '#0f172a' : '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxShadow: modalTab === 'ciekawostki' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none' }}
                  >
                    <Sparkles size={14} /> Ciekawostki
                  </button>
                </div>

                {modalTab === 'rozpiska' && (
                  <div className="modal-section">
                    <div className="round-switcher" style={{ marginBottom: '14px' }}>
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

                    <p className="modal-section-title" style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '10px' }}>
                      <Info size={13} /> Kliknij dołek, aby zobaczyć statystyki turniejowe
                    </p>

                    {/* FRONT 9 */}
                    <div className="modal-hole-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: '2px', background: '#ffffff', padding: '8px 4px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                      {holes.slice(0, 9).map((h, i) => renderHoleCell(h, i))}
                    </div>
                    <div className="modal-summary-line" style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '12px' }}>
                      <span>SUMA OUT</span>
                      <span>
                        {out.sum || '–'} uderzeń / Par {outPar}
                        {out.sum ? ` (${relativeLabel(out.rel)})` : ''}
                      </span>
                    </div>

                    {/* BACK 9 */}
                    <div className="modal-hole-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: '2px', background: '#ffffff', padding: '8px 4px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                      {holes.slice(9, 18).map((h, i) => renderHoleCell(h, i + 9))}
                    </div>
                    <div className="modal-summary-line" style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '12px' }}>
                      <span>SUMA IN</span>
                      <span>
                        {inn.sum || '–'} uderzeń / Par {inPar}
                        {inn.sum ? ` (${relativeLabel(inn.rel)})` : ''}
                      </span>
                    </div>

                    <div className="modal-summary-line total" style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: '#f8fafc', borderRadius: '8px', fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>
                      <span>ŁĄCZNIE (R{roundTab})</span>
                      <span>
                        {totalStrokes(player.scores[roundTab] || []) || '–'} uderzenia / Par {par}{' '}
                        {totalStrokes(player.scores[roundTab] || [])
                          ? `(${relativeLabel(relative(player.scores[roundTab] || [], holes))})`
                          : ''}
                      </span>
                    </div>

                    {/* STATYSTYKI DOŁKA PO KLIKNIĘCIU */}
                    {inspectedStats && inspectedHoleData && (
                      <div className="hole-inspection-panel" style={{ marginTop: '16px', padding: '16px', borderRadius: '12px', background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                        <div className="hole-inspection-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                          <div>
                            <p className="eyebrow" style={{ fontSize: '11px', color: '#64748b', margin: 0, fontWeight: '700' }}>
                              DOŁEK {inspectedHoleData.number} · PAR {inspectedHoleData.par} · {inspectedHoleData.meters} M
                            </p>
                            <h3 style={{ fontSize: '16px', margin: '2px 0 0 0', fontWeight: '800', color: '#0f172a' }}>Statystyki turniejowe dołka</h3>
                          </div>
                          <button className="modal-close sm" onClick={() => setInspectedHole(null)} style={{ border: 'none', background: '#f1f5f9', borderRadius: '50%', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <X size={16} />
                          </button>
                        </div>

                        <div className="hole-inspection-body" style={{ display: 'grid', gridTemplateColumns: '120px 140px 1fr', gap: '16px', alignItems: 'center' }}>
                          <div className="hole-inspect-avg" style={{ textAlign: 'center', padding: '10px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                            <small style={{ color: '#64748b', fontSize: '10px', fontWeight: '800', display: 'block', marginBottom: '2px' }}>ŚREDNIA</small>
                            <strong style={{ fontSize: '22px', fontWeight: '900', color: '#0f172a', display: 'block', lineHeight: '1.1' }}>
                              {inspectedStats.total > 0 ? inspectedStats.avg.toFixed(2) : '–'}
                            </strong>
                            <small style={{ color: '#94a3b8', fontSize: '10px', display: 'block', marginTop: '2px' }}>wszyscy gracze</small>
                          </div>

                          <div className="hole-par-ring" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <div
                              style={{
                                width: '56px',
                                height: '56px',
                                borderRadius: '50%',
                                background: `conic-gradient(#10b981 ${inspectedStats.parOrBetterPct}%, #e2e8f0 0)`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative',
                              }}
                            >
                              <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '12px', color: '#0f172a' }}>
                                {inspectedStats.parOrBetterPct}%
                              </div>
                            </div>
                            <small style={{ color: '#64748b', fontSize: '10px', fontWeight: '700', marginTop: '4px' }}>PAR LUB LEPIEJ</small>
                          </div>

                          <div className="hole-distribution" style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderLeft: '1px solid #e2e8f0', paddingLeft: '16px' }}>
                            <small style={{ color: '#64748b', fontSize: '10px', fontWeight: '800', marginBottom: '2px' }}>ROZKŁAD WYNIKÓW</small>
                            {inspectedStats.eagle > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '700', color: '#0f172a' }}>
                                <span>Eagle</span>
                                <span>{inspectedStats.eagle}</span>
                              </div>
                            )}
                            {inspectedStats.birdie > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '700', color: '#0f172a' }}>
                                <span>Birdie</span>
                                <span>{inspectedStats.birdie}</span>
                              </div>
                            )}
                            {inspectedStats.parCount > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '700', color: '#0f172a' }}>
                                <span>Par</span>
                                <span>{inspectedStats.parCount}</span>
                              </div>
                            )}
                            {inspectedStats.bogey > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '700', color: '#0f172a' }}>
                                <span>Bogey</span>
                                <span>{inspectedStats.bogey}</span>
                              </div>
                            )}
                            {inspectedStats.double > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '700', color: '#0f172a' }}>
                                <span>Double</span>
                                <span>{inspectedStats.double}</span>
                              </div>
                            )}
                            {inspectedStats.other > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '700', color: '#0f172a' }}>
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
                  <>
                    <div className="modal-section" style={{ marginBottom: '16px' }}>
                      <p className="modal-section-title" style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <TrendingDown size={14} /> TOTALS
                      </p>
                      <div className="stat-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>{TOTAL_CARDS.map(renderStatCard)}</div>
                    </div>
                    <div className="modal-section" style={{ marginBottom: '16px' }}>
                      <p className="modal-section-title" style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Target size={14} /> BY PAR
                      </p>
                      <div className="stat-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>{PAR_CARDS.map(renderStatCard)}</div>
                    </div>
                    <div className="modal-section">
                      <p className="modal-section-title" style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Award size={14} /> PERFORMANCE
                      </p>
                      <div className="stat-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>{PERF_CARDS.map(renderStatCard)}</div>
                    </div>
                  </>
                )}

                {modalTab === 'ciekawostki' && (
                  <div className="modal-section">
                    <div className="curio-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                      <div className="curio-card" style={{ padding: '14px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <Flame size={18} color="#ef4444" />
                        <div>
                          <small style={{ color: '#64748b', fontSize: '10px', fontWeight: 'bold' }}>NAJDŁUŻSZA SERIA BIRDIE</small>
                          <strong style={{ display: 'block', fontSize: '14px' }}>
                            {curiosities.longestBirdieStreak
                              ? `${curiosities.longestBirdieStreak.player.name} (${curiosities.longestBirdieStreak.streak})`
                              : 'Brak'}
                          </strong>
                        </div>
                      </div>
                      <div className="curio-card" style={{ padding: '14px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <Sparkles size={18} color="#0ea5e9" />
                        <div>
                          <small style={{ color: '#64748b', fontSize: '10px', fontWeight: 'bold' }}>BOUNCE-BACK (BIRDIE PO BOGEYU)</small>
                          <strong style={{ display: 'block', fontSize: '14px' }}>
                            {curiosities.bounceBacks.length > 0
                              ? curiosities.bounceBacks
                                  .map((b) => `${b.player.name} (${b.count})`)
                                  .join(', ')
                              : 'Brak'}
                          </strong>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabela klasyfikacji po kliknięciu w kafelek */}
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
            padding: '16px',
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setActiveStatCategory(null)}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '520px',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <small style={{ color: '#64748b', fontSize: '11px', fontWeight: '800' }}>KLASYFIKACJA KATEGORII</small>
                <h3 style={{ margin: '2px 0 0 0', fontSize: '18px', fontWeight: '900', color: '#0f172a' }}>{activeStatCategory.label}</h3>
              </div>
              <button 
                onClick={() => setActiveStatCategory(null)}
                style={{ border: 'none', background: '#f1f5f9', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ overflowY: 'auto', padding: '12px 16px', flex: 1 }}>
              {categoryLeaderboard.map((item, idx) => {
                const isCurrentPlayer = item.player.id === player.id;
                return (
                  <div 
                    key={item.player.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      marginBottom: '6px',
                      borderRadius: '10px',
                      background: isCurrentPlayer ? '#f0fdf4' : '#ffffff',
                      border: isCurrentPlayer ? '1px solid #86efac' : '1px solid #f1f5f9',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontWeight: '800', width: '24px', fontSize: '14px', color: idx < 3 ? '#10b981' : '#64748b' }}>
                        {idx + 1}.
                      </span>
                      <span style={{ fontWeight: isCurrentPlayer ? '800' : '600', fontSize: '15px', color: '#0f172a' }}>
                        {item.player.name}
                      </span>
                    </div>
                    <span style={{ fontWeight: '800', fontSize: '15px', color: '#0f172a' }}>
                      {item.display}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox do powiększania zdjęcia profilowego */}
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
            padding: '20px',
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
                top: '-16px',
                right: '-16px',
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