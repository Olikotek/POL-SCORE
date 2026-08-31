// src/components/Scorecard.tsx
import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  LogOut,
  Minus,
  Plus,
  Save,
  Trophy,
  X,
} from 'lucide-react';
import type { Flight, Hole, Player, Round, Store } from '@/types';
import { ROUNDS, flagEmoji } from '@/types';
import { initials, relative, honourOrder, subtotal } from '@/scoring';
import { saveHoleScores } from '@/actions';

const SESSION_KEY = 'pffg_flight_session';

type FlightSession = { flightId: string; round: Round; holeIdx: number };

function loadSession(): FlightSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FlightSession;
  } catch {
    return null;
  }
}

function saveSession(s: FlightSession | null) {
  if (s) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

function shotgunOrder(startHole: number, totalHoles: number): number[] {
  const order: number[] = [];
  for (let i = 0; i < totalHoles; i++) {
    order.push(((startHole - 1 + i) % totalHoles) + 1);
  }
  return order;
}

function formatRelativeScore(playerScores: number[], holes: Hole[]) {
  const rel = relative(playerScores, holes);
  if (rel === 0) return '(E)';
  if (rel > 0) return `(+${rel})`;
  return `(${rel})`;
}

function ScoreShape({ value, par }: { value: number | null; par: number }) {
  if (!value) {
    return (
      <div className="score-shape-box" style={{ width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: '800', color: '#94a3b8', background: '#f8fafc', borderRadius: '12px' }}>
        –
      </div>
    );
  }

  const delta = value - par;

  if (value === 1) {
    return (
      <div className="score-shape-box" style={{ position: 'relative', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg viewBox="0 0 26 26" style={{ position: 'absolute', width: '52px', height: '52px', left: '-2px', top: '-2px' }}>
          <g transform="translate(1,1)">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#fff" stroke="#000" strokeWidth="4" strokeLinejoin="round" />
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#fff" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#fff" stroke="#000" strokeWidth="1" strokeLinejoin="round" />
          </g>
        </svg>
        <span style={{ position: 'relative', zIndex: 1, color: '#000', fontSize: '18px', fontWeight: '900' }}>{value}</span>
      </div>
    );
  }

  let style: React.CSSProperties = {
    width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: '900', color: '#0f172a', boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
  };

  if (delta <= -2) {
    style = { ...style, borderRadius: '50%', backgroundColor: '#ef4444', border: '2px solid #000', color: '#fff', boxShadow: '0 4px 6px rgba(239, 68, 68, 0.3)' };
  } else if (delta === -1) {
    style = { ...style, borderRadius: '50%', backgroundColor: '#fca5a5', color: '#000' };
  } else if (delta === 0) {
    style = { ...style, backgroundColor: '#f8fafc', borderRadius: '12px' };
  } else if (delta === 1) {
    style = { ...style, backgroundColor: '#e2e8f0', color: '#000', borderRadius: '12px' };
  } else if (delta >= 2) {
    style = { ...style, backgroundColor: '#94a3b8', color: '#fff', borderRadius: '12px' };
  }

  return <div className="score-shape-box" style={style}>{value}</div>;
}

export function Scorecard({
  store,
  activeFlight,
  setActiveFlight,
  onBack,
}: {
  store: Store;
  activeFlight: Flight | null;
  setActiveFlight: (f: Flight | null) => void;
  onBack: () => void;
}) {
  const [code, setCode] = useState('');
  const [round, setRound] = useState<Round>(1);
  const [holeIdx, setHoleIdx] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, number[]>>({});
  const [feedback, setFeedback] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);

  useEffect(() => {
    const session = loadSession();
    if (!session) return;
    const found = store.flights.find((f) => f.id === session.flightId && f.round === session.round);
    if (found) {
      setActiveFlight(found);
      setRound(session.round);
      setHoleIdx(session.holeIdx);
      setDrafts((prev) => {
        const nextDrafts: Record<string, number[]> = { ...prev };
        store.players
          .filter((p) => found.playerIds.includes(p.id))
          .forEach((p) => {
            if (!nextDrafts[p.id] || nextDrafts[p.id].every((s) => s === 0)) {
              nextDrafts[p.id] = [...p.scores[session.round]];
            }
          });
        return nextDrafts;
      });
    }
  }, []);

  useEffect(() => {
    if (activeFlight) {
      saveSession({ flightId: activeFlight.id, round, holeIdx });
    }
  }, [activeFlight, round, holeIdx]);

  const logoutFlight = () => {
    saveSession(null);
    setActiveFlight(null);
    setCode('');
    setDrafts({});
  };

  const holes = store.holesByRound[round];
  const currentPlayers = activeFlight
    ? store.players.filter((p) => activeFlight.playerIds.includes(p.id))
    : [];

  const holeOrder = useMemo(
    () => (activeFlight ? shotgunOrder(activeFlight.startHole ?? 1, 18) : []),
    [activeFlight]
  );

  const enter = () => {
    const found = store.flights.find((f) => f.code === code && f.round === round);
    if (!found) return;
    setDrafts((prev) => {
      const nextDrafts: Record<string, number[]> = { ...prev };
      store.players
        .filter((p) => found.playerIds.includes(p.id))
        .forEach((p) => {
          if (!nextDrafts[p.id] || nextDrafts[p.id].every((s) => s === 0)) {
            nextDrafts[p.id] = [...p.scores[round]];
          }
        });
      return nextDrafts;
    });
    setActiveFlight(found);
    setCode('');
    setHoleIdx(0);
  };

  const currentHoleNumber = holeOrder[holeIdx] ?? 1;
  const currentHoleIndex = currentHoleNumber - 1;
  const activeHole = holes[currentHoleIndex] ?? { number: currentHoleNumber, par: 4, meters: 100 };

  const honourMap = useMemo(() => {
    if (!activeFlight || currentPlayers.length === 0) return new Map<string, number>();
    const entries = currentPlayers.map((p) => ({ id: p.id, scores: drafts[p.id] ?? p.scores[round] }));
    const order = honourOrder(entries, holes, currentHoleIndex);
    const map = new Map<string, number>();
    order.forEach((id, idx) => map.set(id, idx + 1));
    return map;
  }, [currentPlayers, drafts, holes, currentHoleIndex, activeFlight, round]);

  const changeDraft = (playerId: string, amount: number) => {
    setDrafts((prev) => {
      const current = prev[playerId] ?? Array(18).fill(0);
      const next = [...current];
      const value = next[currentHoleIndex];
      if (value <= 0) {
        next[currentHoleIndex] = activeHole.par;
      } else {
        next[currentHoleIndex] = Math.max(1, value + amount);
      }
      return { ...prev, [playerId]: next };
    });
    setExpandedPlayerId(null);
  };

  const setDraftDirect = (playerId: string, value: number) => {
    setDrafts((prev) => {
      const current = prev[playerId] ?? Array(18).fill(0);
      const next = [...current];
      next[currentHoleIndex] = Math.max(1, value);
      return { ...prev, [playerId]: next };
    });
    setExpandedPlayerId(null);
  };

  const saveHole = async () => {
    if (!activeFlight) return;
    setSaving(true);
    setExpandedPlayerId(null);
    try {
      const playersWithDrafts = currentPlayers.map((p) => ({
        id: p.id,
        scores: drafts[p.id] ?? p.scores[round],
      }));
      
      const targetTournamentId =
        (activeFlight as any).tournament_id ||
        (activeFlight as any).tournamentId ||
        (store as any).activeTournamentId ||
        (store as any).tournamentId ||
        null;

      await saveHoleScores(playersWithDrafts, round, currentHoleIndex, targetTournamentId);
      setFeedback(true);
      window.setTimeout(() => {
        setFeedback(false);
        if (holeIdx < 17) {
          setHoleIdx((h) => h + 1);
        }
      }, 900);
    } catch (err: any) {
      alert(`Błąd zapisu dołka do bazy: ${err?.message ?? 'Brak połączenia'}`);
    } finally {
      setSaving(false);
    }
  };

  const canSave = activeFlight
    ? activeFlight.playerIds.some((id) => (drafts[id]?.[currentHoleIndex] ?? 0) > 0)
    : false;

  if (!activeFlight)
    return (
      <section className="lock-page">
        <button className="back-link" onClick={onBack}>
          <ChevronLeft size={15} /> Tabela na żywo
        </button>
        <div className="lock-card scorecard-login">
          <span className="lock-icon green">
            <ClipboardList size={24} />
          </span>
          <p className="eyebrow">
            <span /> KARTA WYNIKÓW
          </p>
          <h1>Otwórz swój Flight</h1>
          <div className="round-switcher">
            {ROUNDS.map((r) => (
              <button
                key={r}
                className={round === r ? 'active' : ''}
                onClick={() => setRound(r)}
                disabled={r === 2 && !store.round2Started}
              >
                Runda {r}
              </button>
            ))}
          </div>
          <p>Wprowadź czterocyfrowy Kod Flightu, aby rozpocząć zapisywanie wyników.</p>
          <input
            autoFocus
            inputMode="numeric"
            maxLength={4}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && enter()}
            placeholder="4821"
          />
          <button disabled={code.length !== 4} className="primary-button full" onClick={enter}>
            Otwórz kartę <ChevronRight size={16} />
          </button>
        </div>
      </section>
    );

  return (
    <section className="scorecard-wrapper">
      <style>{`
        .scorecard-wrapper {
          width: 100%;
          max-width: 100%;
          overflow-x: hidden;
        }
        .scorecard-player-card {
          display: block;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          overflow: hidden;
          padding: 16px 20px;
          margin-bottom: 16px;
          border-radius: 16px;
          background: #ffffff;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
          border: 1px solid #f1f5f9;
        }
        .numpad-container {
          display: flex;
          justify-content: flex-end;
          padding-top: 16px;
          border-top: 1px solid #f1f5f9;
          margin-top: 14px;
        }
        .numpad-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 8px;
          width: 280px;
        }

        @media (max-width: 640px) {
          .scorecard-wrapper {
            padding: 0 2px;
          }
          .scorecard-player-card {
            padding: 12px 10px !important;
            margin-bottom: 10px !important;
            border-radius: 12px !important;
          }
          .player-info-container {
            gap: 8px !important;
          }
          .honour-badge {
            width: 22px !important;
            height: 22px !important;
            font-size: 11px !important;
            border-radius: 4px !important;
          }
          .player-avatar-box {
            width: 42px !important;
            height: 42px !important;
          }
          .player-avatar-box img,
          .player-avatar-box .avatar {
            width: 42px !important;
            height: 42px !important;
            font-size: 14px !important;
          }
          .player-flag-badge {
            width: 16px !important;
            height: 12px !important;
            bottom: -1px !important;
            right: -2px !important;
          }
          .player-name-text {
            font-size: 14px !important;
            max-width: 110px !important;
          }
          .player-score-rel {
            font-size: 12px !important;
          }
          .btn-ctrl {
            width: 40px !important;
            height: 40px !important;
            border-radius: 8px !important;
          }
          .score-shape-box {
            width: 40px !important;
            height: 40px !important;
            font-size: 17px !important;
            border-radius: 8px !important;
          }
          .score-shape-box svg {
            width: 44px !important;
            height: 44px !important;
          }
          .numpad-container {
            justify-content: center !important;
            padding-top: 12px !important;
            margin-top: 10px !important;
          }
          .numpad-grid {
            width: 100% !important;
            gap: 6px !important;
          }
          .numpad-grid button {
            height: 42px !important;
            font-size: 16px !important;
            border-radius: 8px !important;
          }
          .hole-dots button {
            width: 38px !important;
            height: 38px !important;
            font-size: 14px !important;
            border-radius: 8px !important;
          }
        }
      `}</style>

      <div className="section-intro">
        <div>
          <p className="eyebrow">
            <span /> {activeFlight.name} · KARTA WYNIKÓW · RUNDA {round}
            {activeFlight.startHole && activeFlight.startHole > 1
              ? ` · SHOTGUN START DOŁEK ${activeFlight.startHole}`
              : ''}
          </p>
          <h1>Zapisz wynik</h1>
        </div>
        <div className="section-intro-actions">
          <button className="secondary-button" onClick={onBack}>
            <Trophy size={16} /> Tabela
          </button>
          <button className="primary-button" onClick={logoutFlight}>
            <LogOut size={16} /> Wyjdź / Zmień Flight
          </button>
        </div>
      </div>

      <div className="tee-order-bar">
        <span className="tee-order-label">KOLEJNOŚĆ STARTU (HONOUR)</span>
        {currentPlayers.map((p) => {
          const honour = honourMap.get(p.id) ?? 0;
          return (
            <span className="tee-order-item" key={p.id}>
              <span className="tee-order-badge" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{honour}</span>
              {p.name}
            </span>
          );
        })}
      </div>

      <div className="scorecard-shell" style={{ border: 'none', background: 'transparent', padding: '0', marginBottom: '24px' }}>
        <div className="slider-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', padding: '16px 20px', borderRadius: '16px', marginBottom: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ color: '#64748b', fontSize: '13px', fontWeight: '700', letterSpacing: '0.5px' }}>AKTUALNY DOŁEK</span>
            <span style={{ fontSize: '30px', fontWeight: '800', color: '#0f172a', lineHeight: '1' }}>{activeHole.number}</span>
            <span style={{ color: '#94a3b8', fontSize: '15px', fontWeight: '600' }}>/ 18</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
            <span style={{ color: '#0f172a', fontSize: '17px', fontWeight: '800', lineHeight: '1' }}>PAR {activeHole.par}</span>
            <span style={{ color: '#64748b', fontSize: '13px', fontWeight: '600', lineHeight: '1' }}>{activeHole.meters} M</span>
          </div>
        </div>

        <div className="hole-dots" style={{ overflowX: 'auto', paddingBottom: '12px', justifyContent: 'flex-start', flexWrap: 'nowrap', WebkitOverflowScrolling: 'touch' }}>
          {holeOrder.map((holeNum, idx) => {
            const hIndex = holeNum - 1;
            const allSaved = activeFlight.playerIds.every(
              (id) =>
                (drafts[id]?.[hIndex] ??
                  store.players.find((p) => p.id === id)?.scores[round][hIndex] ??
                  0) > 0
            );
            return (
              <button
                key={idx}
                className={`${holeIdx === idx ? 'active' : ''} ${allSaved ? 'hole-done' : ''}`}
                onClick={() => { setHoleIdx(idx); setExpandedPlayerId(null); }}
                style={{ flexShrink: 0, width: '46px', height: '46px', fontSize: '16px', borderRadius: '12px', transition: 'all 0.2s' }}
              >
                {holeNum}
              </button>
            );
          })}
        </div>
      </div>

      <div className="score-entry-list">
        {currentPlayers.map((player) => {
          const playerScores = drafts[player.id] ?? player.scores[round];
          const value = playerScores[currentHoleIndex] || 0;
          const honour = honourMap.get(player.id) ?? 0;
          const isExpanded = expandedPlayerId === player.id;
          
          return (
            <div className={`scorecard-player-card ${isExpanded ? 'numpad-selected' : ''}`} key={player.id}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
                
                <div className="player-info-container" style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                  <div className="honour-badge" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', fontSize: '14px', fontWeight: '700', flexShrink: 0, background: '#1e293b', color: '#fff', borderRadius: '6px' }}>
                    {honour}
                  </div>

                  <div className="player-avatar-box" style={{ position: 'relative', flexShrink: 0, width: '56px', height: '56px' }}>
                    {player.avatar ? (
                      <img
                        src={player.avatar}
                        alt={player.name}
                        style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                      />
                    ) : (
                      <div className="avatar" style={{ width: '100%', height: '100%', fontSize: '18px', fontWeight: 'bold', background: '#e2e8f0', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
                        {initials(player.name)}
                      </div>
                    )}
                    <span className="player-flag-badge" style={{ position: 'absolute', bottom: '-2px', right: '-4px', fontSize: '16px', lineHeight: '1', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' }}>
                      {player.flagImage ? (
                        <img src={player.flagImage} alt="" style={{ width: '20px', height: '14px', borderRadius: '2px', objectFit: 'cover', border: '1px solid #fff', display: 'block' }} />
                      ) : (
                        flagEmoji(player.flag)
                      )}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', minWidth: 0, overflow: 'hidden' }}>
                    <b className="player-name-text" style={{ fontSize: '18px', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#0f172a' }}>
                      {player.name}
                    </b>
                    <span className="player-score-rel" style={{ color: '#64748b', fontSize: '14px', fontWeight: '600', flexShrink: 0 }}>
                      {formatRelativeScore(playerScores, holes)}
                    </span>
                  </div>
                </div>

                <div className="entry-controls" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <button 
                    className="btn-ctrl"
                    onClick={() => changeDraft(player.id, -1)}
                    style={{ width: '48px', height: '48px', borderRadius: '12px', border: 'none', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', cursor: 'pointer', transition: 'background 0.1s' }}
                  >
                    <Minus size={20} />
                  </button>
                  
                  <button 
                    className="btn-ctrl"
                    onClick={() => setExpandedPlayerId(isExpanded ? null : player.id)}
                    style={{ padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px' }}
                  >
                    <ScoreShape value={value} par={activeHole.par} />
                  </button>

                  <button 
                    className="btn-ctrl"
                    onClick={() => changeDraft(player.id, 1)}
                    style={{ width: '48px', height: '48px', borderRadius: '12px', border: 'none', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', cursor: 'pointer', transition: 'background 0.1s' }}
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="numpad-container">
                  <div className="numpad-grid">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                      <button 
                        key={n} 
                        onClick={() => setDraftDirect(player.id, n)}
                        style={{ height: '46px', borderRadius: '10px', background: '#1e293b', color: '#ffffff', border: 'none', fontWeight: '700', fontSize: '18px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                      >
                        {n}
                      </button>
                    ))}
                    <button 
                      onClick={() => setDraftDirect(player.id, 0)}
                      style={{ height: '46px', borderRadius: '10px', background: '#ef4444', color: '#ffffff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(239,68,68,0.2)' }}
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        className={`bulk-save ${feedback ? 'saved' : ''}`}
        disabled={!canSave || saving}
        onClick={saveHole}
        style={{ marginTop: '20px', padding: '16px', fontSize: '15px', fontWeight: '700', borderRadius: '14px', background: feedback ? '#10b981' : '#0f172a', color: '#fff', border: 'none', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: canSave ? 'pointer' : 'not-allowed', opacity: canSave ? 1 : 0.5, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
      >
        {feedback ? <Check size={18} /> : <Save size={18} />}{' '}
        {feedback ? 'Zapisano! Następny dołek...' : `Zapisz wyniki dla dołka ${activeHole.number}`}
      </button>

      <NamedSubtotals
        players={currentPlayers}
        store={store}
        drafts={drafts}
        round={round}
      />
    </section>
  );
}

function NamedSubtotals({
  players,
  store,
  drafts,
  round,
}: {
  players: Player[];
  store: Store;
  drafts: Record<string, number[]>;
  round: Round;
}) {
  const holes = store.holesByRound[round];

  const renderHalf = (label: string, start: number, end: number) => {
    const halfHoles = holes.slice(start, end);
    if (halfHoles.length === 0) return null;
    return (
      <div className="subtotal-block" key={label}>
        <div className="subtotal-header">
          {label} · DOŁKI {halfHoles[0].number}–{halfHoles[halfHoles.length - 1].number}
        </div>
        {players.map((player) => {
          const scores = drafts[player.id] ?? player.scores[round];
          const result = subtotal(scores, holes, start, end);
          return (
            <div className="subtotal-player-row" key={player.id}>
              <span className="subtotal-name">{player.name}</span>
              <b>
                {result.sum || '–'} <em>{result.sum ? `${formatRelativeScore(scores, holes)}` : ''}</em>
              </b>
            </div>
          );
        })}
      </div>
    );
  };
  return (
    <div className="subtotal-grid">
      {renderHalf('OUT', 0, 9)}
      {renderHalf('IN', 9, 18)}
    </div>
  );
}