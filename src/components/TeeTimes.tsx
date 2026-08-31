// src/components/TeeTimes.tsx
import { useState, useMemo } from 'react';
import { Clock, MapPin, Users, Flag, ChevronRight, KeyRound } from 'lucide-react';
import type { Round, Store, Tournament, Player } from '@/types';
import { flagEmoji, ROUNDS } from '@/types';
import { initials } from '@/scoring';
import { PlayerModal } from '@/components/PlayerModal';

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

  const roundFlights = useMemo(() => {
    return store.flights
      .filter((f) => f.round === selectedRound)
      .sort((a, b) => (a.startHole || 1) - (b.startHole || 1));
  }, [store.flights, selectedRound]);

  const activePlayers = useMemo(() => {
    return store.players.filter((p) => p.isActive !== false && (p as any).is_active !== false);
  }, [store.players]);

  const currentCourseName = useMemo(() => {
    const courseId = selectedRound === 1 ? store.round1CourseId : store.round2CourseId;
    return store.courses.find((c) => c.id === courseId)?.name || activeTournament?.courseName || 'Pole Turniejowe';
  }, [store, selectedRound, activeTournament]);

  const formattedDate = useMemo(() => {
    if (!activeTournament?.date) return '30.08.2026';
    const [y, m, d] = activeTournament.date.split('-');
    return `${d}.${m}.${y}`;
  }, [activeTournament?.date]);

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* NAGŁÓWEK KARTY */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '14px',
          padding: '20px 24px',
          border: '1px solid #cbd5e1',
          boxShadow: '0 4px 12px rgba(15, 23, 42, 0.05)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: '11px', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            ROZPISKA STARTOWA · {activeTournament?.name || 'Turniej Footgolfa'}
          </p>
          <h1 style={{ margin: '4px 0 0 0', fontSize: '24px', fontWeight: 900, color: '#0f172a' }}>
            Godziny Startów (Tee Times)
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
            Sprawdź skład swojego flightu, dołek startowy oraz 4-cyfrowy kod do wpisywania wyników.
          </p>
        </div>

        {/* PRZEŁĄCZNIK RUNDY */}
        <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
          {ROUNDS.map((r) => {
            const isR2Disabled = r === 2 && !store.round2Started;
            return (
              <button
                key={r}
                type="button"
                onClick={() => setSelectedRound(r)}
                disabled={isR2Disabled}
                style={{
                  padding: '8px 18px',
                  borderRadius: '7px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: isR2Disabled ? 'not-allowed' : 'pointer',
                  opacity: isR2Disabled ? 0.45 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: selectedRound === r ? '#0f172a' : 'transparent',
                  color: selectedRound === r ? '#ffffff' : '#475569',
                  transition: 'all 0.15s ease',
                }}
              >
                <Flag size={14} /> Runda {r}
              </button>
            );
          })}
        </div>
      </div>

      {/* LISTA FLIGHTÓW */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
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
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* BELKA NAGŁÓWKA FLIGHTU */}
              <div
                style={{
                  background: '#f8fafc',
                  borderBottom: '2px solid #e2e8f0',
                  padding: '12px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                {/* Górny wiersz nagłówka: Data, Godzina, Runda, Numer Flightu */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>
                      {formattedDate}
                    </span>
                    <span style={{ fontSize: '17px', fontWeight: 900, color: '#0f172a' }}>
                      {teeTimeDisplay}
                    </span>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>
                      Runda: <b>{selectedRound}</b>,
                    </span>
                  </div>

                  <span style={{ fontSize: '11px', fontWeight: 900, background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '5px', border: '1px solid #bae6fd' }}>
                    {flight.name || flightBadgeNum}
                  </span>
                </div>

                {/* Dolny wiersz nagłówka: Pole, Dołek Startowy (Shotgun), Kod Flightu */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <b style={{ fontSize: '14px', color: '#0f172a' }}>
                      {currentCourseName}
                    </b>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: '#0284c7', color: '#ffffff', padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: 900 }}>
                      <MapPin size={11} /> Dołek #{flight.startHole || 1}
                    </span>
                  </div>

                  {/* KOD DO WPISYWANIA WYNIKÓW */}
                  <div
                    title="4-cyfrowy kod do logowania do elektronicznej karty wyników"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: '#fef3c7',
                      color: '#92400e',
                      border: '1px solid #fde68a',
                      padding: '2px 8px',
                      borderRadius: '5px',
                      fontSize: '11px',
                      fontWeight: 800,
                    }}
                  >
                    <KeyRound size={11} />
                    <span>KOD: <strong>{flight.code}</strong></span>
                  </div>
                </div>
              </div>

              {/* LISTA ZAWODNIKÓW WE FLIGHTCIE */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {members.length > 0 ? (
                  members.map((p, idx) => (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPlayerModal({ player: p, rank: idx + 1 })}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 16px',
                        borderBottom: idx !== members.length - 1 ? '1px solid #f1f5f9' : 'none',
                        background: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                        cursor: 'pointer',
                        transition: 'background 0.1s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f9ff')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = idx % 2 === 0 ? '#ffffff' : '#f8fafc')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: '#94a3b8', width: '16px' }}>
                          #
                        </span>

                        {p.avatar ? (
                          <img
                            src={p.avatar}
                            alt={p.name}
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              objectFit: 'cover',
                              border: '1px solid #cbd5e1',
                            }}
                          />
                        ) : (
                          <span
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              background: '#e2e8f0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '12px',
                              fontWeight: 900,
                              color: '#475569',
                            }}
                          >
                            {initials(p.name)}
                          </span>
                        )}

                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <b style={{ fontSize: '14px', color: '#0f172a' }}>{p.name}</b>
                            {p.isAmateur && (
                              <span style={{ fontSize: '9px', fontWeight: 800, background: '#7ea128', color: '#ffffff', padding: '1px 4px', borderRadius: '3px' }}>
                                AM
                              </span>
                            )}
                          </div>
                          <small style={{ fontSize: '11px', color: '#64748b' }}>
                            {p.club || 'Bez klubu'} · {p.category}
                          </small>
                        </div>
                      </div>

                      {/* FLAGA NARODOWA */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {p.flagImage ? (
                          <img
                            src={p.flagImage}
                            alt={p.flag}
                            style={{ width: '24px', height: '16px', objectFit: 'cover', borderRadius: '2px', border: '1px solid #cbd5e1' }}
                          />
                        ) : (
                          <span style={{ fontSize: '18px', lineHeight: 1 }}>{flagEmoji(p.flag || 'PL')}</span>
                        )}
                        <ChevronRight size={15} color="#94a3b8" />
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px', fontWeight: 600 }}>
                    Brak przypisanych graczy do tego flightu.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {roundFlights.length === 0 && (
        <div style={{ background: '#ffffff', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#64748b', border: '1px solid #cbd5e1' }}>
          <Users size={32} color="#94a3b8" style={{ margin: '0 auto 10px auto' }} />
          <b style={{ display: 'block', fontSize: '16px', color: '#0f172a' }}>Brak grup startowych dla Rundy {selectedRound}</b>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>
            Grupy startowe dla tego turnieju nie zostały jeszcze skonfigurowane przez organizatora.
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