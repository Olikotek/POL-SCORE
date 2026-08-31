// src/App.tsx
import { useState } from 'react';
import { Flag, LockKeyhole, Trophy, Calendar, Archive as ArchiveIcon, Award, User, LogIn, LogOut, CreditCard as Edit, Clock } from 'lucide-react';
import type { Flight, View, Tournament } from '@/types';
import { useStore } from '@/useStore';
import { combinedRelative } from '@/scoring';
import { supabase } from '@/lib/supabase';
import { Leaderboard } from '@/components/Leaderboard';
import { TeeTimes } from '@/components/TeeTimes';
import { LeagueStandings } from '@/components/LeagueStandings';
import { Archive } from '@/components/Archive';
import { TournamentsView } from '@/components/TournamentsView';
import { Admin, AdminLock } from '@/components/Admin';
import { Scorecard } from '@/components/Scorecard';
import { PlayerModal } from '@/components/PlayerModal';
import { RegisterModal } from '@/components/RegisterModal';
import { AuthModal } from '@/components/AuthModal';

function App() {
  const { store, tournaments, activeTournament, setActiveTournamentId, leaguePoints, registrations, logoUrl, currentUser, userProfile, loading, error, refresh } = useStore();
  const [view, setView] = useState<View | 'standings' | 'archive' | 'tournaments' | 'teetimes'>('wyniki');
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [modalPlayerId, setModalPlayerId] = useState<string | null>(null);
  const [selectedTournamentForRegister, setSelectedTournamentForRegister] = useState<Tournament | null>(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [authModalConfig, setAuthModalConfig] = useState<{ open: boolean; mode: 'login' | 'register' | 'forgot' | 'edit_profile' }>({ open: false, mode: 'login' });

  const openAdmin = () => setView('admin');

  const handleLogout = async () => {
    await supabase.auth.signOut();
    refresh();
  };

  const handleRegisterClick = (t: Tournament) => {
    setSelectedTournamentForRegister(t);
    setShowRegisterModal(true);
  };

  const handleRequireAuth = () => {
    alert('Aby zapisać się na turniej, musisz posiadać profil zawodnika i być zalogowanym.');
    setAuthModalConfig({ open: true, mode: 'login' });
  };

  const formatShortName = (fullName: string | undefined, fallbackEmail: string | undefined) => {
    if (!fullName) return fallbackEmail ?? 'Zawodnik';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0].toUpperCase()}. ${parts.slice(1).join(' ')}`;
    }
    return fullName;
  };

  if (loading) {
    return (
      <div className="app-shell">
        <div className="loading-screen" style={{ textAlign: 'center', padding: '60px' }}>
          <Flag size={32} />
          <p>Ładowanie systemu PFFG...</p>
        </div>
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="app-shell">
        <div className="loading-screen" style={{ textAlign: 'center', padding: '60px' }}>
          <p className="error-text">{error ?? 'Nie udało się załadować danych.'}</p>
        </div>
      </div>
    );
  }

  const sortedAll = [...store.players].sort(
    (a, b) =>
      combinedRelative(a, store.holesByRound[1], store.holesByRound[2]) -
      combinedRelative(b, store.holesByRound[1], store.holesByRound[2])
  );
  const modalPlayer = modalPlayerId
    ? store.players.find((p) => p.id === modalPlayerId) ?? null
    : null;
  const modalRank = modalPlayer
    ? sortedAll.findIndex((p) => p.id === modalPlayer.id) + 1
    : 0;

  return (
    <div className="app-shell">
      <header className="topbar" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0 }}>
        {/* GÓRNY PASEK UTILITY */}
        <div style={{ width: '100%', borderBottom: '1px solid #1e293b', background: '#0b1329', padding: '8px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button className="brand" onClick={() => setView('wyniki')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="brand-mark">
              {logoUrl ? (
                <img src={logoUrl} alt="PFFG" />
              ) : (
                <Flag size={17} fill="currentColor" />
              )}
            </span>
            <span style={{ textAlign: 'left' }}>
              <b style={{ color: '#fff', fontSize: '16px', letterSpacing: '0.02em' }}>PFFG</b>
              <small style={{ display: 'block', color: '#94a3b8', fontSize: '10px' }}>{store.tournamentName.toUpperCase()}</small>
            </span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {currentUser ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setAuthModalConfig({ open: true, mode: 'edit_profile' })}
                  title="Kliknij, aby edytować swój profil zawodnika"
                  style={{
                    background: '#172554',
                    border: '1px solid #1e40af',
                    color: '#e2e8f0',
                    borderRadius: '6px',
                    padding: '5px 12px',
                    fontSize: '12px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                  }}
                >
                  {userProfile?.avatar ? (
                    <img src={userProfile.avatar} alt="avatar" style={{ width: '18px', height: '18px', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <User size={13} className="text-sky-400" />
                  )}
                  <span>{formatShortName(userProfile?.name, currentUser.email)}</span>
                  <Edit size={11} style={{ opacity: 0.6, marginLeft: '2px' }} />
                </button>

                <button
                  onClick={handleLogout}
                  title="Wyloguj się"
                  style={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    color: '#f87171',
                    borderRadius: '6px',
                    padding: '5px 8px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <LogOut size={12} /> Wyloguj
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAuthModalConfig({ open: true, mode: 'login' })}
                style={{
                  background: '#1b88cc',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 4px rgba(27,136,204,0.3)',
                }}
              >
                <LogIn size={13} /> ZALOGUJ SIĘ
              </button>
            )}

            <button
              className="icon-button"
              onClick={openAdmin}
              title="Panel administratora"
              style={{ width: '32px', height: '32px', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <LockKeyhole size={15} />
            </button>
          </div>
        </div>

        {/* DOLNY PASEK NAWIGACJI */}
        <div style={{ width: '100%', background: '#0f172a', padding: '6px 20px', display: 'flex', alignItems: 'center' }}>
          <nav className="desktop-nav" style={{ display: 'flex', gap: '6px', width: '100%' }}>
            <Nav
              active={view === 'wyniki'}
              icon={<Trophy size={14} />}
              label="Tabela na żywo"
              onClick={() => setView('wyniki')}
            />
            <Nav
              active={view === 'teetimes'}
              icon={<Clock size={14} />}
              label="Godziny Startów"
              onClick={() => setView('teetimes')}
            />
            <Nav
              active={view === 'standings'}
              icon={<Award size={14} />}
              label="Ranking Ligi 2026"
              onClick={() => setView('standings')}
            />
            <Nav
              active={view === 'archive'}
              icon={<ArchiveIcon size={14} />}
              label="Archiwum"
              onClick={() => setView('archive')}
            />
            <Nav
              active={view === 'tournaments'}
              icon={<Calendar size={14} />}
              label="Turnieje"
              onClick={() => setView('tournaments')}
            />
          </nav>
        </div>
      </header>

      <main className="page-wrap">
        {view === 'wyniki' && (
          <Leaderboard
            store={store}
            onEnter={() => setView('karta')}
            onOpenPlayer={setModalPlayerId}
          />
        )}
        {view === 'teetimes' && (
          <TeeTimes
            store={store}
            activeTournament={activeTournament}
            onOpenPlayer={(id) => setModalPlayerId(id)}
          />
        )}
        {view === 'standings' && (
          <LeagueStandings
            store={store}
            tournaments={tournaments}
            leaguePoints={leaguePoints}
            onOpenPlayer={(id) => setModalPlayerId(id)}
          />
        )}
        {view === 'archive' && (
          <Archive
            tournaments={tournaments}
            store={store}
            onOpenPlayer={(id) => setModalPlayerId(id)}
          />
        )}
        {view === 'tournaments' && (
          <TournamentsView
            tournaments={tournaments}
            store={store}
            registrations={registrations}
            currentUser={currentUser}
            userProfile={userProfile}
            onRegisterClick={handleRegisterClick}
            onRequireAuth={handleRequireAuth}
            onOpenPlayer={(id) => setModalPlayerId(id)}
          />
        )}
        {view === 'admin' &&
          (!adminUnlocked ? (
            <AdminLock
              onUnlock={() => setAdminUnlocked(true)}
              onBack={() => setView('wyniki')}
            />
          ) : (
            <Admin
              store={store}
              tournaments={tournaments}
              activeTournament={activeTournament}
              onSelectTournament={setActiveTournamentId}
              onLock={() => setAdminUnlocked(false)}
            />
          ))}
        {view === 'karta' && (
          <Scorecard
            store={store}
            activeFlight={flight}
            setActiveFlight={setFlight}
            onBack={() => setView('wyniki')}
          />
        )}
      </main>

      <footer className="footer">
        <span>© 2026 Polska Federacja Footgolfa (PFFG)</span>
        <span>Oficjalny system scoringowy</span>
      </footer>

      {modalPlayer && (
        <PlayerModal
          player={modalPlayer}
          store={store}
          rank={modalRank}
          initialTab="scorecard"
          hideScorecardTab={false}
          tournaments={tournaments}
          leaguePoints={leaguePoints}
          onClose={() => setModalPlayerId(null)}
        />
      )}

      {showRegisterModal && (
        <RegisterModal
          tournamentId={selectedTournamentForRegister?.id}
          tournamentName={selectedTournamentForRegister?.name || store.tournamentName}
          userProfile={userProfile}
          onClose={() => {
            setShowRegisterModal(false);
            setSelectedTournamentForRegister(null);
          }}
          onRegistered={refresh}
        />
      )}

      {authModalConfig.open && (
        <AuthModal
          initialMode={authModalConfig.mode}
          currentUserProfile={userProfile}
          onClose={() => setAuthModalConfig({ open: false, mode: 'login' })}
          onSuccess={refresh}
        />
      )}
    </div>
  );
}

function Nav({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className={`nav-button ${active ? 'active' : ''}`} onClick={onClick}>
      {icon}
      {label}
    </button>
  );
}

export default App;