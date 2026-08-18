// src/components/LeagueStandings.tsx
import { useMemo, useState } from 'react';
import { Trophy, Shield, Users, Medal, Award } from 'lucide-react';
import type { Category, Player } from '@/types';
import { CATEGORIES, flagEmoji } from '@/types';
import { computeSeasonStanding, MIN_ROUNDS_REQUIRED } from '@/leagueScoring';

export interface LeagueStandingRecord {
  player: Player;
  totalPoints: number;
  roundsCount: number;
  isQualified: boolean;
  history: { tournamentName: string; points: number; isPolishOpen: boolean }[];
}

export function LeagueStandings({
  players,
  leaguePoints,
  tournaments,
}: {
  players: Player[];
  leaguePoints: any[];
  tournaments: any[];
}) {
  const [tab, setTab] = useState<'individual' | 'clubs'>('individual');
  const [categoryFilter, setCategoryFilter] = useState<Category | 'Generalna'>('Generalna');

  // Mapa turniejów dla szybkiego odczytu
  const tournamentMap = useMemo(() => {
    const m = new Map<string, any>();
    tournaments.forEach((t) => m.set(t.id, t));
    return m;
  }, [tournaments]);

  // Obliczanie wyników indywidualnych
  const standings = useMemo(() => {
    const playerScoresMap = new Map<string, { tournamentName: string; points: number; isPolishOpen: boolean }[]>();

    leaguePoints.forEach((lp) => {
      const t = tournamentMap.get(lp.tournament_id);
      if (!t || t.status !== 'completed') return;

      const list = playerScoresMap.get(lp.player_id) || [];
      list.push({
        tournamentName: t.name,
        points: Number(lp.points),
        isPolishOpen: Boolean(t.is_polish_open),
      });
      playerScoresMap.set(lp.player_id, list);
    });

    const records: LeagueStandingRecord[] = [];

    players.forEach((p) => {
      const history = playerScoresMap.get(p.id) || [];
      if (history.length === 0) return;

      const { totalPoints, roundsCount } = computeSeasonStanding(history);
      const minRequired = MIN_ROUNDS_REQUIRED[p.category] ?? 3;

      records.push({
        player: p,
        totalPoints,
        roundsCount,
        isQualified: roundsCount >= minRequired,
        history,
      });
    });

    // Filtrowanie po kategorii
    const filtered = categoryFilter === 'Generalna'
      ? records
      : records.filter((r) => r.player.category === categoryFilter);

    // Sortowanie malejąco po punktach
    return filtered.sort((a, b) => b.totalPoints - a.totalPoints);
  }, [players, leaguePoints, tournamentMap, categoryFilter]);

  // Obliczanie klasyfikacji drużynowej (zgodnie z regulaminem: 1 najlepszy z Men, Senior, Women, Junior)
  const clubStandings = useMemo(() => {
    const clubsMap = new Map<string, number>();

    // Dla każdego zakończonego turnieju ligowego (bez Polish Open)
    const leagueTournaments = tournaments.filter((t) => t.status === 'completed' && t.is_league && !t.is_polish_open);

    leagueTournaments.forEach((t) => {
      const tPoints = leaguePoints.filter((lp) => lp.tournament_id === t.id);

      // Grupowanie po klubach w ramach jednego turnieju
      const clubCategoryMax = new Map<string, Map<Category, number>>();

      tPoints.forEach((lp) => {
        const player = players.find((p) => p.id === lp.player_id);
        if (!player || !player.club) return;

        const club = player.club.trim();
        if (!clubCategoryMax.has(club)) {
          clubCategoryMax.set(club, new Map());
        }

        const catMap = clubCategoryMax.get(club)!;
        const currentMax = catMap.get(player.category) || 0;
        if (Number(lp.points) > currentMax) {
          catMap.set(player.category, Number(lp.points));
        }
      });

      // Suma z kategorii dla tego turnieju dodawana do klubu
      clubCategoryMax.forEach((catMap, club) => {
        let tournamentClubTotal = 0;
        catMap.forEach((pts) => {
          tournamentClubTotal += pts;
        });
        const currentClubScore = clubsMap.get(club) || 0;
        clubsMap.set(club, Number((currentClubScore + tournamentClubTotal).toFixed(2)));
      });
    });

    return Array.from(clubsMap.entries())
      .map(([club, points]) => ({ club, points }))
      .sort((a, b) => b.points - a.points);
  }, [tournaments, leaguePoints, players]);

  return (
    <section className="leaderboard-section-wrap">
      <div className="section-intro">
        <div>
          <p className="eyebrow">
            <span className="eyebrow-line" /> POLSKA FEDERACJA FOOTGOLFA
          </p>
          <h1 className="tournament-title">Ranking Sezonowy Ligi 2026</h1>
          <p className="intro-copy">
            Oficjalna klasyfikacja generalna liczona z TOP 6 rund ligowych oraz Polish Open (reguła 92%).
          </p>
        </div>

        {/* Przełącznik: Indywidualna / Klubowa */}
        <div className="flex gap-2">
          <button
            className={`secondary-button ${tab === 'individual' ? 'numpad-active' : ''}`}
            onClick={() => setTab('individual')}
          >
            <Users size={16} /> Indywidualna
          </button>
          <button
            className={`secondary-button ${tab === 'clubs' ? 'numpad-active' : ''}`}
            onClick={() => setTab('clubs')}
          >
            <Shield size={16} /> Klubowa
          </button>
        </div>
      </div>

      {tab === 'individual' && (
        <>
          <div className="filter-bar">
            <span className="filter-label">KATEGORIA</span>
            <button
              className={`filter-chip ${categoryFilter === 'Generalna' ? 'active' : ''}`}
              onClick={() => setCategoryFilter('Generalna')}
            >
              Generalna
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                className={`filter-chip ${categoryFilter === c ? 'active' : ''}`}
                onClick={() => setCategoryFilter(c)}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="leaderboard-card">
            <div className="table-head" style={{ gridTemplateColumns: '80px 1fr 100px 100px 120px' }}>
              <span className="col-center">POZ</span>
              <span>ZAWODNIK</span>
              <span className="col-center">RUNDY</span>
              <span className="col-center">STATUS</span>
              <span className="col-center">PUNKTY</span>
            </div>

            {standings.map((rec, index) => (
              <div
                key={rec.player.id}
                className={`leader-row ${index === 0 ? 'leader-first-place' : ''}`}
                style={{ gridTemplateColumns: '80px 1fr 100px 100px 120px' }}
              >
                <span className="rank-cell col-center">
                  <span className={`rank ${index < 3 ? 'gold' : ''}`}>#{index + 1}</span>
                </span>

                <span className="player-cell">
                  <div className="player-info-container">
                    <div className="player-identity">
                      {rec.player.flagImage ? (
                        <img src={rec.player.flagImage} alt="" className="flag-img-inline" />
                      ) : (
                        <span className="flag-emoji">{flagEmoji(rec.player.flag)}</span>
                      )}
                      <span className="player-name-fixed">{rec.player.name}</span>
                    </div>
                    {rec.player.club && <span className="player-club-slot">{rec.player.club}</span>}
                  </div>
                </span>

                <span className="col-center font-bold text-slate-600">
                  {rec.roundsCount}
                </span>

                <span className="col-center">
                  {rec.isQualified ? (
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Sklasyfikowany
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200" title={`Wymagane min. ${MIN_ROUNDS_REQUIRED[rec.player.category]} rundy`}>
                      W trakcie
                    </span>
                  )}
                </span>

                <span className="col-center font-extrabold text-base text-slate-900">
                  {rec.totalPoints.toFixed(1)} pkt
                </span>
              </div>
            ))}

            {standings.length === 0 && (
              <div className="empty-state">Brak rozegranych turniejów ligowych w tym sezonie.</div>
            )}
          </div>
        </>
      )}

      {tab === 'clubs' && (
        <div className="leaderboard-card">
          <div className="table-head" style={{ gridTemplateColumns: '80px 1fr 140px' }}>
            <span className="col-center">POZ</span>
            <span>KLUB</span>
            <span className="col-center">PUNKTY ŁĄCZNIE</span>
          </div>

          {clubStandings.map((c, index) => (
            <div
              key={c.club}
              className={`leader-row ${index === 0 ? 'leader-first-place' : ''}`}
              style={{ gridTemplateColumns: '80px 1fr 140px' }}
            >
              <span className="rank-cell col-center">
                <span className={`rank ${index === 0 ? 'gold' : ''}`}>#{index + 1}</span>
              </span>

              <span className="player-cell font-bold text-slate-900 text-sm">
                <Shield size={18} className="text-emerald-600 inline mr-2" />
                {c.club}
              </span>

              <span className="col-center font-extrabold text-base text-slate-900">
                {c.points.toFixed(1)} pkt
              </span>
            </div>
          ))}

          {clubStandings.length === 0 && (
            <div className="empty-state">Brak punktów klubowych. Rozegraj turniej ligowy.</div>
          )}
        </div>
      )}
    </section>
  );
}