// src/components/Archive.tsx
import { useState, useMemo, useEffect, useRef } from 'react';
import { Calendar, MapPin, ArrowLeft, ChevronRight, ChevronDown, Check } from 'lucide-react';
import type { Tournament, Store, Category, Player, Hole, Round } from '@/types';
import { CATEGORIES, flagEmoji } from '@/types';
import { combinedRelative, relativeLabel, totalStrokes } from '@/scoring';
import { compareCountback } from '@/leagueScoring';
import { supabase } from '@/lib/supabase';
import { PlayerModal } from '@/components/PlayerModal';

export const CATEGORY_NAMES_PL: Record<Category | 'Wszystkie', string> = {
  Wszystkie: 'Wszystkie (Absolut)',
  Men: 'Mężczyźni',
  Women: 'Kobiety',
  Senior: 'Seniorzy',
  Junior: 'Juniorzy',
  'Senior+': 'Seniorzy+',
};

const countPlayedHoles = (scores: number[] = []) => scores.filter((s) => s > 0).length;

const getInitials = (name: string) => {
  if (!name) return 'PL';
  return name
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export function Archive({
  tournaments,
  store,
}: {
  tournaments: Tournament[];
  store: Store;
  onOpenPlayer?: (playerId: string) => void;
}) {
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [filter, setFilter] = useState<'all' | 'league' | 'training'>('all');
  const [categoryFilter, setCategoryFilter] = useState<Category | 'Wszystkie'>(() => {
    const saved = localStorage.getItem('pffg_archive_category');
    return (saved as Category | 'Wszystkie') || 'Wszystkie';
  });

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [modalPlayerId, setModalPlayerId] = useState<string | null>(null);
  const [archivedPlayers, setArchivedPlayers] = useState<(Player & { savedRank?: number })[]>([]);
  const [loadingArchive, setLoadingArchive] = useState(false);

  const handleSelectCategory = (cat: Category | 'Wszystkie') => {
    setCategoryFilter(cat);
    localStorage.setItem('pffg_archive_category', cat);
    setDropdownOpen(false);
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

  const completed = useMemo(() => {
    return tournaments.filter((t) => t.status === 'completed' || t.status === 'finished');
  }, [tournaments]);

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

    const r1Course = selectedTournament.round1CourseId;
    const r2Course = selectedTournament.round2CourseId || r1Course;

    const holes1 = (r1Course && store.holesByCourse[r1Course]) ? store.holesByCourse[r1Course] : (store.holesByRound[1] || []);
    const holes2 = (r2Course && store.holesByCourse[r2Course]) ? store.holesByCourse[r2Course] : (store.holesByRound[2] || holes1);

    return { 1: holes1, 2: holes2 };
  }, [selectedTournament, store.holesByCourse, store.holesByRound]);

  useEffect(() => {
    if (!selectedTournament) return;

    let isMounted = true;
    setLoadingArchive(true);

    async function fetchArchivedData() {
      try {
        const tournId = selectedTournament.id;

        // 1. Pobieramy WSZYSTKIE dołki turnieju partiami po 1000 w pętli stronicowania
        let allScores: any[] = [];
        let from = 0;
        const step = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from('scores')
            .select('*')
            .eq('tournament_id', tournId)
            .range(from, from + step - 1);

          if (error) throw error;

          if (data && data.length > 0) {
            allScores = allScores.concat(data);
            if (data.length < step) {
              hasMore = false;
            } else {
              from += step;
            }
          } else {
            hasMore = false;
          }
        }

        // 2. Pobieramy zawodników i punkty
        const [playersRes, leaguePointsRes] = await Promise.all([
          supabase.from('players').select('*').order('name').limit(3000),
          supabase.from('league_points').select('*').eq('tournament_id', tournId),
        ]);

        if (!isMounted) return;

        const scoresData = allScores;
        const playersData = playersRes.data || [];
        const lpData = leaguePointsRes.data || [];

        // 3. Mapowanie graczy
        const playersBase = playersData.map((p: any) => {
          const scores: Record<Round, number[]> = { 1: Array(18).fill(0), 2: Array(18).fill(0) };

          scoresData
            .filter((s: any) => String(s.player_id).toLowerCase() === String(p.id).toLowerCase())
            .forEach((s: any) => {
              const r = Number(s.round ?? s.round_number ?? 1);
              const h = Number(s.hole_number ?? s.hole ?? 0);
              const val = Number(s.strokes ?? s.score ?? 0);
              if ((r === 1 || r === 2) && h >= 1 && h <= 18) {
                scores[r as Round][h - 1] = val;
              }
            });

          const savedLp = lpData.find((lp: any) => String(lp.player_id).toLowerCase() === String(p.id).toLowerCase());

          return {
            id: p.id,
            name: p.name,
            category: p.category,
            avatar: p.avatar ?? undefined,
            club: p.club ?? undefined,
            flag: p.flag ?? 'PL',
            flagImage: p.flag_image ?? undefined,
            isAmateur: !!p.is_amateur,
            isActive: true,
            city: p.city ?? undefined,
            ballModel: p.ball_model ?? undefined,
            birthDate: p.birth_date ?? undefined,
            flightId: { 1: null, 2: null },
            scores,
            savedRank: savedLp ? Number(savedLp.rank) : undefined,
          };
        });

        // 4. Pokazujemy tylko zawodników mających wyniki w tym turnieju
        const participants = playersBase.filter((p) =>
          p.scores[1].some((s) => s > 0) || p.scores[2].some((s) => s > 0)
        );

        setArchivedPlayers(participants);
      } catch (err) {
        console.error('Błąd wczytywania archiwum:', err);
      } finally {
        if (isMounted) setLoadingArchive(false);
      }
    }

    fetchArchivedData();
    return () => { isMounted = false; };
  }, [selectedTournament]);

  const rankedArchivedPlayers = useMemo(() => {
    if (!selectedTournament) return [];

    const sorted = [...archivedPlayers]
      .filter((p) => categoryFilter === 'Wszystkie' || p.category === categoryFilter)
      .sort((a, b) => {
        if (categoryFilter === 'Wszystkie') {
          if (a.savedRank !== undefined && b.savedRank !== undefined) {
            return a.savedRank - b.savedRank;
          }
          if (a.savedRank !== undefined) return -1;
          if (b.savedRank !== undefined) return 1;
        }

        const relA = combinedRelative(a, archivedHoles[1], archivedHoles[2]);
        const relB = combinedRelative(b, archivedHoles[1], archivedHoles[2]);
        if (relA !== relB) return relA - relB;

        return compareCountback(
          { scoresR1: a.scores[1], scoresR2: a.scores[2] },
          { scoresR1: b.scores[1], scoresR2: b.scores[2] }
        );
      });

    return sorted.map((p, idx) => ({
      player: p,
      rank: idx + 1,
      rel: combinedRelative(p, archivedHoles[1], archivedHoles[2]),
    }));
  }, [selectedTournament, archivedPlayers, categoryFilter, archivedHoles]);

  const modalStore = useMemo<Store>(() => ({
    ...store,
    tournamentName: selectedTournament?.name || store.tournamentName,
    holesByRound: archivedHoles,
    players: archivedPlayers,
    round2Started: true,
    round1Approved: true,
  }), [store, selectedTournament, archivedHoles, archivedPlayers]);

  const modalPlayer = modalPlayerId ? archivedPlayers.find((p) => p.id === modalPlayerId) ?? null : null;
  const modalRank = modalPlayer ? (rankedArchivedPlayers.find((r) => r.player.id === modalPlayer.id)?.rank || 1) : 1;

  if (selectedTournament) {
    return (
      <section style={{ background: '#ffffff', borderRadius: '12px', padding: '24px', border: '1px solid #cbd5e1', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.05)' }}>
        {/* NAGŁÓWEK TURNIEJU W ARCHIWUM */}
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
                      onClick={() => handleSelectCategory(cat)}
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

        {/* TABELA WYNIKÓW ARCHIWALNYCH */}
        {loadingArchive ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontWeight: 700 }}>
            Wczytywanie historycznych wyników...
          </div>
        ) : (
          <div style={{ overflowX: 'auto', border: '1px solid #cbd5e1', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1', color: '#475569', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '12px 10px', width: '60px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>POZ</th>
                  <th style={{ padding: '12px 8px', width: '54px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>KRAJ</th>
                  <th style={{ padding: '12px 14px', borderRight: '1px solid #e2e8f0' }}>ZAWODNIK</th>
                  <th style={{ padding: '12px 10px', width: '75px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>WYNIK</th>
                  <th className="desktop-col" style={{ padding: '12px 8px', width: '60px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>DOŁKI</th>
                  <th className="desktop-col" style={{ padding: '12px 8px', width: '60px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>R1</th>
                  <th className="desktop-col" style={{ padding: '12px 8px', width: '60px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>R2</th>
                  <th style={{ padding: '12px 12px', width: '90px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>UDERZENIA</th>
                  <th style={{ padding: '12px 8px', width: '36px', textAlign: 'center' }}></th>
                </tr>
              </thead>
              <tbody>
                {rankedArchivedPlayers.map(({ player: p, rank, rel }, index) => {
                  const thru = countPlayedHoles(p.scores[1]) + countPlayedHoles(p.scores[2]);
                  const strokes = totalStrokes(p.scores[1] || []) + totalStrokes(p.scores[2] || []);
                  const r1Played = countPlayedHoles(p.scores[1]);
                  const r2Played = countPlayedHoles(p.scores[2]);

                  const r1Rel = r1Played > 0
                    ? relativeLabel(p.scores[1].reduce((sum, s, i) => s > 0 ? sum + (s - (archivedHoles[1][i]?.par || 4)) : sum, 0))
                    : '–';
                  const r2Rel = r2Played > 0
                    ? relativeLabel(p.scores[2].reduce((sum, s, i) => s > 0 ? sum + (s - (archivedHoles[2][i]?.par || 4)) : sum, 0))
                    : '–';

                  const isEven = index % 2 === 0;

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
                      {/* POZYCJA */}
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

                      {/* FLAGA */}
                      <td style={{ padding: '10px 8px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                          {p.flagImage ? (
                            <img src={p.flagImage} alt={p.flag} style={{ width: '22px', height: '15px', objectFit: 'cover', borderRadius: '2px', border: '1px solid #cbd5e1', display: 'block' }} />
                          ) : (
                            <span style={{ border: '1px solid #cbd5e1', borderRadius: '2px', padding: '1px 3px', fontSize: '13px', lineHeight: 1, display: 'inline-block' }}>{flagEmoji(p.flag)}</span>
                          )}
                        </div>
                      </td>

                      {/* ZAWODNIK */}
                      <td style={{ padding: '10px 14px', borderRight: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'nowrap' }}>
                          {p.avatar ? (
                            <img
                              src={p.avatar}
                              alt={p.name}
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                objectFit: 'cover',
                                border: '1px solid #cbd5e1',
                                flexShrink: 0,
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

                          {p.isAmateur && (
                            <span style={{ fontSize: '9px', fontWeight: 800, background: '#7ea128', color: '#ffffff', padding: '1px 5px', borderRadius: '3px' }}>
                              AM
                            </span>
                          )}

                          {p.club && (
                            <span style={{ fontSize: '12px', fontWeight: 500, color: '#64748b', whiteSpace: 'nowrap' }}>
                              {p.club}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* WYNIK DO PAR */}
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

                      {/* DOŁKI */}
                      <td className="desktop-col" style={{ padding: '10px 8px', textAlign: 'center', color: '#475569', fontWeight: 700, borderRight: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                          {thru}
                        </div>
                      </td>

                      {/* RUNDA 1 */}
                      <td className="desktop-col" style={{ padding: '10px 8px', textAlign: 'center', color: '#475569', fontWeight: 700, borderRight: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                          {r1Rel}
                        </div>
                      </td>

                      {/* RUNDA 2 */}
                      <td className="desktop-col" style={{ padding: '10px 8px', textAlign: 'center', color: '#475569', fontWeight: 700, borderRight: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                          {r2Rel}
                        </div>
                      </td>

                      {/* UDERZENIA */}
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 900, color: '#0f172a', borderRight: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                          {strokes > 0 ? strokes : '–'}
                        </div>
                      </td>

                      {/* STRZAŁKA */}
                      <td style={{ padding: '10px 6px', textAlign: 'center', color: '#94a3b8' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
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
        )}

        {/* MODAL Z KARTĄ DOŁKÓW */}
        {modalPlayer && (
          <PlayerModal
            player={modalPlayer}
            store={modalStore}
            rank={modalRank}
            initialTab="scorecard"
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

      {/* KAFELKI ZAKOŃCZONYCH TURNIEJÓW */}
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
                {t.isPolishOpen && (
                  <span style={{ fontSize: '10px', fontWeight: 800, background: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: '4px', border: '1px solid #fca5a5' }}>
                    POLISH OPEN
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