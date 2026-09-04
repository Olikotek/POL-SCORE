// src/components/Leaderboard.tsx
import { useMemo, useState, useEffect, useRef, memo } from 'react';
import {
  ChevronRight,
  ClipboardList,
  ChevronDown,
  RefreshCw,
  Check,
  MapPin,
} from 'lucide-react';
import type { Category, Store, Player, Tournament } from '@/types';
import { CATEGORIES, flagEmoji } from '@/types';
import {
  combinedRelative,
  computeRanks,
  ordinalLabel,
  relative,
  relativeLabel,
  totalStrokes,
  thruLabel,
} from '@/scoring';

export const CATEGORY_NAMES_PL: Record<Category | 'Wszystkie', string> = {
  Wszystkie: 'Wszystkie (Absolut)',
  Men: 'Mężczyźni',
  Women: 'Kobiety',
  Senior: 'Seniorzy',
  Junior: 'Juniorzy',
  'Senior+': 'Seniorzy+',
};

function formatShortPlayerName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
  }
  return fullName;
}

function initialsLocal(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function Leaderboard({
  store,
  activeTournament,
  onEnter,
  onOpenPlayer,
  onRefresh,
}: {
  store: Store;
  activeTournament?: Tournament | null;
  onEnter: () => void;
  onOpenPlayer: (playerId: string) => void;
  onRefresh?: () => void;
}) {
  const [filter, setFilter] = useState<Category | 'Wszystkie'>(() => {
    const saved = localStorage.getItem('pffg_live_category');
    return (saved as Category | 'Wszystkie') || 'Wszystkie';
  });

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { holesByRound } = store;
  const holesR1 = holesByRound[1] || [];
  const holesR2 = holesByRound[2] || [];

  const handleSelectCategory = (cat: Category | 'Wszystkie') => {
    setFilter(cat);
    localStorage.setItem('pffg_live_category', cat);
    setDropdownOpen(false);

    if (onRefresh) {
      setIsRefreshing(true);
      Promise.resolve(onRefresh()).finally(() => {
        setTimeout(() => setIsRefreshing(false), 300);
      });
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside, { passive: true });
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activePlayers = useMemo(
    () => store.players.filter((p) => p.isActive !== false && (p as any).is_active !== false),
    [store.players]
  );

  const filtered = useMemo(
    () =>
      filter === 'Wszystkie'
        ? activePlayers
        : activePlayers.filter((p) => p.category === filter),
    [activePlayers, filter]
  );

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => combinedRelative(a, holesR1, holesR2) - combinedRelative(b, holesR1, holesR2)),
    [filtered, holesR1, holesR2]
  );

  const ranks = useMemo(() => {
    const values = sorted.map((p) => combinedRelative(p, holesR1, holesR2));
    return computeRanks(values, true);
  }, [sorted, holesR1, holesR2]);

  const [positionDeltas, setPositionDeltas] = useState<Map<string, { type: 'up' | 'down' | 'same'; diff: number }>>(new Map());

  useEffect(() => {
    const storageKey = `pffg_tourney_ranks_${store.tournamentName}_${filter}`;
    let previousRanks: Record<string, number> = {};

    try {
      const cached = sessionStorage.getItem(storageKey);
      if (cached) previousRanks = JSON.parse(cached);
    } catch {
      previousRanks = {};
    }

    const currentRanksObj: Record<string, number> = {};
    const nextDeltas = new Map<string, { type: 'up' | 'down' | 'same'; diff: number }>();

    sorted.forEach((p, index) => {
      const currentRank = ranks[index];
      currentRanksObj[p.id] = currentRank;

      const prevRank = previousRanks[p.id];
      if (prevRank === undefined) {
        nextDeltas.set(p.id, { type: 'same', diff: 0 });
      } else if (currentRank < prevRank) {
        nextDeltas.set(p.id, { type: 'up', diff: prevRank - currentRank });
      } else if (currentRank > prevRank) {
        nextDeltas.set(p.id, { type: 'down', diff: currentRank - prevRank });
      } else {
        nextDeltas.set(p.id, { type: 'same', diff: 0 });
      }
    });

    setPositionDeltas(nextDeltas);
    sessionStorage.setItem(storageKey, JSON.stringify(currentRanksObj));
  }, [sorted, ranks, filter, store.tournamentName]);

  const preparedRows = useMemo(() => {
    const tiedCounts = new Map<number, number>();
    ranks.forEach((r) => tiedCounts.set(r, (tiedCounts.get(r) || 0) + 1));

    return sorted.map((player, index) => {
      const rank = ranks[index];
      const isTied = (tiedCounts.get(rank) || 0) > 1;
      const display = isTied ? `T${rank}` : ordinalLabel(rank);

      const total = combinedRelative(player, holesR1, holesR2);
      const r1Rel = relative(player.scores[1] || [], holesR1);
      const r2Rel = relative(player.scores[2] || [], holesR2);
      const s1 = totalStrokes(player.scores[1] || []);
      const s2 = totalStrokes(player.scores[2] || []);
      const strokes = s1 + (store.round2Started ? s2 : 0);
      const thru = thruLabel(player);
      const delta = positionDeltas.get(player.id) ?? { type: 'same', diff: 0 };

      return {
        player,
        rank,
        display,
        total,
        r1Rel,
        r2Rel,
        s1,
        s2,
        strokes,
        thru,
        delta,
        shortName: formatShortPlayerName(player.name),
        initials: initialsLocal(player.name),
      };
    });
  }, [sorted, ranks, holesR1, holesR2, store.round2Started, positionDeltas]);

  // Pobieranie aktualnej nazwy pola z konfiguracji turnieju z panelu admina
  const currentCourseName = useMemo(() => {
    if (activeTournament?.courseName && activeTournament.courseName.trim()) {
      return activeTournament.courseName.trim();
    }
    const r1Course = store.round1CourseId ? store.courses.find((c) => c.id === store.round1CourseId) : null;
    return r1Course?.name || store.courses[0]?.name || 'Pole Turniejowe PFFG';
  }, [activeTournament, store.round1CourseId, store.courses]);

  return (
    <section className="leaderboard-container">
      <style>{`
        .leaderboard-container {
          background: #ffffff;
          border-radius: 12px;
          padding: 16px 20px;
          border: 1px solid #cbd5e1;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);
          width: 100%;
          box-sizing: border-box;
        }
        .leaderboard-top-info {
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid #f1f5f9;
        }
        .leaderboard-top-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
          flex-wrap: nowrap;
        }
        .leaderboard-table-wrap {
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          width: 100%;
          overflow-x: auto;
          box-sizing: border-box;
        }
        .leaderboard-main-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          text-align: left;
          table-layout: auto;
        }
        .leaderboard-main-table thead tr th {
          color: #475569;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          background: #f8fafc;
          border-bottom: 2px solid #cbd5e1;
        }
        .col-pos { width: 44px; text-align: center; }
        .col-delta { width: 40px; text-align: center; }
        .col-nat { width: 36px; text-align: center; }
        .col-player { width: auto; text-align: left; }
        .col-sum { width: 70px; text-align: center; }
        .col-holes { width: 65px; text-align: center; }
        .col-r1 { width: 60px; text-align: center; }
        .col-r2 { width: 60px; text-align: center; }
        .col-strokes { width: 90px; text-align: center; }
        .col-arrow { width: 30px; text-align: center; }

        .desktop-only-col { display: table-cell; }
        .mobile-only-col { display: none; }
        .header-country-desktop { display: inline; }
        .header-country-mobile { display: none; }
        .header-tot-desktop { display: inline; }
        .header-tot-mobile { display: none; }
        .player-name-desktop { display: inline; font-weight: 800; font-size: 13px; color: #0f172a; white-space: nowrap; }
        .player-name-mobile { display: none; }
        .player-subline-mobile { display: none; }
        .player-club-desktop { display: inline; font-size: 11px; font-weight: 500; color: #64748b; white-space: nowrap; margin-left: 6px; }

        @media (max-width: 640px) {
          .leaderboard-container {
            padding: 8px 0 !important;
            border-radius: 0 !important;
            border-left: none !important;
            border-right: none !important;
            box-shadow: none !important;
            width: 100vw !important;
            position: relative !important;
            left: 50% !important;
            right: 50% !important;
            margin-left: -50vw !important;
            margin-right: -50vw !important;
          }
          .leaderboard-top-info {
            padding: 0 12px 6px 12px !important;
            margin-bottom: 8px !important;
          }
          .leaderboard-top-controls {
            gap: 6px !important;
            margin-bottom: 8px !important;
            padding: 0 10px !important;
          }
          .btn-enter-text {
            display: inline !important;
            font-size: 11px !important;
          }
          .btn-enter-score {
            padding: 6px 10px !important;
            gap: 4px !important;
          }
          .leaderboard-table-wrap {
            border-radius: 0 !important;
            border-left: none !important;
            border-right: none !important;
            overflow-x: hidden !important;
            width: 100% !important;
          }
          .leaderboard-main-table {
            table-layout: fixed !important;
            width: 100% !important;
          }
          .desktop-only-col { display: none !important; }
          .mobile-only-col { display: table-cell !important; }

          .col-pos { width: 34px !important; }
          .col-nat { width: 28px !important; }
          .col-player { width: auto !important; }
          .col-sum { width: 46px !important; }
          .col-holes { width: 40px !important; }
          .col-r-mob { width: 40px !important; text-align: center !important; }

          .header-country-desktop { display: none !important; }
          .header-country-mobile { display: inline !important; }
          .header-tot-desktop { display: none !important; }
          .header-tot-mobile { display: inline !important; }
          
          .player-name-desktop { display: none !important; }
          .player-name-mobile {
            display: inline !important;
            font-size: 13px !important;
            font-weight: 800 !important;
            color: #0f172a !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }
          .player-subline-mobile {
            display: block !important;
            font-size: 10px !important;
            color: #64748b !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            line-height: 1.2 !important;
            margin-top: 1px !important;
          }
          .player-club-desktop { display: none !important; }
        }
      `}</style>

      {/* TYTUŁ TURNIEJU I POLE Z KONFIGURACJI TURNIEJU */}
      <div className="leaderboard-top-info">
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>
          {store.tournamentName}
        </h2>
        {currentCourseName && (
          <p style={{ margin: '2px 0 0 0', fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <MapPin size={12} color="#0284c7" />
            <span>{currentCourseName}</span>
          </p>
        )}
      </div>

      {/* PASEK KONTROLNY: KATEGORIA + ODŚWIEŻANIE + WPROWADŹ WYNIK */}
      <div className="leaderboard-top-controls">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
          <div style={{ position: 'relative' }} ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen((prev) => !prev)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '6px 10px',
                fontSize: '12px',
                fontWeight: 800,
                color: '#0f172a',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <span>{CATEGORY_NAMES_PL[filter]}</span>
              <ChevronDown size={13} style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'none' }} />
            </button>

            {dropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  zIndex: 50,
                  minWidth: '200px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
                  padding: '4px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                }}
              >
                {((['Wszystkie', ...CATEGORIES]) as (Category | 'Wszystkie')[]).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleSelectCategory(cat)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      background: filter === cat ? '#eff6ff' : 'transparent',
                      color: filter === cat ? '#1b88cc' : '#334155',
                      fontSize: '12.5px',
                      fontWeight: filter === cat ? 800 : 600,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span>{CATEGORY_NAMES_PL[cat]}</span>
                    {filter === cat && <Check size={14} color="#1b88cc" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
          {onRefresh && (
            <button
              type="button"
              onClick={() => {
                setIsRefreshing(true);
                Promise.resolve(onRefresh()).finally(() => {
                  setTimeout(() => setIsRefreshing(false), 300);
                });
              }}
              title="Odśwież wyniki"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '6px 8px',
                color: '#475569',
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
          )}

          <button
            onClick={onEnter}
            className="btn-enter-score"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: 'linear-gradient(135deg, #0b1329 0%, #1e293b 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 6px rgba(11, 19, 41, 0.12)',
            }}
          >
            <ClipboardList size={14} />
            <span className="btn-enter-text">Wprowadź wynik</span>
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {/* TABELA LIVE */}
      <div className="leaderboard-table-wrap">
        <table className="leaderboard-main-table">
          <thead>
            <tr>
              <th className="col-pos" style={{ padding: '9px 2px', borderRight: '1px solid #e2e8f0' }}>POS</th>
              <th className="desktop-only-col col-delta" style={{ padding: '9px 4px', borderRight: '1px solid #e2e8f0' }}>+/-</th>
              <th className="col-nat" style={{ padding: '9px 2px', borderRight: '1px solid #e2e8f0' }}>
                <span className="header-country-desktop">KRAJ</span>
                <span className="header-country-mobile">NAT</span>
              </th>
              <th className="col-player" style={{ padding: '9px 8px', borderRight: '1px solid #e2e8f0' }}>ZAWODNIK</th>
              <th className="col-sum" style={{ padding: '9px 4px', borderRight: '1px solid #e2e8f0' }}>
                <span className="header-tot-desktop">SUMA</span>
                <span className="header-tot-mobile">TOT</span>
              </th>
              <th className="col-holes" style={{ padding: '9px 4px', borderRight: '1px solid #e2e8f0' }}>DOŁKI</th>
              
              <th className="mobile-only-col col-r-mob" style={{ padding: '9px 2px', borderRight: '1px solid #e2e8f0' }}>
                {store.round2Started ? 'R2' : 'R1'}
              </th>

              <th className="desktop-only-col col-r1" style={{ padding: '9px 6px', borderRight: '1px solid #e2e8f0' }}>R1</th>
              {store.round2Started && (
                <th className="desktop-only-col col-r2" style={{ padding: '9px 6px', borderRight: '1px solid #e2e8f0' }}>R2</th>
              )}
              <th className="desktop-only-col col-strokes" style={{ padding: '9px 8px', borderRight: '1px solid #e2e8f0' }}>UDERZENIA</th>
              
              <th className="desktop-only-col col-arrow" style={{ padding: '9px 2px' }}></th>
            </tr>
          </thead>
          <tbody>
            {preparedRows.map((row, index) => {
              const { player, display, total, r1Rel, r2Rel, s1, s2, strokes, thru, delta, shortName, initials } = row;
              const isEven = index % 2 === 0;

              return (
                <tr
                  key={player.id}
                  onClick={() => onOpenPlayer(player.id)}
                  style={{
                    background: isEven ? '#ffffff' : '#f8fafc',
                    borderBottom: '1px solid #e2e8f0',
                    cursor: 'pointer',
                  }}
                >
                  {/* POZYCJA */}
                  <td className="col-pos" style={{ padding: '8px 2px', fontWeight: 800, fontSize: '12px', color: '#0f172a', borderRight: '1px solid #e2e8f0' }}>
                    {display}
                  </td>

                  {/* +/- DESKTOP */}
                  <td className="desktop-only-col col-delta" style={{ padding: '8px 4px', borderRight: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {delta.type === 'up' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: '#16a34a', fontWeight: 800, fontSize: '11px' }}>
                          <span style={{ fontSize: '9px' }}>▲</span> {delta.diff}
                        </span>
                      ) : delta.type === 'down' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: '#dc2626', fontWeight: 800, fontSize: '11px' }}>
                          <span style={{ fontSize: '9px' }}>▼</span> {delta.diff}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontWeight: 700, fontSize: '13px', lineHeight: 1 }}>
                          -
                        </span>
                      )}
                    </div>
                  </td>

                  {/* FLAGA / NAT */}
                  <td className="col-nat" style={{ padding: '8px 2px', borderRight: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img
                        src={player.flagImage || flagEmoji(player.flag || 'PL')}
                        alt={player.flag || 'PL'}
                        style={{
                          width: '18px',
                          height: '12px',
                          objectFit: 'cover',
                          borderRadius: '2px',
                          border: '1px solid #cbd5e1',
                          display: 'block',
                        }}
                      />
                    </div>
                  </td>

                  {/* ZAWODNIK + POWIĘKSZONE ZDJĘCIE */}
                  <td className="col-player" style={{ padding: '6px 6px', borderRight: '1px solid #e2e8f0', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      {player.avatar ? (
                        <img
                          src={player.avatar}
                          alt={player.name}
                          style={{
                            width: '30px',
                            height: '30px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: '1.5px solid #cbd5e1',
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <span
                          style={{
                            width: '30px',
                            height: '30px',
                            borderRadius: '50%',
                            background: '#e2e8f0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '10px',
                            fontWeight: 800,
                            color: '#475569',
                            flexShrink: 0,
                            border: '1px solid #cbd5e1',
                          }}
                        >
                          {initials}
                        </span>
                      )}

                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'nowrap', overflow: 'hidden' }}>
                          <span className="player-name-desktop">
                            {player.name}
                          </span>

                          <span className="player-name-mobile">
                            {shortName}
                          </span>

                          {player.isAmateur && (
                            <span style={{ fontSize: '8px', fontWeight: 800, background: '#7ea128', color: '#ffffff', padding: '1px 3px', borderRadius: '3px', lineHeight: 1, flexShrink: 0 }}>
                              AM
                            </span>
                          )}

                          {player.club && (
                            <span className="player-club-desktop">
                              {player.club}
                            </span>
                          )}
                        </div>

                        <span className="player-subline-mobile">
                          {player.club || 'Bez klubu'}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* SUMA / TOT */}
                  <td className="col-sum" style={{ padding: '8px 2px', borderRight: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {total < 0 ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: '#fee2e2',
                            color: '#dc2626',
                            fontWeight: 900,
                            fontSize: '12.5px',
                            borderRadius: '5px',
                            padding: '3px 5px',
                            minWidth: '32px',
                            lineHeight: 1.1,
                          }}
                        >
                          {relativeLabel(total)}
                        </span>
                      ) : (
                        <span style={{ color: '#0f172a', fontWeight: 800, fontSize: '13px' }}>
                          {total === 0 ? 'E' : relativeLabel(total)}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* DOŁKI (THRU) */}
                  <td className="col-holes" style={{ padding: '8px 2px', borderRight: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontWeight: 600, fontSize: '12.5px' }}>
                      {thru}
                    </div>
                  </td>

                  {/* RUNDA MOBILE */}
                  <td className="mobile-only-col col-r-mob" style={{ padding: '8px 2px', borderRight: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {(() => {
                        const activeRRel = store.round2Started ? r2Rel : r1Rel;
                        const activeStrokes = store.round2Started ? s2 : s1;
                        if (activeStrokes === 0) return <span style={{ color: '#cbd5e1', fontSize: '12.5px', fontWeight: 500 }}>–</span>;
                        if (activeRRel === 0) return <span style={{ color: '#475569', fontSize: '12.5px', fontWeight: 600 }}>E</span>;
                        return <span style={{ color: '#475569', fontSize: '12.5px', fontWeight: 600 }}>{relativeLabel(activeRRel)}</span>;
                      })()}
                    </div>
                  </td>

                  {/* RUNDA 1 DESKTOP */}
                  <td className="desktop-only-col col-r1" style={{ padding: '8px 6px', color: '#475569', fontWeight: 600, fontSize: '12.5px', borderRight: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {s1 > 0 ? (r1Rel === 0 ? 'E' : relativeLabel(r1Rel)) : '–'}
                    </div>
                  </td>

                  {/* RUNDA 2 DESKTOP */}
                  {store.round2Started && (
                    <td className="desktop-only-col col-r2" style={{ padding: '8px 6px', color: '#475569', fontWeight: 600, fontSize: '12.5px', borderRight: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {s2 > 0 ? (r2Rel === 0 ? 'E' : relativeLabel(r2Rel)) : '–'}
                      </div>
                    </td>
                  )}

                  {/* UDERZENIA DESKTOP */}
                  <td className="desktop-only-col col-strokes" style={{ padding: '8px 8px', fontWeight: 900, color: '#0f172a', borderRight: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {strokes || '–'}
                    </div>
                  </td>

                  {/* STRZAŁKA */}
                  <td className="desktop-only-col col-arrow" style={{ padding: '8px 2px', color: '#94a3b8' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ChevronRight size={15} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {preparedRows.length === 0 && (
          <div style={{ padding: '36px', textAlign: 'center', color: '#94a3b8', fontWeight: 700 }}>
            Brak aktywnych zawodników w wybranej kategorii.
          </div>
        )}
      </div>
    </section>
  );
}