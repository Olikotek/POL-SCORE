// src/components/TeeTimes.tsx
import { useState, useMemo } from 'react';
import { MapPin, Users, ChevronRight, KeyRound } from 'lucide-react';
import type { Round, Store, Tournament, Player } from '@/types';
import { flagEmoji, ROUNDS } from '@/types';
import { initials } from '@/scoring';
import { PlayerModal } from '@/components/PlayerModal';

function getPublicAvatarPath(name: string, existingAvatar?: string | null): string {
  if (existingAvatar && existingAvatar.startsWith('http')) {
    return existingAvatar;
  }
  if (existingAvatar && existingAvatar.startsWith('/')) {
    return existingAvatar;
  }
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-');
  return `/players/${normalized}.jpg`;
}

export function TeeTimes({
  store,
  activeTournament,
  onOpenPlayer,
}: {
  store: Store;
  activeTournament: Tournament | null;
  onOpenPlayer?: (playerId: string) => void;
}) {
  const [selectedRound, setSelectedRound] = useState<Round>(1);
  const [selectedPlayerModal, setSelectedPlayerModal] = useState<{ player: Player; rank: number } | null>(null);
  const [avatarErrors, setAvatarErrors] = useState<Record<string, boolean>>({});

  const roundFlights = useMemo(() => {
    return store.flights
      .filter((f) => f.round === selectedRound)
      .sort((a, b) => {
        if (a.teeTime && b.teeTime && a.teeTime !== b.teeTime) {
          return a.teeTime.localeCompare(b.teeTime);
        }
        return (a.startHole || 1) - (b.startHole || 1);
      });
  }, [store.flights, selectedRound]);

  const activePlayers = useMemo(() => {
    return store.players.filter((p) => p.isActive !== false && (p as any).is_active !== false);
  }, [store.players]);

  const currentCourseName = useMemo(() => {
    const courseId = selectedRound === 1 ? store.round1CourseId : store.round2CourseId;
    return store.courses.find((c) => c.id === courseId)?.name || activeTournament?.courseName || 'Pole Turniejowe';
  }, [store, selectedRound, activeTournament]);

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* ZWIĘZŁY NAGŁÓWEK */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          padding: '14px 18px',
          border: '1px solid #cbd5e1',
          boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 900, color: '#0f172a' }}>
            Godziny Startów
          </h1>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 700 }}>
            · {currentCourseName}
          </span>
        </div>

        {/* PRZEŁĄCZNIK RUNDY */}
        <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
          {ROUNDS.map((r) => {
            const isR2Disabled = r === 2 && !store.round2Started;
            return (
              <button
                key={r}
                type="button"
                onClick={() => setSelectedRound(r)}
                disabled={isR2Disabled}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: isR2Disabled ? 'not-allowed' : 'pointer',
                  opacity: isR2Disabled ? 0.45 : 1,
                  background: selectedRound === r ? '#0f172a' : 'transparent',
                  color: selectedRound === r ? '#ffffff' : '#475569',
                  transition: 'all 0.15s ease',
                }}
              >
                Runda {r}
              </button>
            );
          })}
        </div>
      </div>

      {/* LISTA FLIGHTÓW */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '12px' }}>
        {roundFlights.map((flight, fIdx) => {
          const members = activePlayers.filter((p) => p.flightId[selectedRound] === flight.id);
          const teeTimeDisplay = flight.teeTime || '10:00';
          const flightBadgeNum = String(fIdx + 1).padStart(2, '0');

          return (
            <div
              key={flight.id}
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                overflow: 'hidden',
                boxShadow: '0 1px 4px rgba(15, 23, 42, 0.04)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* BELKA FLIGHTU */}
              <div
                style={{
                  background: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                  padding: '10px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px', fontWeight: 900, color: '#0284c7' }}>
                    {teeTimeDisplay}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 800, background: '#e2e8f0', color: '#334155', padding: '2px 6px', borderRadius: '4px' }}>
                    {flight.name || `Flight ${flightBadgeNum}`}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#475569', fontSize: '11px', fontWeight: 700 }}>
                    <MapPin size={11} color="#0284c7" /> #{flight.startHole || 1}
                  </span>
                </div>

                <div
                  title="Kod do wpisywania wyników"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: '#fef3c7',
                    color: '#92400e',
                    border: '1px solid #fde68a',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 800,
                  }}
                >
                  <KeyRound size={11} />
                  <span>{flight.code}</span>
                </div>
              </div>

              {/* LISTA GRACZY */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {members.length > 0 ? (
                  members.map((p, idx) => {
                    const avatarPath = getPublicAvatarPath(p.name, p.avatar);
                    const hasError = avatarErrors[p.id];

                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          if (onOpenPlayer) {
                            onOpenPlayer(p.id);
                          } else {
                            setSelectedPlayerModal({ player: p, rank: idx + 1 });
                          }
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 14px',
                          borderBottom: idx !== members.length - 1 ? '1px solid #f1f5f9' : 'none',
                          background: idx % 2 === 0 ? '#ffffff' : '#fcfdfd',
                          cursor: 'pointer',
                          transition: 'background 0.1s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f9ff')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = idx % 2 === 0 ? '#ffffff' : '#fcfdfd')}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                          <img
                            src={p.flagImage || flagEmoji(p.flag || 'PL')}
                            alt={p.flag || 'PL'}
                            style={{
                              width: '20px',
                              height: '14px',
                              objectFit: 'cover',
                              borderRadius: '2px',
                              border: '1px solid #cbd5e1',
                              display: 'block',
                              flexShrink: 0,
                            }}
                          />

                          {!hasError ? (
                            <img
                              src={avatarPath}
                              alt={p.name}
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                objectFit: 'cover',
                                border: '1px solid #cbd5e1',
                                flexShrink: 0,
                                backgroundColor: '#e2e8f0',
                              }}
                              onError={() => {
                                setAvatarErrors((prev) => ({ ...prev, [p.id]: true }));
                              }}
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
                                fontSize: '10px',
                                fontWeight: 800,
                                color: '#475569',
                                flexShrink: 0,
                                border: '1px solid #cbd5e1',
                              }}
                            >
                              {initials(p.name)}
                            </span>
                          )}

                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <b style={{ fontSize: '13px', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {p.name}
                              </b>
                              {p.isAmateur && (
                                <span style={{ fontSize: '8.5px', fontWeight: 800, background: '#7ea128', color: '#ffffff', padding: '1px 4px', borderRadius: '3px', lineHeight: 1 }}>
                                  AM
                                </span>
                              )}
                            </div>
                            <small style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {p.club || 'Bez klubu'} · {p.category}
                            </small>
                          </div>
                        </div>

                        <ChevronRight size={14} color="#94a3b8" style={{ flexShrink: 0 }} />
                      </div>
                    );
                  })
                ) : (
                  <div style={{ padding: '18px', textAlign: 'center', color: '#94a3b8', fontSize: '12px', fontWeight: 600 }}>
                    Brak graczy we flightcie
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {roundFlights.length === 0 && (
        <div style={{ background: '#ffffff', borderRadius: '12px', padding: '36px 20px', textAlign: 'center', color: '#64748b', border: '1px solid #cbd5e1' }}>
          <Users size={28} color="#94a3b8" style={{ margin: '0 auto 8px auto' }} />
          <b style={{ display: 'block', fontSize: '15px', color: '#0f172a' }}>Brak grup startowych dla Rundy {selectedRound}</b>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px' }}>
            Flighty dla tej rundy nie zostały jeszcze utworzone.
          </p>
        </div>
      )}

      {/* MODAL PROFILU */}
      {selectedPlayerModal && (
        <PlayerModal
          player={selectedPlayerModal.player}
          rank={selectedPlayerModal.rank}
          store={store}
          tournaments={[activeTournament].filter(Boolean) as Tournament[]}
          leaguePoints={[]}
          hideScorecardTab={false}
          initialTab="scorecard"
          onClose={() => setSelectedPlayerModal(null)}
        />
      )}
    </section>
  );
}