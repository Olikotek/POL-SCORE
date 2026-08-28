// src/components/PlayerModal.tsx
import { useMemo, useState } from 'react';
import {
  Award,
  BarChart3,
  Flame,
  Info,
  Target,
  TrendingDown,
  X,
  ZoomIn,
  Menu,
} from 'lucide-react';
import type { Player, Round, Store, Tournament } from '@/types';
import { ROUNDS, flagEmoji } from '@/types';
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
  { key: 'out', label: 'PIERWSZA 9 (OUT)' },
  { key: 'inn', label: 'DRUGA 9 (IN)' },
];

const PAR_CARDS: { key: StatCategory; label: string }[] = [
  { key: 'par3', label: 'DOŁKI PAR 3' },
  { key: 'par4', label: 'DOŁKI PAR 4' },
  { key: 'par5', label: 'DOŁKI PAR 5' },
];

const PERF_CARDS: { key: StatCategory; label: string }[] = [
  { key: 'birdies', label: 'BIRDIE I LEPIEJ' },
  { key: 'pars', label: 'PARY I LEPIEJ' },
  { key: 'bogeys', label: 'BOGEY I WIĘCEJ' },
];

const ALL_STATS: StatCategory[] = [...TOTAL_CARDS, ...PAR_CARDS, ...PERF_CARDS].map((c) => c.key);

