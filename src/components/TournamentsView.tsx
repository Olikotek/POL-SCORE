import { useState, useMemo } from 'react';
import {
  Search,
  Calendar,
  MapPin,
  Users,
  Eye,
  CheckCircle2,
  XCircle,
  UserPlus,
  ArrowLeft,
  RotateCcw,
} from 'lucide-react';
import type { Tournament, Store, Player, Category } from '@/types';
import { CATEGORIES, flagEmoji } from '@/types';

export function TournamentsView({
  tournaments,
  store,
  currentUser,
  userProfile,
  onRegisterClick,
  onRequireAuth,
  onOpenPlayer,
}: {
  tournaments: Tournament[];
  store: Store;
  currentUser: any;
  userProfile: Player | null;
  onRegisterClick: (tournament: Tournament) => void;
  onRequireAuth: () => void;
  onOpenPlayer: (playerId: string) => void;
}) {
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');

  const [playerCategoryFilter, setPlayerCategoryFilter] = useState<Category | 'all'>('all');
  const [playerNameFilter, setPlayerNameFilter] = useState('');
  const [playerClubFilter, setPlayerClubFilter] = useState('');

  const filteredTournaments = useMemo(() => {
    return (tournaments || []).filter((t) => {
      const matchSearch =
        !searchQuery ||
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.courseName && t.courseName.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && t.status !== 'completed') ||
        (statusFilter === 'completed' && t.status === 'completed');

      return matchSearch && matchStatus;
    });
  }, [tournaments, searchQuery, statusFilter]);

  const registeredPlayers = useMemo(() => {
    return (store.players || []).filter((p) => p.isActive !== false);
  }, [store.players]);

  const filteredRegisteredPlayers = useMemo(() => {
    return registeredPlayers.filter((p) => {
      const matchCat = playerCategoryFilter === 'all' || p.category === playerCategoryFilter;
      const matchName = !playerNameFilter || p.name.toLowerCase().includes(playerNameFilter.toLowerCase());
      const matchClub = !playerClubFilter || (p.club && p.club.toLowerCase().includes(playerClubFilter.toLowerCase()));
      return matchCat && matchName && matchClub;
    });
  }, [registeredPlayers, playerCategoryFilter, playerNameFilter, playerClubFilter]);

  const getYearOfBirth = (birthDateString?: string) => {
    if (!birthDateString) return '–';
    const year = new Date(birthDateString).getFullYear();
    return isNaN(year) ? '–' : year;
  };

  // WIDOK 2: LISTA ZAPISANYCH NA TURNIEJ
  if (selectedTournament) {
    return (
      <section className="leaderboard-section-wrap" style={{ background: '#ffffff', borderRadius: '12px', padding: '24px', border: '1px solid #e2e8f0' }}>
        <div style={{ borderBottom: '2px solid #ef4444', paddingBottom: '8px', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#ef4444', margin: 0 }}>
            Lista zawodników zapisanych na turniej
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0', fontWeight: 700 }}>
            {selectedTournament.name} · {selectedTournament.date} {selectedTournament.courseName ? `· ${selectedTournament.courseName}` : ''}
          </p>
        </div>

        <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 800, color: '#475569' }}>Kategoria</label>
            <select
              value={playerCategoryFilter}
              onChange={(e) => setPlayerCategoryFilter(e.target.value as any)}
              style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
            >
              <option value="all">-- wszystkie --</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 800, color: '#475569' }}>Imię i nazwisko</label>
            <input
              type="text"
              value={playerNameFilter}
              onChange={(e) => setPlayerNameFilter(e.target.value)}
              placeholder="Szukaj gracza..."
              style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1', width: '160px' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 800, color: '#475569' }}>Klub</label>
            <input
              type="text"
              value={playerClubFilter}
              onChange={(e) => setPlayerClubFilter(e.target.value)}
              placeholder="Nazwa klubu..."
              style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1', width: '140px' }}
            />
          </div>

          <button
            type="button"
            onClick={() => {
              setPlayerCategoryFilter('all');
              setPlayerNameFilter('');
              setPlayerClubFilter('');
            }}
            style={{ background: '#64748b', color: '#fff', border: 'none', borderRadius: '4px', padding: '5px 10px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <RotateCcw size={12} /> Resetuj
          </button>
        </div>

        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: '11px', fontWeight: 800 }}>
                <th style={{ padding: '10px 12px' }}>Zapisany</th>
                <th style={{ padding: '10px 8px', textAlign: 'center' }}>Nr</th>
                <th style={{ padding: '10px 12px' }}>Imię i nazwisko</th>
                <th style={{ padding: '10px 8px', textAlign: 'center' }}>Płeć</th>
                <th style={{ padding: '10px 8px', textAlign: 'center' }}>Rok urodzenia</th>
                <th style={{ padding: '10px 8px', textAlign: 'center' }}>Kraj</th>
                <th style={{ padding: '10px 12px' }}>Miasto</th>
                <th style={{ padding: '10px 12px' }}>Klub</th>
                <th style={{ padding: '10px 8px', textAlign: 'center' }}>Opłacone / Potwierdzone</th>
                <th style={{ padding: '10px 8px', textAlign: 'center' }}>Akcja</th>
              </tr>
            </thead>
            <tbody>
              {filteredRegisteredPlayers.map((p, index) => {
                const year = getYearOfBirth(p.birthDate);
                const gender = p.gender === 'Female' ? 'K' : 'M';

                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', color: '#64748b', fontSize: '12px' }}>
                      {selectedTournament.date}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 800, color: '#64748b' }}>
                      {index + 1}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <button
                        type="button"
                        onClick={() => onOpenPlayer(p.id)}
                        style={{ background: 'none', border: 'none', padding: 0, color: '#ef4444', fontWeight: 800, fontSize: '13px', cursor: 'pointer', textAlign: 'left' }}
                      >
                        {p.name}
                      </button>
                      {p.isAmateur && (
                        <span style={{ marginLeft: '6px', background: '#10b981', color: '#fff', fontSize: '9px', fontWeight: 800, padding: '1px 4px', borderRadius: '3px' }}>
                          AM
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700 }}>
                      {gender}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', color: '#475569' }}>
                      {year}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                      {p.flagImage ? (
                        <img src={p.flagImage} alt={p.flag} style={{ width: '16px', height: '11px', display: 'inline-block' }} />
                      ) : (
                        <span>{flagEmoji(p.flag)}</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#475569' }}>
                      {p.city || '–'}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#475569' }}>
                      {p.club ?? '–'}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <span title="Status opłaty"><XCircle size={15} color="#dc2626" /></span>
                        <span title="Potwierdzony"><CheckCircle2 size={15} color="#16a34a" /></span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => onOpenPlayer(p.id)}
                        title="Zobacz profil"
                        style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '50%', width: '26px', height: '26px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}
                      >
                        <Eye size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredRegisteredPlayers.length === 0 && (
            <div className="empty-state" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
              Brak zawodników na liście startowej.
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <button
            type="button"
            onClick={() => setSelectedTournament(null)}
            style={{
              background: '#ef4444',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '10px 24px',
              fontSize: '14px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <ArrowLeft size={16} /> Powrót
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
            <span>Łączna liczba zarejestrowanych: {filteredRegisteredPlayers.length}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
              🇵🇱 {filteredRegisteredPlayers.length}
            </span>
          </div>
        </div>
      </section>
    );
  }

  // WIDOK 1: LISTA TURNIEJÓW
  return (
    <section className="leaderboard-section-wrap" style={{ background: '#ffffff', borderRadius: '12px', padding: '24px', border: '1px solid #e2e8f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #ef4444', paddingBottom: '10px', marginBottom: '14px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '-0.02em' }}>
          Lista Turniejów
        </h1>
        <div style={{ display: 'flex', background: '#ef4444', color: '#fff', padding: '4px 12px', borderRadius: '4px', fontWeight: 800, fontSize: '12px', alignItems: 'center', gap: '6px' }}>
          <span>WIDOK LISTY</span>
        </div>
      </div>

      <div style={{ background: '#ef4444', color: '#ffffff', padding: '10px 14px', borderRadius: '6px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '14px', fontSize: '12px', fontWeight: 700 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>Szukaj:</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Nazwa turnieju..."
            style={{ padding: '4px 8px', borderRadius: '4px', border: 'none', color: '#0f172a', fontSize: '12px', width: '180px' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            style={{ padding: '4px 8px', borderRadius: '4px', border: 'none', color: '#0f172a', fontSize: '12px' }}
          >
            <option value="all">-- wszystkie --</option>
            <option value="active">Otwarty / Rejestracja</option>
            <option value="completed">Zakończone</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => {
            setSearchQuery('');
            setStatusFilter('all');
          }}
          style={{ background: '#b91c1c', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '11px', fontWeight: 800, cursor: 'pointer', marginLeft: 'auto' }}
        >
          Resetuj filtr
        </button>
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: '11px', fontWeight: 800 }}>
              <th style={{ padding: '10px 12px' }}>Start</th>
              <th style={{ padding: '10px 14px' }}>Turniej</th>
              <th style={{ padding: '10px 12px' }}>Organizator</th>
              <th style={{ padding: '10px 10px' }}>Status</th>
              <th style={{ padding: '10px 12px' }}>Pole</th>
              <th style={{ padding: '10px 8px', textAlign: 'center' }}>Kraj</th>
              <th style={{ padding: '10px 10px', textAlign: 'center' }}>Statystyki</th>
              <th style={{ padding: '10px 12px', textAlign: 'center' }}>Akcja</th>
            </tr>
          </thead>
          <tbody>
            {filteredTournaments.map((t) => {
              const isCompleted = t.status === 'completed';
              const isCurrentLive = t.id === store.tournamentName || t.status === 'active';
              const count = isCurrentLive ? registeredPlayers.length : 0;

              return (
                <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 12px', color: '#64748b', fontSize: '12px', fontWeight: 600 }}>
                    {t.date} 09:00
                  </td>

                  <td style={{ padding: '10px 14px' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedTournament(t)}
                      style={{ background: 'none', border: 'none', padding: 0, color: '#ef4444', fontWeight: 800, fontSize: '13px', cursor: 'pointer', textAlign: 'left' }}
                    >
                      {t.name}
                    </button>
                    {t.isPolishOpen && (
                      <span style={{ marginLeft: '6px', fontSize: '10px', fontWeight: 800, color: '#dc2626', background: '#fee2e2', padding: '1px 5px', borderRadius: '3px' }}>
                        POLISH OPEN
                      </span>
                    )}
                  </td>

                  <td style={{ padding: '10px 12px', color: '#475569', fontSize: '12px', fontWeight: 600 }}>
                    Polska Federacja Footgolfa
                  </td>

                  <td style={{ padding: '10px 10px' }}>
                    {isCompleted ? (
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                        Zakończone, wyniki
                      </span>
                    ) : (
                      <span style={{ fontSize: '11px', fontWeight: 800, color: '#16a34a', background: '#dcfce7', padding: '2px 6px', borderRadius: '4px' }}>
                        Rejestracja / Gra
                      </span>
                    )}
                  </td>

                  <td style={{ padding: '10px 12px', color: '#475569', fontSize: '12px' }}>
                    {t.courseName ?? 'Pole Turniejowe PFFG'}
                  </td>

                  <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                    🇵🇱
                  </td>

                  <td style={{ padding: '10px 10px', textAlign: 'center', fontWeight: 700, fontSize: '12px', color: '#475569' }}>
                    {isCompleted ? '72 / 72 / 72' : `72 / ${count} / ${count}`}
                  </td>

                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'center' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedTournament(t)}
                        title="Zobacz listę zapisanych zawodników"
                        style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '50%', width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#475569' }}
                      >
                        <Eye size={14} />
                      </button>

                      {!isCompleted && (
                        <button
                          type="button"
                          onClick={() => {
                            if (!currentUser) {
                              onRequireAuth();
                            } else {
                              onRegisterClick(t);
                            }
                          }}
                          title="Zapisz się na ten turniej"
                          style={{
                            background: '#10b981',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '4px 10px',
                            fontSize: '11px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <UserPlus size={12} /> Zapisz się
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredTournaments.length === 0 && (
          <div className="empty-state" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
            Brak turniejów w bazie.
          </div>
        )}
      </div>
    </section>
  );
}
