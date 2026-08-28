// src/components/LeagueStandings.tsx
import { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronRight, RefreshCw, ChevronDown, Check, User, Shield, ChevronUp, X } from 'lucide-react';
import type { Category, Store, Tournament, Player, Hole } from '@/types';
import { CATEGORIES, flagEmoji } from '@/types';
import { initials, combinedRelative } from '@/scoring';
import { compareCountback, getBasePointsForPosition } from '@/leagueScoring';
import { supabase } from '@/lib/supabase';
import { PlayerModal } from '@/components/PlayerModal';
import { fetchClubs } from '@/actions';

const CATEGORY_NAMES_PL: Record<Category | 'Wszystkie', string> = {
  Wszystkie: 'Wszystkie (Absolut)',
  Men: 'Mężczyźni',
  Women: 'Kobiety',
  Senior: 'Seniorzy',
  Junior: 'Juniorzy',
  'Senior+': 'Seniorzy+',
};

export function LeagueStandings({
  tournaments = [],
  store,
}: {
  store?: Store | null;
  tournaments?: Tournament[];
  leaguePoints?: any[];
  onOpenPlayer?: (playerId: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<'individual' | 'team'>('individual');
  const [categoryFilter, setCategoryFilter] = useState<Category | 'Wszystkie'>(() => {
    const saved = localStorage.getItem('pffg_standings_category');
    return (saved as Category | 'Wszystkie') || 'Wszystkie';
  });

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [dbScores, setDbScores] = useState<any[]>([]);
  const [dbPlayers, setDbPlayers] = useState<any[]>([]);
  const [dbTournaments, setDbTournaments] = useState<Tournament[]>(tournaments);
  const [dbLeaguePoints, setDbLeaguePoints] = useState<any[]>([]);
  const [clubLogos, setClubLogos] = useState<Record<string, string>>({});
  const [expandedClubs, setExpandedClubs] = useState<Record<string, boolean>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedPlayerModal, setSelectedPlayerModal] = useState<{ player: Player; rank: number } | null>(null);
  const [lightboxClub, setLightboxClub] = useState<{ name: string; logoUrl: string } | null>(null);

  const handleSelectCategory = (cat: Category | 'Wszystkie') => {
    setCategoryFilter(cat);
    localStorage.setItem('pffg_standings_category', cat);
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

  const loadFullData = async () => {
    setLoading(true);
    try {
      let allScores: any[] = [];
      let from = 0;
      const step = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('scores')
          .select('*')
          .range(from, from + step - 1);
        if (error || !data || data.length === 0) break;
        allScores = allScores.concat(data);
        if (data.length < step) break;
        from += step;
      }

      const [playersRes, tournamentsRes, leaguePointsRes, clubsMap] = await Promise.all([
        supabase.from('players').select('*').order('name').range(0, 5000),
        supabase.from('tournaments').select('*').order('date', { ascending: true }),
        supabase.from('league_points').select('*').range(0, 10000),
        fetchClubs(),
      ]);

      setDbScores(allScores);
      setDbPlayers(playersRes.data || []);
      setDbLeaguePoints(leaguePointsRes.data || []);
      setClubLogos(clubsMap);

      if (tournamentsRes.data) {
        setDbTournaments(tournamentsRes.data.map((t: any) => ({
          id: t.id,
          name: t.name,
          courseName: t.course_name,
          date: t.date,
          isLeague: t.is_league,
          isPolishOpen: t.is_polish_open,
          status: t.status,
          round1CourseId: t.round1_course_id,
          round2CourseId: t.round2_course_id,
          round1Approved: t.round1_approved,
          round2Started: t.round2_started,
        })));
      }
    } catch (err) {
      console.error('Błąd pobierania danych ligowych:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFullData();
  }, []);

  const leagueTournaments = useMemo(() => {
    return (dbTournaments.length > 0 ? dbTournaments : tournaments)
      .filter((t) => t.isLeague || t.isPolishOpen)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [dbTournaments, tournaments]);

  const teamEligibleTournaments = useMemo(() => {
    return leagueTournaments.filter((t) => !t.isPolishOpen);
  }, [leagueTournaments]);

  const isGeneralView = categoryFilter === 'Wszystkie';

  // --- KLASYFIKACJA INDYWIDUALNA ---
  const standings = useMemo(() => {
    if (dbPlayers.length === 0 || leagueTournaments.length === 0) return [];

    const relevantPlayers = isGeneralView
      ? dbPlayers
      : dbPlayers.filter((p) => p.category === categoryFilter);

    const playerMap: Record<string, {
      player: any;
      scoresByTournament: Record<string, { points: number; rank: number; isPO: boolean }>;
      regularScores: { tournamentId: string; points: number; rank: number }[];
      poScore: { tournamentId: string; points: number; rank: number } | null;
      countedTournamentIds: Set<string>;
      discardedMap: Record<string, number>;
      finalTotalPoints: number;
      totalPointsAllRaw: number;
      tournamentsPlayed: number;
    }> = {};

    relevantPlayers.forEach((p) => {
      playerMap[String(p.id)] = {
        player: p,
        scoresByTournament: {},
        regularScores: [],
        poScore: null,
        countedTournamentIds: new Set<string>(),
        discardedMap: {},
        finalTotalPoints: 0,
        totalPointsAllRaw: 0,
        tournamentsPlayed: 0,
      };
    });

    leagueTournaments.forEach((t) => {
      const isPO = !!t.isPolishOpen;
      const tIdStr = String(t.id);
      const tScores = dbScores.filter((s) => String(s.tournament_id) === tIdStr);

      const r1Course = t.round1CourseId;
      const r2Course = t.round2CourseId || r1Course;

      const holes1: Hole[] = (r1Course && store?.holesByCourse?.[r1Course])
        ? store.holesByCourse[r1Course]
        : (store?.holesByRound?.[1] || []);

      const holes2: Hole[] = (r2Course && store?.holesByCourse?.[r2Course])
        ? store.holesByCourse[r2Course]
        : (store?.holesByRound?.[2] || holes1);

      const allTournamentParticipants: (Player & { savedRank?: number })[] = [];

      dbPlayers.forEach((p) => {
        const scores: Record<1 | 2, number[]> = { 1: Array(18).fill(0), 2: Array(18).fill(0) };
        const pScores = tScores.filter((s) => String(s.player_id) === String(p.id));

        pScores.forEach((s) => {
          const r = Number(s.round ?? s.round_number ?? 1);
          const h = Number(s.hole_number ?? s.hole ?? 1);
          const val = Number(s.strokes ?? s.score ?? 0);
          if ((r === 1 || r === 2) && h >= 1 && h <= 18) {
            scores[r as 1 | 2][h - 1] = val;
          }
        });

        if (scores[1].some((s) => s > 0) || scores[2].some((s) => s > 0)) {
          const savedLp = dbLeaguePoints.find(
            (lp) => String(lp.tournament_id) === tIdStr && String(lp.player_id) === String(p.id)
          );

          allTournamentParticipants.push({
            id: p.id,
            name: p.name,
            category: p.category,
            avatar: p.avatar,
            club: p.club,
            flag: p.flag || 'PL',
            flagImage: p.flag_image || p.flagImage,
            isAmateur: !!p.is_amateur,
            isActive: true,
            flightId: { 1: null, 2: null },
            scores,
            savedRank: savedLp ? Number(savedLp.rank) : undefined,
          });
        }
      });

      const categoryParticipants = isGeneralView
        ? allTournamentParticipants
        : allTournamentParticipants.filter((p) => p.category === categoryFilter);

      categoryParticipants.sort((a, b) => {
        if (isGeneralView) {
          if (a.savedRank !== undefined && b.savedRank !== undefined) {
            return a.savedRank - b.savedRank;
          }
          if (a.savedRank !== undefined) return -1;
          if (b.savedRank !== undefined) return 1;
        }

        const relA = combinedRelative(a, holes1, holes2);
        const relB = combinedRelative(b, holes1, holes2);
        if (relA !== relB) return relA - relB;

        return compareCountback(
          { scoresR1: a.scores[1], scoresR2: a.scores[2] },
          { scoresR1: b.scores[1], scoresR2: b.scores[2] }
        );
      });

      categoryParticipants.forEach((part, idx) => {
        const categoryRank = idx + 1;
        const pts = getBasePointsForPosition(categoryRank);
        const pData = playerMap[String(part.id)];

        if (pData) {
          pData.scoresByTournament[tIdStr] = {
            points: pts,
            rank: categoryRank,
            isPO,
          };

          if (isPO) {
            pData.poScore = { tournamentId: tIdStr, points: pts, rank: categoryRank };
          } else {
            pData.regularScores.push({ tournamentId: tIdStr, points: pts, rank: categoryRank });
          }

          pData.totalPointsAllRaw += pts;
          pData.tournamentsPlayed += 1;
        }
      });
    });

    Object.values(playerMap).forEach((pData) => {
      if (isGeneralView) {
        const sortedRegular = [...pData.regularScores].sort((a, b) => b.points - a.points);
        const top6Regular = sortedRegular.slice(0, 6);
        const discarded = sortedRegular.slice(6);

        top6Regular.forEach((s) => pData.countedTournamentIds.add(s.tournamentId));
        discarded.forEach((s) => {
          pData.discardedMap[s.tournamentId] = s.points;
        });

        if (pData.poScore) {
          pData.countedTournamentIds.add(pData.poScore.tournamentId);
        }

        const top6Sum = top6Regular.reduce((sum, item) => sum + item.points, 0);
        const poSum = pData.poScore ? pData.poScore.points : 0;
        pData.finalTotalPoints = Math.round((top6Sum + poSum) * 10) / 10;
      } else {
        pData.regularScores.forEach((s) => pData.countedTournamentIds.add(s.tournamentId));
        if (pData.poScore) {
          pData.countedTournamentIds.add(pData.poScore.tournamentId);
        }
        pData.finalTotalPoints = Math.round(pData.totalPointsAllRaw * 10) / 10;
      }
    });

    const activeStandings = Object.values(playerMap)
      .filter((item) => item.tournamentsPlayed > 0)
      .sort((a, b) => {
        if (b.finalTotalPoints !== a.finalTotalPoints) return b.finalTotalPoints - a.finalTotalPoints;
        return b.totalPointsAllRaw - a.totalPointsAllRaw;
      });

    return activeStandings.map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));
  }, [dbPlayers, dbScores, dbLeaguePoints, leagueTournaments, categoryFilter, isGeneralView, store]);

  // --- KLASYFIKACJA DRUŻYNOWA PFFG ---
  const teamStandings = useMemo(() => {
    if (dbPlayers.length === 0 || teamEligibleTournaments.length === 0) return [];

    const clubsSet = new Set<string>();
    dbPlayers.forEach((p) => {
      if (p.club && p.club.trim()) clubsSet.add(p.club.trim());
    });

    const clubScoresMap: Record<string, {
      clubName: string;
      logoUrl?: string;
      tournamentPoints: Record<string, {
        totalPoints: number;
        groupedMembers: Record<string, {
          categoryLabel: string;
          countingPlayer: { playerName: string; points: number; rank: number } | null;
          reserves: { playerName: string; points: number; rank: number }[];
        }>;
      }>;
      finalTotalPoints: number;
    }> = {};

    clubsSet.forEach((clubName) => {
      clubScoresMap[clubName] = {
        clubName,
        logoUrl: clubLogos[clubName] || localStorage.getItem(`pffg_club_logo_${clubName}`) || undefined,
        tournamentPoints: {},
        finalTotalPoints: 0,
      };
    });

    const ageGroups: { label: string; matches: (cat: string) => boolean }[] = [
      { label: 'MEN', matches: (c) => c === 'Men' },
      { label: 'SENIOR', matches: (c) => c === 'Senior' || c === 'Senior+' },
      { label: 'WOMEN', matches: (c) => c === 'Women' },
      { label: 'JUNIOR', matches: (c) => c === 'Junior' },
    ];

    teamEligibleTournaments.forEach((t) => {
      const tIdStr = String(t.id);
      const tScores = dbScores.filter((s) => String(s.tournament_id) === tIdStr);

      const tournamentPlayersWithPts: {
        player: any;
        points: number;
        rank: number;
        category: string;
        club: string;
      }[] = [];

      CATEGORIES.forEach((cat) => {
        const catParticipants = dbPlayers.filter((p) => {
          if (p.category !== cat) return false;
          const pScores = tScores.filter((s) => String(s.player_id) === String(p.id));
          return pScores.some((s) => Number(s.strokes ?? s.score ?? 0) > 0);
        });

        catParticipants.sort((a, b) => {
          const sumA = tScores.filter((s) => String(s.player_id) === String(a.id)).reduce((acc, s) => acc + Number(s.strokes ?? s.score ?? 0), 0);
          const sumB = tScores.filter((s) => String(s.player_id) === String(b.id)).reduce((acc, s) => acc + Number(s.strokes ?? s.score ?? 0), 0);
          return sumA - sumB;
        });

        catParticipants.forEach((p, idx) => {
          const rank = idx + 1;
          const pts = getBasePointsForPosition(rank);
          if (p.club && p.club.trim()) {
            tournamentPlayersWithPts.push({
              player: p,
              points: pts,
              rank,
              category: cat,
              club: p.club.trim(),
            });
          }
        });
      });

      clubsSet.forEach((clubName) => {
        const clubPlayersInTourney = tournamentPlayersWithPts.filter((item) => item.club === clubName);
        const groupedMembers: Record<string, { categoryLabel: string; countingPlayer: any; reserves: any[] }> = {};
        let tourneyClubPoints = 0;

        ageGroups.forEach((group) => {
          const groupCandidates = clubPlayersInTourney
            .filter((cp) => group.matches(cp.category))
            .sort((a, b) => b.points - a.points);

          if (groupCandidates.length > 0) {
            const best = groupCandidates[0];
            const others = groupCandidates.slice(1).map((c) => ({
              playerName: c.player.name,
              points: c.points,
              rank: c.rank,
            }));

            groupedMembers[group.label] = {
              categoryLabel: group.label,
              countingPlayer: {
                playerName: best.player.name,
                points: best.points,
                rank: best.rank,
              },
              reserves: others,
            };
            tourneyClubPoints += best.points;
          }
        });

        clubScoresMap[clubName].tournamentPoints[tIdStr] = {
          totalPoints: tourneyClubPoints,
          groupedMembers,
        };
        clubScoresMap[clubName].finalTotalPoints += tourneyClubPoints;
      });
    });

    return Object.values(clubScoresMap)
      .filter((c) => c.finalTotalPoints > 0)
      .sort((a, b) => b.finalTotalPoints - a.finalTotalPoints)
      .map((c, idx) => ({ ...c, rank: idx + 1 }));
  }, [dbPlayers, dbScores, teamEligibleTournaments, clubLogos]);

  const toggleClubExpanded = (clubName: string) => {
    setExpandedClubs((prev) => ({ ...prev, [clubName]: !prev[clubName] }));
  };

  const toggleGroupExpanded = (key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const fullAggregatedLeaguePoints = useMemo(() => {
    const list: any[] = [];
    standings.forEach((item) => {
      Object.entries(item.scoresByTournament).forEach(([tId, scoreObj]) => {
        list.push({
          player_id: item.player.id,
          tournament_id: tId,
          rank: scoreObj.rank,
          points: scoreObj.points,
        });
      });
    });
    return list;
  }, [standings]);

  return (
    <section style={{ background: '#ffffff', borderRadius: '12px', padding: '24px', border: '1px solid #cbd5e1', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.05)' }}>
      {/* NAGŁÓWEK */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', borderBottom: '2px solid #0f172a', paddingBottom: '16px', marginBottom: '18px' }}>
        <div>
          <p style={{ margin: 0, fontSize: '11px', fontWeight: 800, color: '#1b88cc', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Oficjalna Klasyfikacja Ligi PFFG
          </p>
          <h1 style={{ margin: '4px 0 0 0', fontSize: '26px', fontWeight: 900, color: '#0f172a' }}>
            Ranking Ligi FootGolfa 2026
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
            {activeTab === 'individual' ? (
              isGeneralView ? (
                <span>
                  Klasyfikacja Generalna: <strong>TOP 6 najlepszych rund ligowych</strong> + <strong>Polish Open</strong> (zawsze wliczane na stałe).
                </span>
              ) : (
                <span>
                  Kategoria {CATEGORY_NAMES_PL[categoryFilter]}: suma punktów ze <strong>wszystkich rozegranych rund</strong> w sezonie.
                </span>
              )
            ) : (
              <span>
                Klasyfikacja Drużynowa: <strong>1 najlepszy wynik z każdej kategorii wiekowej</strong> (MEN, SENIOR, WOMEN, JUNIOR) w każdej rundzie. Suma ze wszystkich 8 rund ligowych (bez MP).
              </span>
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={async () => {
            setIsRefreshing(true);
            await loadFullData();
            setTimeout(() => setIsRefreshing(false), 400);
          }}
          title="Odśwież ranking z bazy"
          style={{
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            padding: '8px 14px',
            fontSize: '12px',
            fontWeight: 800,
            color: '#475569',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}
        >
          <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
          Odśwież ranking
        </button>
      </div>

      {/* PRZEŁĄCZNIK: INDYWIDUALNA / DRUŻYNOWA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
          <button
            type="button"
            onClick={() => setActiveTab('individual')}
            style={{
              padding: '6px 16px',
              borderRadius: '7px',
              border: 'none',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: activeTab === 'individual' ? '#0f172a' : 'transparent',
              color: activeTab === 'individual' ? '#ffffff' : '#475569',
              transition: 'all 0.15s ease',
            }}
          >
            <User size={15} /> Indywidualna
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('team')}
            style={{
              padding: '6px 16px',
              borderRadius: '7px',
              border: 'none',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: activeTab === 'team' ? '#0f172a' : 'transparent',
              color: activeTab === 'team' ? '#ffffff' : '#475569',
              transition: 'all 0.15s ease',
            }}
          >
            <Shield size={15} /> Drużynowa (Klubowa)
          </button>
        </div>

        {/* DROPDOWN KATEGORII */}
        {activeTab === 'individual' && (
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
                    right: 0,
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
        )}

        {activeTab === 'team' && (
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>
            Klubów w lidze: <b>{teamStandings.length}</b>
          </span>
        )}
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontWeight: 700 }}>
          Wczytywanie i synchronizacja oficjalnych punktów...
        </div>
      ) : activeTab === 'individual' ? (
        /* TABELA INDYWIDUALNA */
        <div style={{ overflowX: 'auto', border: '1px solid #cbd5e1', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1', color: '#475569', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <th style={{ padding: '12px 10px', width: '60px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>POZ</th>
                <th style={{ padding: '12px 8px', width: '54px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>KRAJ</th>
                <th style={{ padding: '12px 14px', minWidth: '220px', borderRight: '1px solid #e2e8f0' }}>ZAWODNIK</th>
                <th style={{ padding: '12px 14px', textAlign: 'center', background: '#0284c7', color: '#ffffff', borderRight: '1px solid #0284c7', minWidth: '110px' }}>
                  {isGeneralView ? 'PUNKTY (TOP6+PO)' : 'SUMA PUNKTÓW'}
                </th>

                {/* TURNIEJE */}
                {leagueTournaments.map((t, idx) => {
                  const isPO = !!t.isPolishOpen;
                  const tIdStr = String(t.id);
                  return (
                    <th
                      key={tIdStr}
                      style={{
                        padding: '12px 8px',
                        textAlign: 'center',
                        fontSize: '11px',
                        background: isPO ? '#881337' : '#f8fafc',
                        color: isPO ? '#ffe4e6' : '#475569',
                        borderRight: '1px solid #e2e8f0',
                        whiteSpace: 'nowrap',
                      }}
                      title={t.name}
                    >
                      {isPO ? '🏆 POLISH OPEN' : `T${idx + 1}`}
                    </th>
                  );
                })}

                <th style={{ padding: '12px 8px', width: '36px', textAlign: 'center' }}></th>
              </tr>
            </thead>
            <tbody>
              {standings.map((item, index) => {
                const p = item.player;
                const isEven = index % 2 === 0;

                return (
                  <tr
                    key={p.id}
                    onClick={() => {
                      const fullPlayerObj: Player = {
                        id: p.id,
                        name: p.name,
                        category: p.category,
                        avatar: p.avatar,
                        club: p.club,
                        flag: p.flag || 'PL',
                        flagImage: p.flag_image || p.flagImage,
                        isAmateur: !!p.is_amateur,
                        isActive: true,
                        city: p.city,
                        ballModel: p.ball_model || p.ballModel,
                        birthDate: p.birth_date || p.birthDate,
                        flightId: { 1: null, 2: null },
                        scores: { 1: Array(18).fill(0), 2: Array(18).fill(0) },
                      };
                      setSelectedPlayerModal({ player: fullPlayerObj, rank: item.rank });
                    }}
                    style={{
                      background: isEven ? '#ffffff' : '#f8fafc',
                      borderBottom: '1px solid #e2e8f0',
                      cursor: 'pointer',
                      transition: 'background 0.1s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = isEven ? '#ffffff' : '#f8fafc')}
                  >
                    {/* POZYCJA Z PODŚWIETLENIEM 1, 2, 3 */}
                    <td style={{ padding: '10px 8px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                        {item.rank === 1 ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '6px', background: '#fef08a', color: '#854d0e', fontWeight: 900, fontSize: '13px', border: '1px solid #fde047' }}>
                            1
                          </span>
                        ) : item.rank === 2 ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '6px', background: '#f1f5f9', color: '#334155', fontWeight: 900, fontSize: '13px', border: '1px solid #cbd5e1' }}>
                            2
                          </span>
                        ) : item.rank === 3 ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '6px', background: '#ffedd5', color: '#9a3412', fontWeight: 900, fontSize: '13px', border: '1px solid #fed7aa' }}>
                            3
                          </span>
                        ) : (
                          <span style={{ fontWeight: 800, fontSize: '13px', color: '#475569' }}>
                            {item.rank}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* FLAGA NARODOWA */}
                    <td style={{ padding: '10px 8px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                        {p.flag_image || p.flagImage ? (
                          <img
                            src={p.flag_image || p.flagImage}
                            alt={p.flag}
                            style={{
                              width: '22px',
                              height: '15px',
                              objectFit: 'cover',
                              borderRadius: '2px',
                              border: '1px solid #cbd5e1',
                              display: 'block',
                            }}
                          />
                        ) : (
                          <span style={{ border: '1px solid #cbd5e1', borderRadius: '2px', padding: '1px 3px', fontSize: '14px', lineHeight: 1, display: 'inline-block' }}>
                            {flagEmoji(p.flag || 'PL')}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* ZAWODNIK + AVATAR + KLUB */}
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
                            {initials(p.name)}
                          </span>
                        )}

                        <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '14px', whiteSpace: 'nowrap' }}>
                          {p.name}
                        </span>

                        {p.is_amateur && (
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

                    {/* PUNKTY CAŁKOWITE (LICZBA CAŁKOWITA LUB NATURALNY FORMAT) */}
                    <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 900, fontSize: '15px', color: '#0284c7', background: '#f0f9ff', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                      {Number.isInteger(item.finalTotalPoints) ? item.finalTotalPoints : item.finalTotalPoints.toFixed(1)}
                    </td>

                    {/* PUNKTY W TURNIEJACH */}
                    {leagueTournaments.map((t) => {
                      const tIdStr = String(t.id);
                      const score = item.scoresByTournament[tIdStr];
                      const isPO = !!t.isPolishOpen;
                      const isDiscarded = !!item.discardedMap[tIdStr];

                      return (
                        <td
                          key={tIdStr}
                          style={{
                            padding: '10px 8px',
                            textAlign: 'center',
                            fontSize: '12px',
                            background: isPO ? '#fff1f2' : undefined,
                            borderRight: '1px solid #e2e8f0',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                            {score ? (
                              <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                                {isDiscarded ? (
                                  <span style={{ fontWeight: 800, color: '#94a3b8', textDecoration: 'line-through' }} title="Runda odrzucona (poza TOP 6)">
                                    0 ({score.points})
                                  </span>
                                ) : (
                                  <span style={{ fontWeight: 800, color: isPO ? '#be123c' : '#0f172a' }}>
                                    {score.points}
                                  </span>
                                )}
                                <span style={{ fontSize: '10px', color: '#94a3b8' }}>m.{score.rank}</span>
                              </div>
                            ) : (
                              <span style={{ color: '#cbd5e1', fontWeight: 700 }}>–</span>
                            )}
                          </div>
                        </td>
                      );
                    })}

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

          {standings.length === 0 && (
            <div style={{ padding: '36px', textAlign: 'center', color: '#94a3b8', fontWeight: 700 }}>
              Brak sklasyfikowanych zawodników w wybranej kategorii.
            </div>
          )}
        </div>
      ) : (
        /* TABELA DRUŻYNOWA */
        <div style={{ overflowX: 'auto', border: '1px solid #cbd5e1', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1', color: '#475569', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <th style={{ padding: '12px 10px', width: '60px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>POZ</th>
                <th style={{ padding: '12px 10px', width: '64px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>HERB</th>
                <th style={{ padding: '12px 14px', minWidth: '220px', borderRight: '1px solid #e2e8f0' }}>KLUB FOOTGOLFA</th>
                <th style={{ padding: '12px 14px', textAlign: 'center', background: '#0f172a', color: '#ffffff', borderRight: '1px solid #0f172a', minWidth: '120px' }}>
                  SUMA PUNKTÓW
                </th>

                {teamEligibleTournaments.map((t, idx) => (
                  <th
                    key={t.id}
                    style={{
                      padding: '12px 8px',
                      textAlign: 'center',
                      fontSize: '11px',
                      background: '#f8fafc',
                      color: '#475569',
                      borderRight: '1px solid #e2e8f0',
                      whiteSpace: 'nowrap',
                    }}
                    title={t.name}
                  >
                    R{idx + 1}
                  </th>
                ))}

                <th style={{ padding: '12px 8px', width: '40px', textAlign: 'center' }}></th>
              </tr>
            </thead>
            <tbody>
              {teamStandings.map((club, index) => {
                const isEven = index % 2 === 0;
                const isExpanded = !!expandedClubs[club.clubName];

                return (
                  <>
                    <tr
                      key={club.clubName}
                      onClick={() => toggleClubExpanded(club.clubName)}
                      style={{
                        background: isEven ? '#ffffff' : '#f8fafc',
                        borderBottom: isExpanded ? 'none' : '1px solid #e2e8f0',
                        cursor: 'pointer',
                        transition: 'background 0.1s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = isEven ? '#ffffff' : '#f8fafc')}
                    >
                      {/* POZYCJA PODIUM */}
                      <td style={{ padding: '10px 8px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                          {club.rank === 1 ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '6px', background: '#fef08a', color: '#854d0e', fontWeight: 900, fontSize: '13px', border: '1px solid #fde047' }}>
                              1
                            </span>
                          ) : club.rank === 2 ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '6px', background: '#f1f5f9', color: '#334155', fontWeight: 900, fontSize: '13px', border: '1px solid #cbd5e1' }}>
                              2
                            </span>
                          ) : club.rank === 3 ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '6px', background: '#ffedd5', color: '#9a3412', fontWeight: 900, fontSize: '13px', border: '1px solid #fed7aa' }}>
                              3
                            </span>
                          ) : (
                            <span style={{ fontWeight: 800, fontSize: '13px', color: '#475569' }}>
                              {club.rank}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* LOGO KLUBU (POWIĘKSZENIE W LIGHTBOXIE) */}
                      <td style={{ padding: '10px 8px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                          {club.logoUrl ? (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                setLightboxClub({ name: club.clubName, logoUrl: club.logoUrl! });
                              }}
                              title="Kliknij, aby powiększyć herb"
                              style={{ position: 'relative', cursor: 'zoom-in' }}
                            >
                              <img
                                src={club.logoUrl}
                                alt={club.clubName}
                                style={{
                                  width: '36px',
                                  height: '36px',
                                  borderRadius: '6px',
                                  objectFit: 'contain',
                                  background: '#f8fafc',
                                  border: '1px solid #e2e8f0',
                                  padding: '2px',
                                }}
                              />
                            </div>
                          ) : (
                            <span
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '6px',
                                background: '#f1f5f9',
                                border: '1px solid #cbd5e1',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '11px',
                                fontWeight: 900,
                                color: '#475569',
                              }}
                            >
                              {club.clubName.slice(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* NAZWA KLUBU */}
                      <td style={{ padding: '10px 14px', borderRight: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 900, color: '#0f172a', fontSize: '14px', whiteSpace: 'nowrap' }}>
                            {club.clubName}
                          </span>
                        </div>
                      </td>

                      {/* SUMA PUNKTÓW DRUŻYNY */}
                      <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 900, fontSize: '15px', color: '#0284c7', background: '#f0f9ff', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                        {club.finalTotalPoints.toFixed(0)}
                      </td>

                      {/* PUNKTY W RUNDACH */}
                      {teamEligibleTournaments.map((t) => {
                        const tIdStr = String(t.id);
                        const tourneyData = club.tournamentPoints[tIdStr];
                        const pts = tourneyData?.totalPoints || 0;

                        return (
                          <td
                            key={tIdStr}
                            style={{
                              padding: '10px 8px',
                              textAlign: 'center',
                              fontSize: '13px',
                              fontWeight: pts > 0 ? 800 : 500,
                              color: pts > 0 ? '#0f172a' : '#cbd5e1',
                              borderRight: '1px solid #e2e8f0',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {pts > 0 ? pts : '–'}
                          </td>
                        );
                      })}

                      {/* ROZWIJANIE */}
                      <td style={{ padding: '10px 6px', textAlign: 'center', color: '#64748b' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </td>
                    </tr>

                    {/* SZCZEGÓŁOWY PANEL Z ZIELONYMI PUNKTUJĄCYMI I ROZWIJALNĄ REZERWĄ */}
                    {isExpanded && (
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                        <td colSpan={teamEligibleTournaments.length + 5} style={{ padding: '16px 20px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                              <p style={{ margin: 0, fontSize: '12px', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Punkty i skład klubu {club.clubName} w poszczególnych rundach:
                              </p>
                              <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 800, background: '#dcfce7', padding: '2px 8px', borderRadius: '4px', border: '1px solid #86efac' }}>
                                ★ Gracze na zielonym tle punktują do sumy drużyny (kliknij gracza, by rozwinąć rezerwę)
                              </span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '14px' }}>
                              {teamEligibleTournaments.map((t, idx) => {
                                const tIdStr = String(t.id);
                                const tourneyData = club.tournamentPoints[tIdStr];
                                if (!tourneyData || Object.keys(tourneyData.groupedMembers).length === 0) return null;

                                return (
                                  <div
                                    key={tIdStr}
                                    style={{
                                      background: '#ffffff',
                                      border: '1px solid #cbd5e1',
                                      borderRadius: '8px',
                                      overflow: 'hidden',
                                      boxShadow: '0 2px 5px rgba(0,0,0,0.03)',
                                    }}
                                  >
                                    {/* NAGŁÓWEK KARTY RUNDY */}
                                    <div style={{ background: '#0b1329', padding: '9px 12px', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                                      <span style={{ fontSize: '12px', fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        R{idx + 1}: {t.name}
                                      </span>
                                      <span style={{ fontSize: '12px', fontWeight: 900, color: '#38bdf8', whiteSpace: 'nowrap' }}>
                                        {tourneyData.totalPoints} pkt
                                      </span>
                                    </div>

                                    {/* LISTA GRUP WIEKOWYCH */}
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                      {Object.values(tourneyData.groupedMembers).map((group) => {
                                        if (!group.countingPlayer) return null;
                                        const groupKey = `${club.clubName}_${tIdStr}_${group.categoryLabel}`;
                                        const isGroupOpen = !!expandedGroups[groupKey];

                                        return (
                                          <div key={group.categoryLabel} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                            {/* ZAWODNIK PUNKTUJĄCY NA ZIELONO */}
                                            <div
                                              onClick={() => group.reserves.length > 0 && toggleGroupExpanded(groupKey)}
                                              style={{
                                                padding: '8px 10px',
                                                background: '#f0fdf4',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                cursor: group.reserves.length > 0 ? 'pointer' : 'default',
                                              }}
                                            >
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                                                <span style={{ fontWeight: 900, fontSize: '11px', color: '#15803d', background: '#dcfce7', padding: '1px 5px', borderRadius: '3px', border: '1px solid #86efac' }}>
                                                  {group.categoryLabel}
                                                </span>
                                                <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                                  {group.countingPlayer.playerName}
                                                </span>
                                                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>
                                                  (m.{group.countingPlayer.rank})
                                                </span>
                                              </div>

                                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                                                <span style={{ background: '#16a34a', color: '#ffffff', padding: '2px 7px', borderRadius: '4px', fontWeight: 900, fontSize: '11px' }}>
                                                  +{group.countingPlayer.points} pkt
                                                </span>
                                                {group.reserves.length > 0 && (
                                                  <span style={{ color: '#16a34a', display: 'flex', alignItems: 'center' }}>
                                                    {isGroupOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                  </span>
                                                )}
                                              </div>
                                            </div>

                                            {/* ROZWIJANA REZERWA W TEJ KATEGORII */}
                                            {isGroupOpen && group.reserves.length > 0 && (
                                              <div style={{ background: '#ffffff', padding: '4px 10px 6px 20px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                <small style={{ color: '#94a3b8', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase' }}>
                                                  Pozostali zawodnicy (rezerwa w {group.categoryLabel}):
                                                </small>
                                                {group.reserves.map((res, rIdx) => (
                                                  <div key={rIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#64748b' }}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                      <span style={{ color: '#cbd5e1', fontSize: '10px' }}>↳</span>
                                                      {res.playerName} (m.{res.rank})
                                                    </span>
                                                    <span style={{ color: '#94a3b8', textDecoration: 'line-through', fontWeight: 600 }}>
                                                      ({res.points} pkt)
                                                    </span>
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>

          {teamStandings.length === 0 && (
            <div style={{ padding: '36px', textAlign: 'center', color: '#94a3b8', fontWeight: 700 }}>
              Brak sklasyfikowanych klubów z przypisanymi zawodnikami.
            </div>
          )}
        </div>
      )}

      {/* MODAL PROFILU */}
      {selectedPlayerModal && (
        <PlayerModal
          player={selectedPlayerModal.player}
          rank={selectedPlayerModal.rank}
          store={store || {
            tournamentName: 'Liga Footgolfa',
            courses: [],
            round1CourseId: null,
            round2CourseId: null,
            holesByRound: { 1: [], 2: [] },
            holesByCourse: {},
            players: [],
            flights: [],
            round1Approved: true,
            round2Started: true,
          }}
          tournaments={leagueTournaments}
          leaguePoints={fullAggregatedLeaguePoints}
          hideScorecardTab={true}
          initialTab="tournaments"
          onClose={() => setSelectedPlayerModal(null)}
        />
      )}

      {/* LIGHTBOX POWIĘKSZENIA HERBU KLUBU */}
      {lightboxClub && (
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
          onClick={() => setLightboxClub(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              background: '#ffffff',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '90vw',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            }}
          >
            <button
              onClick={() => setLightboxClub(null)}
              style={{
                position: 'absolute',
                top: '-14px',
                right: '-14px',
                background: '#ef4444',
                color: '#ffffff',
                border: 'none',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
              }}
            >
              <X size={20} />
            </button>
            <img
              src={lightboxClub.logoUrl}
              alt={lightboxClub.name}
              style={{
                maxWidth: '320px',
                maxHeight: '320px',
                objectFit: 'contain',
                marginBottom: '14px',
              }}
            />
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: '#0f172a', textAlign: 'center' }}>
              {lightboxClub.name}
            </h3>
          </div>
        </div>
      )}
    </section>
  );
}