function ScoreShape({ value, par, size = 'md' }: { value: number | null; par: number; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? '28px' : '40px';
  const fontSize = size === 'sm' ? '13px' : '16px';

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
  const holesR1 = store.holesByRound[1] || [];
  const holesR2 = store.holesByRound[2] || [];

  const [activeView, setActiveView] = useState<'scorecard' | 'personal' | 'rankings' | 'tournaments'>(
    hideScorecardTab ? (initialTab === 'scorecard' ? 'personal' : initialTab) : initialTab
  );
  const [modalTab, setModalTab] = useState<'rozpiska' | 'statystyki'>('rozpiska');
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

  const calculateAge = (birthDateString?: string) => {
    if (!birthDateString) return '–';
    const birth = new Date(birthDateString);
    if (isNaN(birth.getTime())) return '–';
    const diff = Date.now() - birth.getTime();
    const ageDate = new Date(diff);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  };

  const playerAge = calculateAge(player.birthDate);

  const playerHistory = useMemo(() => {
    const rows = (leaguePoints || []).filter((lp: any) => String(lp.player_id) === String(player.id));
    let firsts = 0;
    let seconds = 0;
    let thirds = 0;
    let top10 = 0;
    let totalPoints = 0;

    const list = rows.map((lp: any) => {
      const t = (tournaments || []).find((item) => String(item.id) === String(lp.tournament_id));
      const r = Number(lp.rank) || 1;
      const pts = Number(lp.points) || 0;

      if (r === 1) firsts++;
      if (r === 2) seconds++;
      if (r === 3) thirds++;
      if (r <= 10) top10++;
      totalPoints += pts;

      return {
        id: lp.tournament_id,
        name: t?.name || 'Turniej Ligi PFFG',
        date: t?.date || '2026',
        courseName: t?.courseName || 'Pole Turniejowe PFFG',
        rank: r,
        points: pts,
      };
    });

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

  const renderStatCard = (card: { key: StatCategory; label: string }) => {
    const result = combinedStat(player, holesR1, holesR2, card.key);
    const rankVal = ranks.get(card.key)?.get(player.id);
    const allRanksForStat = Array.from(ranks.get(card.key)?.values() ?? []);

    const isTop5 = rankVal !== undefined && rankVal <= 5;
    const display = rankDisplay(rankVal, allRanksForStat);

    return (
      <div
        key={card.key}
        onClick={() => setActiveStatCategory(card)}
        style={{
          cursor: 'pointer',
          padding: '14px 16px',
          borderRadius: '10px',
          background: '#ffffff',
          border: '1px solid #cbd5e1',
          boxShadow: '0 2px 4px rgba(15, 23, 42, 0.03)',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#1b88cc';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(27, 136, 204, 0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = '#cbd5e1';
          e.currentTarget.style.boxShadow = '0 2px 4px rgba(15, 23, 42, 0.03)';
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <small style={{ fontWeight: 800, color: '#64748b', fontSize: '11px', letterSpacing: '0.04em' }}>
            {card.label}
          </small>
          <span
            style={{
              background: isTop5 ? '#16a34a' : '#0f172a',
              color: '#ffffff',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 900,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {display}
          </span>
        </div>
        <strong style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', display: 'block', lineHeight: 1.1 }}>
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
        key={h.number}
        onClick={() => setInspectedHole(isActive ? null : idx)}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2px',
          padding: '6px 2px',
          border: isActive ? '1px solid #0f172a' : '1px solid transparent',
          borderRadius: '6px',
          background: isActive ? '#f1f5f9' : 'transparent',
          cursor: 'pointer',
        }}
      >
        <small style={{ fontWeight: 800, color: '#64748b', fontSize: '11px' }}>{h.number}</small>
        <ScoreShape value={score} par={h.par} size="sm" />
        <em style={{ fontSize: '11px', fontStyle: 'normal', color: '#64748b', fontWeight: 800 }}>
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
            borderRadius: '14px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '92vh',
            width: '100%',
            maxWidth: '740px',
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          }}
        >
          {/* HEADER ZAWODNIKA */}
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
                      <img src={player.flagImage} alt={player.flag} style={{ width: '20px', height: '14px', borderRadius: '2px', objectFit: 'cover', border: '1px solid #cbd5e1' }} />
                    ) : (
                      <span className="flag-emoji" style={{ border: '1px solid #cbd5e1', borderRadius: '2px', padding: '1px 3px', lineHeight: 1, fontSize: '13px' }}>{flagEmoji(player.flag)}</span>
                    )}
                    <h1 style={{ fontSize: '22px', fontWeight: 900, margin: 0, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>
                      {player.name}
                    </h1>
                    {player.isAmateur && (
                      <span style={{ fontSize: '10px', background: '#7ea128', color: '#fff', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>
                        AM
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => setActiveView(activeView === 'scorecard' ? 'personal' : 'scorecard')}
                      title={activeView === 'scorecard' ? 'Przejdź do profilu' : 'Wróć do karty dołków'}
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
                    <span>Wiek: <b>{playerAge}</b></span>
                    <span>Miejscowość: <b>{player.city ? `${player.city}, ${player.flag}` : player.flag}</b></span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                    Profil
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
                    Turnieje
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
                    Rankingi
                  </button>
                  {!hideScorecardTab && (
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
                  )}
                </div>

                <button className="modal-close" onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <X size={17} />
                </button>
              </div>
            </div>
          </div>

          {/* GŁÓWNA ZAWARTOŚĆ OKNA */}
          <div style={{ padding: '20px', overflowY: 'auto', flex: 1, background: '#fcfdfd' }}>
            {/* ZAKŁADKA 1: PROFIL */}
            {activeView === 'personal' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    DANE ZAWODNIKA
                  </h3>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
                    <small style={{ fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>WIEK</small>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>{playerAge}</div>
                  </div>

                  <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
                    <small style={{ fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>MIEJSCOWOŚĆ / KRAJ</small>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                      {player.city ? `${player.city}, ${player.flag}` : player.flag}
                    </div>
                  </div>

                  <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
                    <small style={{ fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>KLUB FOOTGOLFA</small>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                      {player.club ?? 'Brak'}
                    </div>
                  </div>

                  <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
                    <small style={{ fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>MODEL PIŁKI MECZOWEJ</small>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#0284c7', marginTop: '2px' }}>
                      {player.ballModel || (player as any).ball_model || 'Nie podano'}
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
                      <small style={{ fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>PŁEĆ</small>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                        {player.gender === 'Female' ? 'Kobieta' : 'Mężczyzna'}
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: '14px 18px' }}>
                    <small style={{ fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>STATUS LICENCJI</small>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: player.isAmateur ? '#7ea128' : '#0284c7', marginTop: '2px' }}>
                      {player.isAmateur ? 'Amator (AM)' : 'PRO / Zawodnik Licencjonowany'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ZAKŁADKA 2: RANKINGI */}
            {activeView === 'rankings' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    OFICJALNE RANKINGI LIGI PFFG 2026
                  </h3>
                </div>

                <div style={{ overflowX: 'auto', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase' }}>
                        <th style={{ padding: '10px 14px' }}>Ranking</th>
                        <th style={{ padding: '10px 10px', textAlign: 'center' }}>Kategoria</th>
                        <th style={{ padding: '10px 8px', textAlign: 'center' }}>Turnieje</th>
                        <th style={{ padding: '10px 8px', textAlign: 'center' }}>1. m.</th>
                        <th style={{ padding: '10px 8px', textAlign: 'center' }}>2. m.</th>
                        <th style={{ padding: '10px 8px', textAlign: 'center' }}>3. m.</th>
                        <th style={{ padding: '10px 8px', textAlign: 'center' }}>TOP 10</th>
                        <th style={{ padding: '10px 8px', textAlign: 'center', color: '#0284c7' }}>Punkty</th>
                        <th style={{ padding: '10px 14px', textAlign: 'right' }}>Pozycja</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 14px', fontWeight: 800, color: '#0284c7' }}>Liga PFFG</td>
                        <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                          <span style={{ padding: '3px 8px', borderRadius: '12px', background: '#0b1329', color: '#ffffff', fontSize: '11px', fontWeight: 800 }}>Absolut</span>
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>{playerHistory.events}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>{playerHistory.firsts || '–'}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>{playerHistory.seconds || '–'}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>{playerHistory.thirds || '–'}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>{playerHistory.top10 || '–'}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 800, color: '#0284c7' }}>{playerHistory.totalPoints.toFixed(2)}</td>
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          {rank === 1 ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: '6px', background: '#fef08a', color: '#854d0e', fontWeight: 900, fontSize: '12px', border: '1px solid #fde047' }}>1</span>
                          ) : rank === 2 ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: '6px', background: '#f1f5f9', color: '#334155', fontWeight: 900, fontSize: '12px', border: '1px solid #cbd5e1' }}>2</span>
                          ) : rank === 3 ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: '6px', background: '#ffedd5', color: '#9a3412', fontWeight: 900, fontSize: '12px', border: '1px solid #fed7aa' }}>3</span>
                          ) : (
                            <span style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a' }}>{rank > 0 ? rank : '–'}</span>
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '12px 14px', fontWeight: 800, color: '#0284c7' }}>Liga PFFG</td>
                        <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                          <span style={{ padding: '3px 8px', borderRadius: '12px', background: '#0284c7', color: '#ffffff', fontSize: '11px', fontWeight: 800 }}>{player.category}</span>
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>{playerHistory.events}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>{playerHistory.firsts || '–'}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>{playerHistory.seconds || '–'}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>{playerHistory.thirds || '–'}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>{playerHistory.top10 || '–'}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 800, color: '#0284c7' }}>{playerHistory.totalPoints.toFixed(2)}</td>
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          {rank === 1 ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: '6px', background: '#fef08a', color: '#854d0e', fontWeight: 900, fontSize: '12px', border: '1px solid #fde047' }}>1</span>
                          ) : rank === 2 ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: '6px', background: '#f1f5f9', color: '#334155', fontWeight: 900, fontSize: '12px', border: '1px solid #cbd5e1' }}>2</span>
                          ) : rank === 3 ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: '6px', background: '#ffedd5', color: '#9a3412', fontWeight: 900, fontSize: '12px', border: '1px solid #fed7aa' }}>3</span>
                          ) : (
                            <span style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a' }}>{rank > 0 ? rank : '–'}</span>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    ROZEGRANE TURNIEJE 2026
                  </h3>
                </div>

                <div style={{ overflowX: 'auto', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase' }}>
                        <th style={{ padding: '10px 14px' }}>Data</th>
                        <th style={{ padding: '10px 14px' }}>Turniej</th>
                        <th style={{ padding: '10px 14px' }}>Pole</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>Miejsce</th>
                        <th style={{ padding: '10px 14px', textAlign: 'right', color: '#0284c7' }}>Punkty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {playerHistory.list.map((t) => (
                        <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px 14px', color: '#64748b' }}>{t.date}</td>
                          <td style={{ padding: '12px 14px', fontWeight: 800, color: '#0284c7' }}>{t.name}</td>
                          <td style={{ padding: '12px 14px', color: '#475569' }}>{t.courseName}</td>
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            {t.rank === 1 ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '6px', background: '#fef08a', color: '#854d0e', fontWeight: 900, fontSize: '13px', border: '1px solid #fde047' }}>
                                1
                              </span>
                            ) : t.rank === 2 ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '6px', background: '#f1f5f9', color: '#334155', fontWeight: 900, fontSize: '13px', border: '1px solid #cbd5e1' }}>
                                2
                              </span>
                            ) : t.rank === 3 ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '6px', background: '#ffedd5', color: '#9a3412', fontWeight: 900, fontSize: '13px', border: '1px solid #fed7aa' }}>
                                3
                              </span>
                            ) : (
                              <span style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a' }}>
                                {t.rank}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 900, color: '#0284c7', fontSize: '14px' }}>
                            {t.points.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                      {playerHistory.list.length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
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

                    <div className="modal-hole-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: '2px', background: '#ffffff', padding: '8px 4px', borderRadius: '10px 10px 0 0', border: '1px solid #e2e8f0', borderBottom: 'none' }}>
                      {holes.slice(0, 9).map((h, i) => renderHoleCell(h, i))}
                    </div>
                    <div className="modal-summary-line" style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', fontSize: '12px', fontWeight: '800', color: '#ffffff', background: '#0b1329', borderRadius: '0 0 10px 10px', marginBottom: '14px' }}>
                      <span style={{ letterSpacing: '0.06em' }}>SUMA OUT</span>
                      <span style={{ color: '#38bdf8' }}>
                        {out.sum || '–'} uderzeń / Par {outPar}
                        {out.sum ? ` (${relativeLabel(out.rel)})` : ''}
                      </span>
                    </div>

                    <div className="modal-hole-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: '2px', background: '#ffffff', padding: '8px 4px', borderRadius: '10px 10px 0 0', border: '1px solid #e2e8f0', borderBottom: 'none' }}>
                      {holes.slice(9, 18).map((h, i) => renderHoleCell(h, i + 9))}
                    </div>
                    <div className="modal-summary-line" style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', fontSize: '12px', fontWeight: '800', color: '#ffffff', background: '#0b1329', borderRadius: '0 0 10px 10px', marginBottom: '14px' }}>
                      <span style={{ letterSpacing: '0.06em' }}>SUMA IN</span>
                      <span style={{ color: '#38bdf8' }}>
                        {inn.sum || '–'} uderzeń / Par {inPar}
                        {inn.sum ? ` (${relativeLabel(inn.rel)})` : ''}
                      </span>
                    </div>

                    <div className="modal-summary-line total" style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: '#1e293b', borderRadius: '8px', fontSize: '13px', fontWeight: '800', color: '#fff' }}>
                      <span>ŁĄCZNIE (R{roundTab})</span>
                      <span style={{ color: '#38bdf8' }}>
                        {totalStrokes(player.scores[roundTab] || []) || '–'} uderzenia / Par {par}{' '}
                        {totalStrokes(player.scores[roundTab] || [])
                          ? `(${relativeLabel(relative(player.scores[roundTab] || [], holes))})`
                          : ''}
                      </span>
                    </div>

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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* WYNIKI CAŁKOWITE */}
                    <div>
                      <p style={{ fontSize: '12px', fontWeight: 900, color: '#475569', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        <TrendingDown size={14} color="#1b88cc" /> WYNIKI CAŁKOWITE
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                        {TOTAL_CARDS.map(renderStatCard)}
                      </div>
                    </div>

                    {/* WEDŁUG PAR */}
                    <div>
                      <p style={{ fontSize: '12px', fontWeight: 900, color: '#475569', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        <Target size={14} color="#1b88cc" /> WEDŁUG PAR
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                        {PAR_CARDS.map(renderStatCard)}
                      </div>
                    </div>

                    {/* SKUTECZNOŚĆ */}
                    <div>
                      <p style={{ fontSize: '12px', fontWeight: 900, color: '#475569', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        <Award size={14} color="#1b88cc" /> SKUTECZNOŚĆ
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                        {PERF_CARDS.map(renderStatCard)}
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