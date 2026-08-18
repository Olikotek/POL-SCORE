import { useMemo, useState, useEffect, useRef } from 'react';
import { ChevronRight, ClipboardList, TrendingUp, TrendingDown, Minus, Trophy } from 'lucide-react';
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

export function Leaderboard({
  store,
  onEnter,
  onOpenPlayer,
}: {
  store: Store;
  onEnter: () => void;
  onOpenPlayer: (playerId: string) => void;
}) {
  const [filter, setFilter] = useState<Category | 'Wszystkie'>('Wszystkie');
  const { holesByRound } = store;
  const holesR1 = holesByRound[1];
  const holesR2 = holesByRound[2];

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

  const prevRanksRef = useRef<Map<string, number>>(new Map());
  const [trends, setTrends] = useState<Map<string, 'up' | 'down' | 'same'>>(new Map());

  useEffect(() => {
    const prev = prevRanksRef.current;
    const next = new Map<string, 'up' | 'down' | 'same'>();
    sorted.forEach((p, index) => {
      const currentRank = ranks[index];
      const prevRank = prev.get(p.id);
      if (prevRank === undefined) {
        next.set(p.id, 'same');
      } else if (currentRank < prevRank) {
        next.set(p.id, 'up');
      } else if (currentRank > prevRank) {
        next.set(p.id, 'down');
      } else {
        next.set(p.id, 'same');
      }
    });
    setTrends(next);
    const newPrev = new Map<string, number>();
    sorted.forEach((p, index) => newPrev.set(p.id, ranks[index]));
    prevRanksRef.current = newPrev;
  }, [sorted, ranks]);

  // Szablon kolumn tabeli dynamiczny w zależności od startu Rundy 2
  const gridTemplate = store.round2Started
    ? '70px minmax(180px, 1fr) 80px 70px 70px 70px 90px 40px'
    : '70px minmax(180px, 1fr) 80px 70px 70px 90px 40px';

  return (
    <section className="leaderboard-section-wrap">
      <div className="section-intro">
        <div>
          <p className="eyebrow">
            <span className="eyebrow-line" /> {store.tournamentName.toUpperCase()}
          </p>
          <h1 className="tournament-title">Tabela na żywo</h1>
          <p className="intro-copy">
            Klasyfikacja turnieju aktualizowana na żywo po każdym zapisanym dołku.
          </p>
        </div>
        <button className="primary-button pffg-action-btn" onClick={onEnter}>
          <ClipboardList size={17} /> Wprowadź wynik <ChevronRight size={16} />
        </button>
      </div>

      <div className="filter-bar">
        <span className="filter-label">KATEGORIA</span>
        <button
          className={`filter-chip ${filter === 'Wszystkie' ? 'active' : ''}`}
          onClick={() => setFilter('Wszystkie')}
        >
          Wszystkie
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            className={`filter-chip ${filter === c ? 'active' : ''}`}
            onClick={() => setFilter(c)}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="leaderboard-card">
        <div className="table-head" style={{ display: 'grid', gridTemplateColumns: gridTemplate }}>
          <span className="col-center">MIEJSCE</span>
          <span>ZAWODNIK</span>
          <span className="desktop-cell col-center">TOTAL</span>
          <span className="desktop-cell col-center">THRU</span>
          <span className="desktop-cell col-center">R1</span>
          {store.round2Started && <span className="desktop-cell col-center">R2</span>}
          <span className="desktop-cell col-center">UDERZENIA</span>
          <span className="col-center" />
        </div>
        {sorted.map((player, index) => {
          const total = combinedRelative(player, holesR1, holesR2);
          const r1Rel = relative(player.scores[1], holesR1);
          const r2Rel = relative(player.scores[2], holesR2);
          const strokes = totalStrokes(player.scores[1]) + (store.round2Started ? totalStrokes(player.scores[2]) : 0);
          const thru = thruLabel(player);
          const rank = ranks[index];
          const tiedCount = ranks.filter((r) => r === rank).length;
          const isTied = tiedCount > 1;
          const isLeader = rank === 1 && !isTied;
          const isTop10 = rank <= 10;
          const display = isTied ? `T${rank}` : ordinalLabel(rank);
          const trend = trends.get(player.id) ?? 'same';

          return (
            <button
              className={`leader-row ${isLeader ? 'leader-first-place' : ''}`}
              key={player.id}
              style={{ display: 'grid', gridTemplateColumns: gridTemplate }}
              onClick={() => onOpenPlayer(player.id)}
            >
              <span className="rank-cell col-center">
                <span className={`rank ${isTop10 ? 'top10' : ''} ${isLeader ? 'gold' : ''}`}>
                  {display}
                </span>
                {trend === 'up' && <span className="trend-up" title="Awans"><TrendingUp size={12} /></span>}
                {trend === 'down' && <span className="trend-down" title="Spadek"><TrendingDown size={12} /></span>}
                {trend === 'same' && <span className="trend-same" title="Bez zmian"><Minus size={12} /></span>}
              </span>

              <span className="player-cell">
                {player.avatar ? (
                  <img src={player.avatar} alt={player.name} className="avatar avatar-img" />
                ) : (
                  <span className="avatar">{initialsLocal(player.name)}</span>
                )}
                
                <div className="player-info-container">
                  <div className="player-identity">
                    {player.flagImage ? (
                      <img src={player.flagImage} alt={player.flag} className="flag-img-inline" />
                    ) : (
                      <span className="flag-emoji">{flagEmoji(player.flag)}</span>
                    )}
                    <span className="player-name-fixed" title={player.name}>
                      {player.name}
                    </span>
                    {player.isAmateur && <span className="am-badge">AM</span>}
                  </div>

                  {player.club ? (
                    <span className="player-club-slot" title={player.club}>
                      {player.club}
                    </span>
                  ) : (
                    <span className="player-club-slot-empty" />
                  )}
                </div>
              </span>

              <span className={`desktop-cell to-par-cell col-center ${total < 0 ? 'neg' : ''}`}>
                {total < 0 ? <span className="neg-badge">{relativeLabel(total)}</span> : (total === 0 ? 'E' : relativeLabel(total))}
              </span>

              <span className="desktop-cell thru-cell col-center">{thru}</span>

              <span className="desktop-cell col-center">
                {totalStrokes(player.scores[1]) > 0 ? (r1Rel === 0 ? 'E' : relativeLabel(r1Rel)) : '–'}
              </span>

              {store.round2Started && (
                <span className="desktop-cell col-center">
                  {totalStrokes(player.scores[2]) > 0 ? (r2Rel === 0 ? 'E' : relativeLabel(r2Rel)) : '–'}
                </span>
              )}

              <span className="desktop-cell strokes col-center font-bold">{strokes || '–'}</span>

              <span className="chevron col-center">
                <ChevronRight size={17} />
              </span>
            </button>
          );
        })}
        {sorted.length === 0 && (
          <div className="empty-state">Brak aktywnych zawodników w tej kategorii.</div>
        )}
      </div>
    </section>
  );
}

function initialsLocal(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}