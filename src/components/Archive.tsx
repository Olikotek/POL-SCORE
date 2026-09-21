// src/components/Archive.tsx
import { useState, useMemo, useRef } from 'react';
import { Calendar, MapPin, ArrowLeft, ChevronRight, ChevronDown, Check } from 'lucide-react';
import type { Store, Category, Hole } from '@/types';
import { CATEGORIES, flagEmoji } from '@/types';
import { combinedRelative, relativeLabel, totalStrokes } from '@/scoring';
import { PlayerModal } from '@/components/PlayerModal';
import { ARCHIVE_REGISTRY, type StaticArchiveTournament } from '@/data/archive';

export const CATEGORY_NAMES_PL: Record<Category | 'Wszystkie', string> = {
  Wszystkie: 'Wszystkie (Absolut)',
  Men: 'Mężczyźni',
  Women: 'Kobiety',
  Senior: 'Seniorzy',
  Junior: 'Juniorzy',
  'Senior+': 'Seniorzy+',
};

const SEASONS = ['2026', '2027', '2028'] as const;

const countPlayedHoles = (scores: number[] = []) => scores.filter((s) => s > 0).length;

function formatShortPlayerName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length >= 2) {
    return parts[0][0] + '. ' + parts.slice(1).join(' ');
  }
  return fullName;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '–';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getPublicAvatarPath(name: string, existingAvatar?: string | null): string {
  if (existingAvatar && existingAvatar.startsWith('http')) return existingAvatar;
  if (existingAvatar && existingAvatar.startsWith('/')) return existingAvatar;
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-');
  return '/players/' + normalized + '.jpg';
}

function renderFlag(flagValue: string | undefined) {
  const flag = flagValue || 'PL';
  const isUrl = flag.startsWith('http://') || flag.startsWith('https://') || flag.startsWith('/');
  const src = isUrl ? flag : flagEmoji(flag);

  return (
    <img
      src={src}
      alt={flag}
      style={{
        width: '18px',
        height: '12px',
        objectFit: 'cover',
        borderRadius: '2px',
        border: '1px solid #cbd5e1',
        display: 'block',
      }}
      onError={(e) => {
        (e.target as HTMLElement).style.display = 'none';
      }}
    />
  );
}

