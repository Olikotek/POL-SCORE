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

const countPlayedHoles = (scores: number[] = []) => scores.filter((s) => s > 0).length;

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
  return `/players/${normalized}.jpg`;
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
        width: '22px',
        height: '15px',
        objectFit: 'cover',
        borderRadius: '2px',
        border: '1px solid #cbd5e1',
        display: 'inline-block',
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
  const [filter, setFilter] = useState<'all' | 'league' | 'training'>('all');
  const [categoryFilter, setCategoryFilter] = useState<Category | 'Wszystkie'>('Wszystkie');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [modalPlayerId, setModalPlayerId] = useState<string | null>(null);
  const [failedAvatars, setFailedAvatars] = useState<Record<string, boolean>>({});

  const completed = ARCHIVE_REGISTRY;

  const filtered = useMemo(() => {
    return completed.filter((t) => {
      if (filter === 'league') return t.isLeague;
      if (filter === 'training') return !t.isLeague;
      return true;
    });
  }, [completed, filter]);

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
      <section style={{ background: '#ffffff', borderRadius: '12px', padding: '24px', border: '1px solid #cbd5e1', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', borderBottom: '2px solid #0f172a', paddingBottom: '16px', marginBottom: '18px' }}>
          <div>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: '4px' }}>
                ARCHIWUM WYNIKÓW
              </span>
              {selectedTournament.isLeague && (
                <span style={{ fontSize: '11px', fontWeight: 800, background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '4px' }}>
                  LIGA PFFG
                </span>
              )}
            </div>
            <h1 style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a', margin: 0 }}>
              {selectedTournament.name}
            </h1>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span><Calendar size={13} style={{ display: 'inline', marginRight: '4px' }} />{selectedTournament.date}</span>
              {selectedTournament.courseName && (
                <span><MapPin size={13} style={{ display: 'inline', marginRight: '4px' }} />{selectedTournament.courseName}</span>
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
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <ArrowLeft size={15} /> Wróć do listy turniejów
          </button>
        </div>

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
                <span>{CATEGORY_NAMES_PL[categoryFilter]}</span>
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
                        fontSize: '13px',
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
          </div>

          <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>
            Zawodników w kategorii: <b>{rankedArchivedPlayers.length}</b>
          </span>
        </div>

        <div style={{ overflowX: 'auto', border: '1px solid #cbd5e1', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1', color: '#475569', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <th style={{ padding: '12px 10px', width: '60px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>POZ</th>
                <th style={{ padding: '12px 8px', width: '54px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>KRAJ</th>
                <th style={{ padding: '12px 14px', borderRight: '1px solid #e2e8f0' }}>ZAWODNIK</th>
                <th style={{ padding: '12px 10px', width: '75px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>WYNIK</th>
                <th style={{ padding: '12px 8px', width: '60px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>DOŁKI</th>
                <th style={{ padding: '12px 8px', width: '60px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>R1</th>
                <th style={{ padding: '12px 12px', width: '90px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>UDERZENIA</th>
                <th style={{ padding: '12px 8px', width: '36px', textAlign: 'center' }}></th>
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

                return (
                  <tr
                    key={p.id}
                    onClick={() => setModalPlayerId(p.id)}
                    style={{
                      background: isEven ? '#ffffff' : '#f8fafc',
                      borderBottom: '1px solid #e2e8f0',
                      cursor: 'pointer',
                      transition: 'background 0.1s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = isEven ? '#ffffff' : '#f8fafc')}
                  >
                    <td style={{ padding: '10px 8px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                        {rank === 1 ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '6px', background: '#fef08a', color: '#854d0e', fontWeight: 900, fontSize: '13px', border: '1px solid #fde047' }}>
                            1
                          </span>
                        ) : rank === 2 ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '6px', background: '#f1f5f9', color: '#334155', fontWeight: 900, fontSize: '13px', border: '1px solid #cbd5e1' }}>
                            2
                          </span>
                        ) : rank === 3 ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '6px', background: '#ffedd5', color: '#9a3412', fontWeight: 900, fontSize: '13px', border: '1px solid #fed7aa' }}>
                            3
                          </span>
                        ) : (
                          <span style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a' }}>
                            {rank}
                          </span>
                        )}
                      </div>
                    </td>

                    <td style={{ padding: '10px 8px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                        {renderFlag(p.flag)}
                      </div>
                    </td>

                    <td style={{ padding: '10px 14px', borderRight: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'nowrap' }}>
                        {!hasAvatarFailed ? (
                          <img
                            src={avatarUrl}
                            alt={p.name}
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              objectFit: 'cover',
                              backgroundColor: '#e2e8f0',
                              flexShrink: 0,
                              display: 'block',
                              border: '1px solid #cbd5e1',
                            }}
                            onError={() => setFailedAvatars((prev) => ({ ...prev, [p.id]: true }))}
                          />
                        ) : (
                          <span
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              background: '#e2e8f0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '11px',
                              fontWeight: 800,
                              color: '#475569',
                              flexShrink: 0,
                            }}
                          >
                            {getInitials(p.name)}
                          </span>
                        )}

                        <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '14px', whiteSpace: 'nowrap' }}>
                          {p.name}
                        </span>

                        {p.club && (
                          <span style={{ fontSize: '12px', fontWeight: 500, color: '#64748b', whiteSpace: 'nowrap' }}>
                            {p.club}
                          </span>
                        )}
                      </div>
                    </td>

                    <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 900, fontSize: '13px', borderRight: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                        {rel < 0 ? (
                          <span style={{ color: '#dc2626', background: '#fee2e2', padding: '3px 7px', borderRadius: '4px' }}>
                            {thru > 0 ? relativeLabel(rel) : 'E'}
                          </span>
                        ) : (
                          <span style={{ color: '#0f172a' }}>
                            {thru > 0 ? relativeLabel(rel) : 'E'}
                          </span>
                        )}
                      </div>
                    </td>

                    <td style={{ padding: '10px 8px', textAlign: 'center', color: '#475569', fontWeight: 700, borderRight: '1px solid #e2e8f0' }}>
                      {thru}
                    </td>

                    <td style={{ padding: '10px 8px', textAlign: 'center', color: '#475569', fontWeight: 700, borderRight: '1px solid #e2e8f0' }}>
                      {r1Rel}
                    </td>

                    <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 900, color: '#0f172a', borderRight: '1px solid #e2e8f0' }}>
                      {strokes > 0 ? strokes : '–'}
                    </td>

                    <td style={{ padding: '10px 6px', textAlign: 'center', color: '#94a3b8' }}>
                      <ChevronRight size={15} />
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
    <section style={{ background: '#ffffff', borderRadius: '12px', padding: '24px', border: '1px solid #cbd5e1', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '16px', marginBottom: '18px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <p style={{ margin: 0, fontSize: '11px', fontWeight: 800, color: '#1b88cc', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            HISTORIA ROZGRYWEK
          </p>
          <h1 style={{ margin: '4px 0 0 0', fontSize: '26px', fontWeight: 900, color: '#0f172a' }}>
            Archiwum Turniejów
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
            Przeglądaj zakończone turnieje, oficjalne tabele wyników i karty graczy.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '6px', background: '#f1f5f9', padding: '4px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <button
            type="button"
            onClick={() => setFilter('all')}
            style={{
              border: 'none',
              padding: '7px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              background: filter === 'all' ? '#0f172a' : 'transparent',
              color: filter === 'all' ? '#ffffff' : '#64748b',
            }}
          >
            Wszystkie ({completed.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('league')}
            style={{
              border: 'none',
              padding: '7px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
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
              padding: '7px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              background: filter === 'training' ? '#0f172a' : 'transparent',
              color: filter === 'training' ? '#ffffff' : '#64748b',
            }}
          >
            Towarzyskie
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
        {filtered.map((t) => (
          <div
            key={t.id}
            onClick={() => setSelectedTournament(t)}
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              padding: '18px',
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

            <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#1b88cc' }}>Zobacz tabelę i karty</span>
              <ChevronRight size={16} color="#1b88cc" />
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
            Brak zakończonych turniejów w archiwum.
          </div>
        )}
      </div>
    </section>
  );
}