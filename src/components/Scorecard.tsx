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

function formatShortName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
  }
  return fullName;
}

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
  const [avatarErrors, setAvatarErrors] = useState<Record<string, boolean>>({});

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

  const firstNine = holeOrder.slice(0, 9);
  const secondNine = holeOrder.slice(9, 18);

  const renderHoleButton = (holeNum: number, originalIdx: number) => {
    const hIndex = holeNum - 1;
    const allSaved = activeFlight.playerIds.every(
      (id) =>
        (drafts[id]?.[hIndex] ??
          store.players.find((p) => p.id === id)?.scores[round][hIndex] ??
          0) > 0
    );
    return (
      <button
        key={originalIdx}
        className={`hole-grid-btn ${holeIdx === originalIdx ? 'active' : ''} ${allSaved ? 'hole-done' : ''}`}
        onClick={() => { setHoleIdx(originalIdx); setExpandedPlayerId(null); }}
      >
        {holeNum}
      </button>
    );
  };

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
          padding: 14px 16px;
          margin-bottom: 12px;
          border-radius: 16px;
          background: #ffffff;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
          border: 1px solid #f1f5f9;
        }
        .holes-grid-container {
          display: flex;
          flex-direction: column;
          gap: 6px;
          width: 100%;
        }
        .holes-grid-row {
          display: grid;
          grid-template-columns: repeat(9, 1fr);
          gap: 5px;
          width: 100%;
        }
        .hole-grid-btn {
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 800;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #334155;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .hole-grid-btn.active {
          background: #1b88cc !important;
          color: #ffffff !important;
          border-color: #1b88cc !important;
          box-shadow: 0 2px 8px rgba(27, 136, 204, 0.35);
        }
        .hole-grid-btn.hole-done {
          background: #f0fdf4;
          border-color: #86efac;
          color: #16a34a;
        }
        .numpad-container {
          display: flex;
          justify-content: flex-end;
          padding-top: 14px;
          border-top: 1px solid #f1f5f9;
          margin-top: 12px;
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
            padding: 10px 8px !important;
            margin-bottom: 8px !important;
            border-radius: 12px !important;
          }
          .holes-grid-row {
            gap: 4px !important;
          }
          .hole-grid-btn {
            height: 34px !important;
            font-size: 12px !important;
            border-radius: 6px !important;
          }
          .honour-badge {
            width: 20px !important;
            height: 20px !important;
            font-size: 10px !important;
            border-radius: 4px !important;
          }
          .player-avatar-box {
            width: 38px !important;
            height: 38px !important;
          }
          .player-avatar-box img,
          .player-avatar-box .avatar {
            width: 38px !important;
            height: 38px !important;
            font-size: 12px !important;
          }
          .player-flag-badge {
            bottom: -2px !important;
            right: -3px !important;
          }
          .player-flag-badge img {
            width: 14px !important;
            height: 10px !important;
          }
          .btn-ctrl {
            width: 38px !important;
            height: 38px !important;
            border-radius: 8px !important;
          }
          .score-shape-box {
            width: 38px !important;
            height: 38px !important;
            font-size: 16px !important;
            border-radius: 8px !important;
          }
          .score-shape-box svg {
            width: 42px !important;
            height: 42px !important;
          }
          .numpad-container {
            justify-content: center !important;
            padding-top: 10px !important;
            margin-top: 8px !important;
          }
          .numpad-grid {
            width: 100% !important;
            gap: 5px !important;
          }
          .numpad-grid button {
            height: 38px !important;
            font-size: 15px !important;
            border-radius: 6px !important;
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

      {/* NAGŁÓWEK DOŁKA ORAZ SIATKA 2x9 DOŁKÓW */}
      <div className="scorecard-shell" style={{ border: 'none', background: 'transparent', padding: '0', marginBottom: '16px' }}>
        <div className="slider-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', padding: '14px 18px', borderRadius: '14px', marginBottom: '10px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ color: '#64748b', fontSize: '12px', fontWeight: '700', letterSpacing: '0.5px' }}>AKTUALNY DOŁEK</span>
            <span style={{ fontSize: '28px', fontWeight: '900', color: '#0f172a', lineHeight: '1' }}>{activeHole.number}</span>
            <span style={{ color: '#94a3b8', fontSize: '14px', fontWeight: '600' }}>/ 18</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
            <span style={{ color: '#0f172a', fontSize: '16px', fontWeight: '800', lineHeight: '1' }}>PAR {activeHole.par}</span>
            <span style={{ color: '#64748b', fontSize: '12px', fontWeight: '600', lineHeight: '1' }}>{activeHole.meters} M</span>
          </div>
        </div>

        {/* 2 RZĘDY PO 9 DOŁKÓW */}
        <div className="holes-grid-container">
          <div className="holes-grid-row">
            {firstNine.map((holeNum, idx) => renderHoleButton(holeNum, idx))}
          </div>
          <div className="holes-grid-row">
            {secondNine.map((holeNum, idx) => renderHoleButton(holeNum, idx + 9))}
          </div>
        </div>
      </div>

      {/* LISTA ZAWODNIKÓW */}
      <div className="score-entry-list">
        {currentPlayers.map((player) => {
          const playerScores = drafts[player.id] ?? player.scores[round];
          const value = playerScores[currentHoleIndex] || 0;
          const honour = honourMap.get(player.id) ?? 0;
          const isExpanded = expandedPlayerId === player.id;
          const shortPlayerName = formatShortName(player.name);
          const avatarPath = getPublicAvatarPath(player.name, player.avatar);
          const hasError = avatarErrors[player.id];

          return (
            <div className={`scorecard-player-card ${isExpanded ? 'numpad-selected' : ''}`} key={player.id}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                  {/* NUMER HONOUR */}
                  <div className="honour-badge" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', fontSize: '11px', fontWeight: '800', flexShrink: 0, background: '#1e293b', color: '#fff', borderRadius: '4px' }}>
                    {honour}
                  </div>

                  {/* AVATAR + FLAGA */}
                  <div className="player-avatar-box" style={{ position: 'relative', flexShrink: 0, width: '42px', height: '42px' }}>
                    {!hasError ? (
                      <img
                        src={avatarPath}
                        alt={player.name}
                        style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', boxShadow: '0 2px 6px rgba(0,0,0,0.08)', display: 'block', backgroundColor: '#e2e8f0' }}
                        onError={() => {
                          setAvatarErrors((prev) => ({ ...prev, [player.id]: true }));
                        }}
                      />
                    ) : (
                      <div className="avatar" style={{ width: '100%', height: '100%', fontSize: '13px', fontWeight: 'bold', background: '#e2e8f0', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', border: '1px solid #cbd5e1' }}>
                        {initials(player.name)}
                      </div>
                    )}
                    
                    {/* FLAGA */}
                    <span className="player-flag-badge" style={{ position: 'absolute', bottom: '-2px', right: '-2px', lineHeight: 1, zIndex: 2 }}>
                      <img
                        src={player.flagImage || flagEmoji(player.flag || 'PL')}
                        alt={player.flag || 'PL'}
                        style={{ width: '16px', height: '11px', borderRadius: '2px', objectFit: 'cover', border: '1.5px solid #ffffff', display: 'block' }}
                      />
                    </span>
                  </div>
                  
                  {/* IMIĘ I NAZWISKO ORAZ WYNIK PRZY PRAWEJ KRAWĘDZI */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 0, flex: 1, overflow: 'hidden', gap: '6px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '800', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#0f172a' }}>
                      {shortPlayerName}
                    </span>
                    <span style={{ color: '#64748b', fontSize: '12px', fontWeight: '700', flexShrink: 0, marginLeft: 'auto' }}>
                      {formatRelativeScore(playerScores, holes)}
                    </span>
                  </div>
                </div>

                {/* PRZYCISKI WPROWADZANIA WYNIKU */}
                <div className="entry-controls" style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                  <button 
                    className="btn-ctrl"
                    onClick={() => changeDraft(player.id, -1)}
                    style={{ width: '40px', height: '40px', borderRadius: '10px', border: 'none', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', cursor: 'pointer', transition: 'background 0.1s' }}
                  >
                    <Minus size={18} />
                  </button>
                  
                  <button 
                    className="btn-ctrl"
                    onClick={() => setExpandedPlayerId(isExpanded ? null : player.id)}
                    style={{ padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px' }}
                  >
                    <ScoreShape value={value} par={activeHole.par} />
                  </button>

                  <button 
                    className="btn-ctrl"
                    onClick={() => changeDraft(player.id, 1)}
                    style={{ width: '40px', height: '40px', borderRadius: '10px', border: 'none', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', cursor: 'pointer', transition: 'background 0.1s' }}
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>

              {/* ROZWIJANA KLAWIATURA NUMERYCZNA */}
              {isExpanded && (
                <div className="numpad-container">
                  <div className="numpad-grid">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                      <button 
                        key={n} 
                        onClick={() => setDraftDirect(player.id, n)}
                        style={{ height: '40px', borderRadius: '8px', background: '#1e293b', color: '#ffffff', border: 'none', fontWeight: '700', fontSize: '16px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                      >
                        {n}
                      </button>
                    ))}
                    <button 
                      onClick={() => setDraftDirect(player.id, 0)}
                      style={{ height: '40px', borderRadius: '8px', background: '#ef4444', color: '#ffffff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(239,68,68,0.2)' }}
                    >
                      <X size={18} />
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
        style={{ marginTop: '16px', padding: '16px', fontSize: '15px', fontWeight: '800', borderRadius: '14px', background: feedback ? '#10b981' : '#0f172a', color: '#fff', border: 'none', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: canSave ? 'pointer' : 'not-allowed', opacity: canSave ? 1 : 0.5, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
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
              <span className="subtotal-name">{formatShortName(player.name)}</span>
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