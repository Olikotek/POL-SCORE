// src/components/Leaderboard.tsx
import { useMemo, useState, useEffect, useRef } from 'react';
import {
  ChevronRight,
  ClipboardList,
  ChevronDown,
  RefreshCw,
  Check,
} from 'lucide-react';
import type { Category, Store } from '@/types';
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

export function Leaderboard({
  store,
  onEnter,
  onOpenPlayer,
  onRefresh,
}: {
  store: Store;
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

  const handleSelectCategory = async (cat: Category | 'Wszystkie') => {
    setFilter(cat);
    localStorage.setItem('pffg_live_category', cat);
    setDropdownOpen(false);

    if (onRefresh) {
      setIsRefreshing(true);
      await onRefresh();
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activePlayers = useMemo(
    () => store.players.filter((p) => p.isActive !== false),
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

  return (
    <section className="leaderboard-container">
      {/* CSS DEDYKOWANY POD TABELĘ RESPANSYWNĄ */}
      <style>{`
        .leaderboard-container {
          background: #ffffff;
          border-radius: 12px;
          padding: 24px;
          border: 1px solid #cbd5e1;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);
        }
        .leaderboard-table-wrap {
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          width: 100%;
          overflow-x: auto;
        }
        .leaderboard-main-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          text-align: left;
        }
        .desktop-only-col {
          display: table-cell;
        }
        .mobile-only-col {
          display: none;
        }
        .header-country-desktop {
          display: inline;
        }
        .header-country-mobile {
          display: none;
        }
        .header-tot-desktop {
          display: inline;
        }
        .header-tot-mobile {
          display: none;
        }
        .player-name-desktop {
          display: inline;
        }
        .player-name-mobile {
          display: none;
        }
        .player-subline-mobile {
          display: none;
        }
        .player-club-desktop {
          display: inline;
        }

        /* DLA SMARTFONÓW: BRAK PRZEWIJANIA, SZTYWNE DOPASOWANIE */
        @media (max-width: 640px) {
          .leaderboard-container {
            padding: 12px 4px;
            border-radius: 8px;
            margin: 0 -4px;
          }
          .leaderboard-table-wrap {
            border-radius: 6px;
            border-left: none;
            border-right: none;
            overflow-x: hidden !important;
          }
          .leaderboard-main-table {
            table-layout: fixed !important;
            width: 100% !important;
          }
          .desktop-only-col {
            display: none !important;
          }
          .mobile-only-col {
            display: table-cell !important;
          }
          .header-country-desktop {
            display: none !important;
          }
          .header-country-mobile {
            display: inline !important;
            font-size: 11px !important;
            font-weight: 900 !important;
          }
          .header-tot-desktop {
            display: none !important;
          }
          .header-tot-mobile {
            display: inline !important;
          }
          .player-name-desktop {
            display: none !important;
          }
          .player-name-mobile {
            display: inline !important;
            font-size: 13px !important;
            font-weight: 800 !important;
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
          .player-club-desktop {
            display: none !important;
          }
        }
      `}</style>

      {/* NAGŁÓWEK */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', borderBottom: '2px solid #0f172a', paddingBottom: '16px', marginBottom: '18px' }}>
        <div>
          <p style={{ margin: 0, fontSize: '11px', fontWeight: 800, color: '#1b88cc', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {store.tournamentName}
          </p>
          <h1 style={{ margin: '4px 0 0 0', fontSize: '24px', fontWeight: 900, color: '#0f172a' }}>
            Tabela na żywo
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
            Oficjalna klasyfikacja turnieju aktualizowana w czasie rzeczywistym.
          </p>
        </div>

        <button
          onClick={onEnter}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'linear-gradient(135deg, #0b1329 0%, #1e293b 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(11, 19, 41, 0.15)',
          }}
        >
          <ClipboardList size={16} /> Wprowadź wynik <ChevronRight size={15} />
        </button>
      </div>

      {/* WYBÓR KATEGORII */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Kategoria:
          </span>

          <div style={{ position: 'relative' }} ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen((prev) => !prev)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: '#ffffff',
                border: '1px solid #94a3b8',
                borderRadius: '8px',
                padding: '7px 14px',
                fontSize: '13px',
                fontWeight: 800,
                color: '#0f172a',
                cursor: 'pointer',
              }}
            >
              <span>{CATEGORY_NAMES_PL[filter]}</span>
              <ChevronDown size={14} style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
            </button>

            {dropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  zIndex: 50,
                  minWidth: '220px',
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
                {(['Wszystkie', ...CATEGORIES] as (Category | 'Wszystkie')[]).map((cat) => (
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
                      fontSize: '13px',
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

        {onRefresh && (
          <button
            type="button"
            onClick={async () => {
              setIsRefreshing(true);
              await onRefresh();
              setTimeout(() => setIsRefreshing(false), 400);
            }}
            title="Odśwież wyniki"
            style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '7px 12px',
              fontSize: '12px',
              fontWeight: 700,
              color: '#475569',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
            Odśwież
          </button>
        )}

        <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>
          Zawodników: <b>{sorted.length}</b>
        </span>
      </div>

      {/* TABELA LIVE */}
      <div className="leaderboard-table-wrap">
        <table className="leaderboard-main-table">
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1', color: '#475569', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <th style={{ padding: '12px 6px', width: '48px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>POS</th>
              <th className="desktop-only-col" style={{ padding: '12px 6px', width: '48px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>+/-</th>
              <th style={{ padding: '12px 4px', width: '36px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                <span className="header-country-desktop">KRAJ</span>
                <span className="header-country-mobile">NAT</span>
              </th>
              <th style={{ padding: '12px 10px', textAlign: 'left', borderRight: '1px solid #e2e8f0' }}>ZAWODNIK</th>
              <th style={{ padding: '12px 6px', width: '70px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                <span className="header-tot-desktop">SUMA</span>
                <span className="header-tot-mobile">TOT</span>
              </th>
              <th style={{ padding: '12px 6px', width: '70px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>DOŁKI</th>
              
              {/* NA TELEFONIE: POKAZUJE TYLKO AKTUALNIE ROZGRYWANĄ RUNDĘ (R1 LUB R2) */}
              <th className="mobile-only-col" style={{ padding: '10px 4px', width: '42px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                {store.round2Started ? 'R2' : 'R1'}
              </th>

              {/* NA LAPTOPIE: PEŁNY ZESTAW RUND I UDERZEŃ */}
              <th className="desktop-only-col" style={{ padding: '12px 8px', width: '65px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>R1</th>
              {store.round2Started && (
                <th className="desktop-only-col" style={{ padding: '12px 8px', width: '65px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>R2</th>
              )}
              <th className="desktop-only-col" style={{ padding: '12px 8px', width: '95px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>UDERZENIA</th>
              
              {/* STRZAŁKA TYLKO NA DESKTOP */}
              <th className="desktop-only-col" style={{ padding: '12px 4px', width: '32px', textAlign: 'center' }}></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((player, index) => {
              const total = combinedRelative(player, holesR1, holesR2);
              const r1Rel = relative(player.scores[1] || [], holesR1);
              const r2Rel = relative(player.scores[2] || [], holesR2);
              const strokes = totalStrokes(player.scores[1] || []) + (store.round2Started ? totalStrokes(player.scores[2] || []) : 0);
              const thru = thruLabel(player);
              const rank = ranks[index];
              const tiedCount = ranks.filter((r) => r === rank).length;
              const isTied = tiedCount > 1;
              const display = isTied ? `T${rank}` : ordinalLabel(rank);
              const delta = positionDeltas.get(player.id) ?? { type: 'same', diff: 0 };
              const isEven = index % 2 === 0;

              // Skrót imienia i nazwisko na telefon (np. Aleksander Bielawa -> A. Bielawa)
              const formatShortPlayerName = (fullName: string) => {
                const parts = fullName.trim().split(/\s+/);
                if (parts.length >= 2) {
                  return `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
                }
                return fullName;
              };

              return (
                <tr
                  key={player.id}
                  onClick={() => onOpenPlayer(player.id)}
                  style={{
                    background: isEven ? '#ffffff' : '#f8fafc',
                    borderBottom: '1px solid #e2e8f0',
                    cursor: 'pointer',
                    transition: 'background 0.1s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = isEven ? '#ffffff' : '#f8fafc')}
                >
                  {/* POZYCJA */}
                  <td style={{ padding: '8px 2px', textAlign: 'center', fontWeight: 800, fontSize: '13px', color: '#0f172a', borderRight: '1px solid #e2e8f0' }}>
                    {display}
                  </td>

                  {/* ZMIANA POZYCJI (+/-) NA LAPTOP */}
                  <td className="desktop-only-col" style={{ padding: '10px 6px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                      {delta.type === 'up' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#16a34a', fontWeight: 800, fontSize: '12px' }}>
                          <span style={{ fontSize: '10px' }}>▲</span> {delta.diff}
                        </span>
                      ) : delta.type === 'down' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#dc2626', fontWeight: 800, fontSize: '12px' }}>
                          <span style={{ fontSize: '10px' }}>▼</span> {delta.diff}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontWeight: 700, fontSize: '14px', lineHeight: 1 }}>
                          -
                        </span>
                      )}
                    </div>
                  </td>

                  {/* FLAGA */}
                  <td style={{ padding: '8px 2px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                      {player.flagImage ? (
                        <img src={player.flagImage} alt={player.flag} style={{ width: '18px', height: '12px', objectFit: 'cover', borderRadius: '2px', border: '1px solid #cbd5e1', display: 'block' }} />
                      ) : (
                        <span style={{ border: '1px solid #cbd5e1', borderRadius: '2px', padding: '1px', fontSize: '11px', lineHeight: 1, display: 'inline-block' }}>{flagEmoji(player.flag)}</span>
                      )}
                    </div>
                  </td>

                  {/* ZAWODNIK + AVATAR + KLUB */}
                  <td style={{ padding: '6px 8px', borderRight: '1px solid #e2e8f0', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {player.avatar ? (
                        <img
                          src={player.avatar}
                          alt={player.name}
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: '1px solid #cbd5e1',
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <span
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: '#e2e8f0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '9px',
                            fontWeight: 800,
                            color: '#475569',
                            flexShrink: 0,
                          }}
                        >
                          {initialsLocal(player.name)}
                        </span>
                      )}

                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexWrap: 'nowrap', overflow: 'hidden' }}>
                          <span className="player-name-desktop" style={{ fontWeight: 800, color: '#0f172a', fontSize: '13px', whiteSpace: 'nowrap' }}>
                            {player.name}
                          </span>

                          <span className="player-name-mobile" style={{ color: '#0f172a' }}>
                            {formatShortPlayerName(player.name)}
                          </span>

                          {player.isAmateur && (
                            <span style={{ fontSize: '8px', fontWeight: 800, background: '#7ea128', color: '#ffffff', padding: '1px 3px', borderRadius: '3px', lineHeight: 1, flexShrink: 0 }}>
                              AM
                            </span>
                          )}

                          {player.club && (
                            <span className="player-club-desktop" style={{ fontSize: '11px', fontWeight: 500, color: '#64748b', whiteSpace: 'nowrap', marginLeft: '4px' }}>
                              {player.club}
                            </span>
                          )}
                        </div>

                        {/* PODPIS KLUBU POD NAZWISKIEM NA SMARTFONIE */}
                        <span className="player-subline-mobile">
                          {player.club || 'Bez klubu'}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* WYNIK CAŁKOWITY (SUMA / TOT) */}
                  <td style={{ padding: '8px 2px', textAlign: 'center', fontWeight: 900, borderRight: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                      {total < 0 ? (
                        <span style={{ color: '#dc2626', fontWeight: 900, fontSize: '13px' }}>
                          {relativeLabel(total)}
                        </span>
                      ) : (
                        <span style={{ color: '#0f172a', fontWeight: 900, fontSize: '13px' }}>
                          {total === 0 ? 'E' : relativeLabel(total)}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* DOŁKI (THRU) */}
                  <td style={{ padding: '8px 2px', textAlign: 'center', color: '#475569', fontWeight: 700, fontSize: '12px', borderRight: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                      {thru}
                    </div>
                  </td>

                  {/* RUNDA NA TELEFONIE (DYNAMICZNA: R1 LUB R2) */}
                  <td className="mobile-only-col" style={{ padding: '8px 2px', textAlign: 'center', fontWeight: 800, fontSize: '12px', borderRight: '1px solid #e2e8f0' }}>
                    {(() => {
                      const activeRRel = store.round2Started ? r2Rel : r1Rel;
                      const activeStrokes = store.round2Started ? totalStrokes(player.scores[2] || []) : totalStrokes(player.scores[1] || []);
                      if (activeStrokes === 0) return <span style={{ color: '#cbd5e1' }}>–</span>;
                      if (activeRRel < 0) return <span style={{ color: '#dc2626' }}>{relativeLabel(activeRRel)}</span>;
                      if (activeRRel === 0) return <span style={{ color: '#0f172a' }}>E</span>;
                      return <span style={{ color: '#0f172a' }}>{relativeLabel(activeRRel)}</span>;
                    })()}
                  </td>

                  {/* RUNDA 1 NA LAPTOPIE */}
                  <td className="desktop-only-col" style={{ padding: '10px 8px', textAlign: 'center', color: '#475569', fontWeight: 700, borderRight: '1px solid #e2e8f0' }}>
                    {totalStrokes(player.scores[1] || []) > 0 ? (r1Rel === 0 ? 'E' : relativeLabel(r1Rel)) : '–'}
                  </td>

                  {/* RUNDA 2 NA LAPTOPIE */}
                  {store.round2Started && (
                    <td className="desktop-only-col" style={{ padding: '10px 8px', textAlign: 'center', color: '#475569', fontWeight: 700, borderRight: '1px solid #e2e8f0' }}>
                      {totalStrokes(player.scores[2] || []) > 0 ? (r2Rel === 0 ? 'E' : relativeLabel(r2Rel)) : '–'}
                    </td>
                  )}

                  {/* UDERZENIA NA LAPTOPIE */}
                  <td className="desktop-only-col" style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 900, color: '#0f172a', borderRight: '1px solid #e2e8f0' }}>
                    {strokes || '–'}
                  </td>

                  {/* STRZAŁKA (TYLKO NA DESKTOP) */}
                  <td className="desktop-only-col" style={{ padding: '10px 4px', textAlign: 'center', color: '#94a3b8' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                      <ChevronRight size={15} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {sorted.length === 0 && (
          <div style={{ padding: '36px', textAlign: 'center', color: '#94a3b8', fontWeight: 700 }}>
            Brak aktywnych zawodników w wybranej kategorii.
          </div>
        )}
      </div>
    </section>
  );
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