export function Archive({
  store,
}: {
  tournaments?: any[];
  store: Store;
  onOpenPlayer?: (playerId: string) => void;
  isAdmin?: boolean;
}) {
  const [selectedTournament, setSelectedTournament] = useState<StaticArchiveTournament | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [filter, setFilter] = useState<'all' | 'league' | 'training'>('all');
  const [categoryFilter, setCategoryFilter] = useState<Category | 'Wszystkie'>('Wszystkie');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [modalPlayerId, setModalPlayerId] = useState<string | null>(null);
  const [failedAvatars, setFailedAvatars] = useState<Record<string, boolean>>({});

  const completed = ARCHIVE_REGISTRY;

  const filtered = useMemo(() => {
    return completed.filter((t) => {
      const tourneyYear = t.date ? t.date.slice(0, 4) : '2026';
      if (tourneyYear !== selectedYear) return false;

      if (filter === 'league') return t.isLeague;
      if (filter === 'training') return !t.isLeague;
      return true;
    });
  }, [completed, selectedYear, filter]);

  const archivedHoles = useMemo<{ 1: Hole[]; 2: Hole[] }>(() => {
    if (!selectedTournament) {
      return { 1: store.holesByRound[1] || [], 2: store.holesByRound[2] || [] };
    }
    return selectedTournament.holes;
  }, [selectedTournament, store.holesByRound]);

  const rankedArchivedPlayers = useMemo(() => {
    if (!selectedTournament) return [];

    const sorted = [...selectedTournament.players]
      .filter((p) => categoryFilter === 'Wszystkie' || p.category === categoryFilter)
      .sort((a, b) => {
        const relA = combinedRelative(a, archivedHoles[1], archivedHoles[2]);
        const relB = combinedRelative(b, archivedHoles[1], archivedHoles[2]);
        if (relA !== relB) return relA - relB;
        const strokesA = totalStrokes(a.scores[1] || []) + totalStrokes(a.scores[2] || []);
        const strokesB = totalStrokes(b.scores[1] || []) + totalStrokes(b.scores[2] || []);
        return strokesA - strokesB;
      });

    return sorted.map((p, idx) => ({
      player: p,
      rank: idx + 1,
      rel: combinedRelative(p, archivedHoles[1], archivedHoles[2]),
    }));
  }, [selectedTournament, categoryFilter, archivedHoles]);

  const modalStore = useMemo<Store>(() => {
    if (!selectedTournament) return store;
    return {
      ...store,
      tournamentName: selectedTournament.name,
      holesByRound: selectedTournament.holes,
      players: selectedTournament.players,
      round2Started: selectedTournament.players.some((p) => p.scores[2] && p.scores[2].some((s: number) => s > 0)),
      round1Approved: true,
    };
  }, [store, selectedTournament]);

  const modalPlayer = modalPlayerId && selectedTournament 
    ? selectedTournament.players.find((p) => p.id === modalPlayerId) ?? null 
    : null;

  const modalRank = modalPlayer 
    ? (rankedArchivedPlayers.find((r) => r.player.id === modalPlayer.id)?.rank || 1) 
    : 1;

  if (selectedTournament) {
    return (
      <section className="archive-detail-container">
        <style>{`
          .archive-detail-container {
            background: #ffffff;
            border-radius: 12px;
            padding: 16px 20px;
            border: 1px solid #cbd5e1;
            box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);
            width: 100%;
            box-sizing: border-box;
          }
          .archive-top-info {
            margin-bottom: 12px;
            padding-bottom: 12px;
            border-bottom: 2px solid #0f172a;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            flex-wrap: wrap;
            gap: 12px;
          }
          .archive-top-controls {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
            margin-bottom: 12px;
            flex-wrap: nowrap;
          }
          .archive-table-wrap {
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            width: 100%;
            overflow-x: auto;
            box-sizing: border-box;
          }
          .archive-main-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
            text-align: left;
            table-layout: auto;
          }
          .archive-main-table thead tr th {
            color: #475569;
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            background: #f8fafc;
            border-bottom: 2px solid #cbd5e1;
          }
          .arc-col-pos { width: 44px; text-align: center; }
          .arc-col-nat { width: 36px; text-align: center; }
          .arc-col-player { width: auto; text-align: left; }
          .arc-col-sum { width: 70px; text-align: center; }
          .arc-col-holes { width: 65px; text-align: center; }
          .arc-col-r1 { width: 60px; text-align: center; }
          .arc-col-strokes { width: 90px; text-align: center; }
          .arc-col-arrow { width: 30px; text-align: center; }

          .arc-desktop-only { display: table-cell; }
          .arc-mobile-only { display: none; }
          .arc-player-name-desktop { display: inline; font-weight: 800; font-size: 13px; color: #0f172a; white-space: nowrap; }
          .arc-player-name-mobile { display: none; }
          .arc-player-subline-mobile { display: none; }
          .arc-player-club-desktop { display: inline; font-size: 11px; font-weight: 500; color: #64748b; white-space: nowrap; margin-left: 6px; }

          @media (max-width: 640px) {
            .archive-detail-container {
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
            .archive-top-info {
              padding: 0 12px 10px 12px !important;
              margin-bottom: 8px !important;
            }
            .archive-top-controls {
              padding: 0 10px !important;
              margin-bottom: 8px !important;
            }
            .archive-table-wrap {
              border-radius: 0 !important;
              border-left: none !important;
              border-right: none !important;
              overflow-x: hidden !important;
              width: 100% !important;
            }
            .archive-main-table {
              table-layout: fixed !important;
              width: 100% !important;
            }
            .arc-desktop-only { display: none !important; }
            .arc-mobile-only { display: table-cell !important; }

            .arc-col-pos { width: 34px !important; }
            .arc-col-nat { width: 28px !important; }
            .arc-col-player { width: auto !important; }
            .arc-col-sum { width: 46px !important; }
            .arc-col-holes { width: 40px !important; }
            .arc-col-r-mob { width: 40px !important; text-align: center !important; }

            .arc-player-name-desktop { display: none !important; }
            .arc-player-name-mobile {
              display: inline !important;
              font-size: 13px !important;
              font-weight: 800 !important;
              color: #0f172a !important;
              white-space: nowrap !important;
              overflow: hidden !important;
              text-overflow: ellipsis !important;
            }
            .arc-player-subline-mobile {
              display: block !important;
              font-size: 10px !important;
              color: #64748b !important;
              white-space: nowrap !important;
              overflow: hidden !important;
              text-overflow: ellipsis !important;
              line-height: 1.2 !important;
              margin-top: 1px !important;
            }
            .arc-player-club-desktop { display: none !important; }
          }
        `}</style>

        <div className="archive-top-info">
          <div>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}>
              <span style={{ fontSize: '10px', fontWeight: 800, background: '#f1f5f9', color: '#64748b', padding: '2px 6px', borderRadius: '4px' }}>
                ARCHIWUM
              </span>
              {selectedTournament.isLeague && (
                <span style={{ fontSize: '10px', fontWeight: 800, background: '#dcfce7', color: '#15803d', padding: '2px 6px', borderRadius: '4px' }}>
                  LIGA PFFG
                </span>
              )}
            </div>
            <h1 style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', margin: 0 }}>
              {selectedTournament.name}
            </h1>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '3px 0 0 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span><Calendar size={12} style={{ display: 'inline', marginRight: '3px' }} />{selectedTournament.date}</span>
              {selectedTournament.courseName && (
                <span><MapPin size={12} style={{ display: 'inline', marginRight: '3px' }} />{selectedTournament.courseName}</span>
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setSelectedTournament(null)}
            style={{
              background: '#0f172a',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <ArrowLeft size={14} /> Wróć
          </button>
        </div>

        <div className="archive-top-controls">
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
              <span>{CATEGORY_NAMES_PL[categoryFilter]}</span>
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
                    onClick={() => {
                      setCategoryFilter(cat);
                      setDropdownOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      background: categoryFilter === cat ? '#eff6ff' : 'transparent',
                      color: categoryFilter === cat ? '#1b88cc' : '#334155',
                      fontSize: '12.5px',
                      fontWeight: categoryFilter === cat ? 800 : 600,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span>{CATEGORY_NAMES_PL[cat]}</span>
                    {categoryFilter === cat && <Check size={14} color="#1b88cc" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>
            Graczy: <b>{rankedArchivedPlayers.length}</b>
          </span>
        </div>

        <div className="archive-table-wrap">
          <table className="archive-main-table">
            <thead>
              <tr>
                <th className="arc-col-pos" style={{ padding: '9px 2px', borderRight: '1px solid #e2e8f0' }}>POS</th>
                <th className="arc-col-nat" style={{ padding: '9px 2px', borderRight: '1px solid #e2e8f0' }}>NAT</th>
                <th className="arc-col-player" style={{ padding: '9px 8px', borderRight: '1px solid #e2e8f0' }}>ZAWODNIK</th>
                <th className="arc-col-sum" style={{ padding: '9px 4px', borderRight: '1px solid #e2e8f0' }}>TOT</th>
                <th className="arc-col-holes" style={{ padding: '9px 4px', borderRight: '1px solid #e2e8f0' }}>DOŁKI</th>
                
                <th className="arc-mobile-only arc-col-r-mob" style={{ padding: '9px 2px', borderRight: '1px solid #e2e8f0' }}>
                  R1
                </th>

                <th className="arc-desktop-only arc-col-r1" style={{ padding: '9px 6px', borderRight: '1px solid #e2e8f0' }}>R1</th>
                <th className="arc-desktop-only arc-col-strokes" style={{ padding: '9px 8px', borderRight: '1px solid #e2e8f0' }}>UDERZENIA</th>
                <th className="arc-desktop-only arc-col-arrow" style={{ padding: '9px 2px' }}></th>
              </tr>
            </thead>
            <tbody>
              {rankedArchivedPlayers.map(({ player: p, rank, rel }, index) => {
                const thru = countPlayedHoles(p.scores[1]) + countPlayedHoles(p.scores[2]);
                const strokes = totalStrokes(p.scores[1] || []) + totalStrokes(p.scores[2] || []);
                const r1Played = countPlayedHoles(p.scores[1]);

                const r1Rel = r1Played > 0
                  ? relativeLabel(p.scores[1].reduce((sum: number, s: number, i: number) => s > 0 ? sum + (s - (archivedHoles[1][i]?.par || 4)) : sum, 0))
                  : '–';

                const isEven = index % 2 === 0;
                const avatarUrl = getPublicAvatarPath(p.name, p.avatar);
                const hasAvatarFailed = failedAvatars[p.id];
                const shortName = formatShortPlayerName(p.name);

                return (
                  <tr
                    key={p.id}
                    onClick={() => setModalPlayerId(p.id)}
                    style={{
                      background: isEven ? '#ffffff' : '#f8fafc',
                      borderBottom: '1px solid #e2e8f0',
                      cursor: 'pointer',
                    }}
                  >
                    <td className="arc-col-pos" style={{ padding: '8px 2px', borderRight: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                        {rank === 1 ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '5px', background: '#fef08a', color: '#854d0e', fontWeight: 900, fontSize: '11px', border: '1px solid #fde047' }}>
                            1
                          </span>
                        ) : rank === 2 ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '5px', background: '#f1f5f9', color: '#334155', fontWeight: 900, fontSize: '11px', border: '1px solid #cbd5e1' }}>
                            2
                          </span>
                        ) : rank === 3 ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '5px', background: '#ffedd5', color: '#9a3412', fontWeight: 900, fontSize: '11px', border: '1px solid #fed7aa' }}>
                            3
                          </span>
                        ) : (
                          <span style={{ fontWeight: 800, fontSize: '12px', color: '#0f172a' }}>
                            {rank}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="arc-col-nat" style={{ padding: '8px 2px', borderRight: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {renderFlag(p.flag)}
                      </div>
                    </td>

                    <td className="arc-col-player" style={{ padding: '6px 6px', borderRight: '1px solid #e2e8f0', overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        {!hasAvatarFailed ? (
                          <img
                            src={avatarUrl}
                            alt={p.name}
                            style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '50%',
                              objectFit: 'cover',
                              border: '1.5px solid #cbd5e1',
                              flexShrink: 0,
                              backgroundColor: '#e2e8f0',
                            }}
                            onError={() => setFailedAvatars((prev) => ({ ...prev, [p.id]: true }))}
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
                            {getInitials(p.name)}
                          </span>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1, overflow: 'hidden' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'nowrap', overflow: 'hidden' }}>
                            <span className="arc-player-name-desktop">
                              {p.name}
                            </span>
                            <span className="arc-player-name-mobile">
                              {shortName}
                            </span>
                            {p.club && (
                              <span className="arc-player-club-desktop">
                                {p.club}
                              </span>
                            )}
                          </div>
                          <span className="arc-player-subline-mobile">
                            {p.club || 'Bez klubu'}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="arc-col-sum" style={{ padding: '8px 2px', borderRight: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {rel < 0 ? (
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
                            {thru > 0 ? relativeLabel(rel) : 'E'}
                          </span>
                        ) : (
                          <span style={{ color: '#0f172a', fontWeight: 800, fontSize: '13px' }}>
                            {thru > 0 ? (rel === 0 ? 'E' : relativeLabel(rel)) : 'E'}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="arc-col-holes" style={{ padding: '8px 2px', borderRight: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontWeight: 600, fontSize: '12.5px' }}>
                        {thru}
                      </div>
                    </td>

                    <td className="arc-mobile-only arc-col-r-mob" style={{ padding: '8px 2px', borderRight: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontWeight: 600, fontSize: '12.5px' }}>
                        {r1Rel}
                      </div>
                    </td>

                    <td className="arc-desktop-only arc-col-r1" style={{ padding: '8px 6px', color: '#475569', fontWeight: 600, fontSize: '12.5px', borderRight: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {r1Rel}
                      </div>
                    </td>

                    <td className="arc-desktop-only arc-col-strokes" style={{ padding: '8px 8px', fontWeight: 900, color: '#0f172a', borderRight: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {strokes > 0 ? strokes : '–'}
                      </div>
                    </td>

                    <td className="arc-desktop-only arc-col-arrow" style={{ padding: '8px 2px', color: '#94a3b8' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ChevronRight size={15} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {rankedArchivedPlayers.length === 0 && (
            <div style={{ padding: '36px', textAlign: 'center', color: '#94a3b8', fontWeight: 700 }}>
              Brak zapisanych wyników dla tej kategorii w turnieju.
            </div>
          )}
        </div>

        {modalPlayer && (
          <PlayerModal
            player={modalPlayer}
            store={modalStore}
            rank={modalRank}
            initialTab="scorecard"
            leaguePoints={selectedTournament.leaguePoints || []}
            tournaments={[selectedTournament as any]}
            onClose={() => setModalPlayerId(null)}
          />
        )}
      </section>
    );
  }

  return (
    <section className="archive-list-container">
      <style>{`
        .archive-list-container {
          background: #ffffff;
          border-radius: 12px;
          padding: 20px 24px;
          border: 1px solid #cbd5e1;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);
          width: 100%;
          box-sizing: border-box;
        }
        .archive-header-row {
          border-bottom: 2px solid #0f172a;
          padding-bottom: 12px;
          margin-bottom: 16px;
        }
        .archive-filters-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }
        .archive-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 16px;
        }

        @media (max-width: 640px) {
          .archive-list-container {
            padding: 12px 10px !important;
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
          .archive-header-row {
            padding-bottom: 8px !important;
            margin-bottom: 12px !important;
          }
          .archive-header-row h1 {
            font-size: 20px !important;
          }
          .archive-filters-row {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 10px !important;
            margin-bottom: 12px !important;
          }
          .archive-cards-grid {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }
        }
      `}</style>

      {/* NAGŁÓWEK - CZYSTY, BEZ ZBĘDNYCH OPISÓW */}
      <div className="archive-header-row">
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>
          Archiwum Turniejów
        </h1>
      </div>

      {/* BELKA FILTRÓW: ROK / SEZON + TYP ROZGRYWEK */}
      <div className="archive-filters-row">
        {/* WYBÓR SEZONU */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            SEZON:
          </span>
          <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '8px', border: '1px solid #e2e8f0', flex: 1 }}>
            {SEASONS.map((yr) => (
              <button
                key={yr}
                type="button"
                onClick={() => setSelectedYear(yr)}
                style={{
                  border: 'none',
                  padding: '5px 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  flex: 1,
                  background: selectedYear === yr ? '#0284c7' : 'transparent',
                  color: selectedYear === yr ? '#ffffff' : '#64748b',
                  transition: 'all 0.15s ease',
                }}
              >
                {yr}
              </button>
            ))}
          </div>
        </div>

        {/* TYP TURNIEJU */}
        <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <button
            type="button"
            onClick={() => setFilter('all')}
            style={{
              border: 'none',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              flex: 1,
              background: filter === 'all' ? '#0f172a' : 'transparent',
              color: filter === 'all' ? '#ffffff' : '#64748b',
            }}
          >
            Wszystkie ({filtered.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('league')}
            style={{
              border: 'none',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              flex: 1,
              background: filter === 'league' ? '#0f172a' : 'transparent',
              color: filter === 'league' ? '#ffffff' : '#64748b',
            }}
          >
            Ligowe PFFG
          </button>
          <button
            type="button"
            onClick={() => setFilter('training')}
            style={{
              border: 'none',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              flex: 1,
              background: filter === 'training' ? '#0f172a' : 'transparent',
              color: filter === 'training' ? '#ffffff' : '#64748b',
            }}
          >
            Towarzyskie
          </button>
        </div>
      </div>

      {/* LISTA KART TURNIEJÓW */}
      <div className="archive-cards-grid">
        {filtered.map((t) => (
          <div
            key={t.id}
            onClick={() => setSelectedTournament(t)}
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              padding: '16px',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
              transition: 'all 0.15s ease',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#1b88cc';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(27, 136, 204, 0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#cbd5e1';
              e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.03)';
            }}
          >
            <div>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                {t.isLeague ? (
                  <span style={{ fontSize: '10px', fontWeight: 800, background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '4px', border: '1px solid #86efac' }}>
                    LIGA PFFG
                  </span>
                ) : (
                  <span style={{ fontSize: '10px', fontWeight: 800, background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: '4px' }}>
                    TOWARZYSKI
                  </span>
                )}
              </div>

              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>
                {t.name}
              </h3>

              <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span><Calendar size={13} style={{ display: 'inline', marginRight: '5px' }} />{t.date}</span>
                {t.courseName && (
                  <span><MapPin size={13} style={{ display: 'inline', marginRight: '5px' }} />{t.courseName}</span>
                )}
              </div>
            </div>

            <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#1b88cc' }}>Zobacz tabelę i karty</span>
              <ChevronRight size={16} color="#1b88cc" />
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div style={{ gridColumn: '1 / -1', padding: '36px', textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', fontSize: '13px', fontWeight: 700 }}>
            Brak zakończonych turniejów w sezonie {selectedYear}.
          </div>
        )}
      </div>
    </section>
  );
}