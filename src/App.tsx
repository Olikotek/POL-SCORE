// src/App.tsx
import { useState } from 'react';
import { Flag, LockKeyhole, Trophy, Calendar, Archive as ArchiveIcon, Award, User, LogIn, LogOut, Clock } from 'lucide-react';
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
  const { store, tournaments, activeTournament, setActiveTournamentId, leaguePoints, registrations, currentUser, userProfile, loading, error, refresh } = useStore();
  const [view, setView] = useState<View | 'standings' | 'archive' | 'tournaments' | 'teetimes'>('wyniki');
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [modalPlayerId, setModalPlayerId] = useState<string | null>(null);
  const [selectedTournamentForRegister, setSelectedTournamentForRegister] = useState<Tournament | null>(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [authModalConfig, setAuthModalConfig] = useState<{ open: boolean; mode: 'login' | 'register' | 'forgot' | 'edit_profile' }>({ open: false, mode: 'login' });

  const openAdmin = () => setView('admin');

  const handleGoToLeaderboard = () => {
    setView('wyniki');
    refresh();
  };

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
        <div className="loading-screen">
          <Flag size={32} />
          <p>Ładowanie systemu PFFG...</p>
        </div>
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="app-shell">
        <div className="loading-screen">
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
      <style>{`
        .topbar {
          background: #0b1329;
          border-bottom: 1px solid #1e293b;
          width: 100%;
        }
        .topbar-utility {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }
        .topbar-nav-bar {
          width: 100%;
          padding: 6px 12px;
          box-sizing: border-box;
        }
        .desktop-nav {
          display: grid !important;
          grid-template-columns: repeat(5, 1fr) !important;
          gap: 6px !important;
          width: 100% !important;
          margin: 0 !important;
        }
        .nav-button {
          width: 100% !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 6px !important;
          padding: 8px 4px !important;
          border-radius: 8px !important;
          border: 1px solid transparent !important;
          background: #131d38 !important;
          color: #94a3b8 !important;
          font-size: 12px !important;
          font-weight: 800 !important;
          cursor: pointer !important;
          white-space: nowrap !important;
          transition: all 0.15s ease !important;
        }
        .nav-button:hover {
          color: #ffffff !important;
          background: #1e293b !important;
        }
        .nav-button.active {
          background: #0284c7 !important;
          color: #ffffff !important;
          border-color: #38bdf8 !important;
          box-shadow: 0 2px 6px rgba(2, 132, 199, 0.4) !important;
        }

        @media (max-width: 640px) {
          .topbar-utility {
            padding: 6px 10px !important;
          }
          .topbar-nav-bar {
            padding: 4px 6px !important;
          }
          .desktop-nav {
            grid-template-columns: repeat(5, 1fr) !important;
            gap: 3px !important;
          }
          .nav-button {
            padding: 6px 2px !important;
            font-size: 9.5px !important;
            border-radius: 6px !important;
            letter-spacing: -0.02em !important;
          }
          .nav-button svg {
            display: none !important;
          }
        }
      `}</style>

      <header className="topbar">
        {/* GÓRNY PASEK UTILITY */}
        <div className="topbar-utility">
          <button className="brand" onClick={handleGoToLeaderboard} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
            <img
              src="/pffg-logo.jpg"
              alt="PFFG Logo"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                objectFit: 'contain',
                background: '#ffffff',
                border: '1px solid rgba(255,255,255,0.15)',
                padding: '2px',
                display: 'block',
              }}
            />
            <span style={{ textAlign: 'left', display: 'flex', flexDirection: 'column' }}>
              <b style={{ color: '#ffffff', fontSize: '15px', fontWeight: 900, lineHeight: 1.1, letterSpacing: '0.04em' }}>PFFG</b>
              <small style={{ color: '#38bdf8', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {store.tournamentName.toUpperCase()}
              </small>
            </span>
          </button>

          <div className="top-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                    padding: '5px 10px',
                    fontSize: '11px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    maxWidth: '140px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                  }}
                >
                  {userProfile?.avatar ? (
                    <img src={userProfile.avatar} alt="avatar" style={{ width: '16px', height: '16px', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <User size={12} className="text-sky-400" />
                  )}
                  <span>{formatShortName(userProfile?.name, currentUser.email)}</span>
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
                  }}
                >
                  <LogOut size={12} />
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
                  padding: '5px 10px',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <LogIn size={12} /> ZALOGUJ
              </button>
            )}

            <button
              className="icon-button"
              onClick={openAdmin}
              title="Panel administratora"
              style={{
                background: '#1e293b',
                border: '1px solid #334155',
                color: '#94a3b8',
                borderRadius: '6px',
                padding: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <LockKeyhole size={14} />
            </button>
          </div>
        </div>

        {/* POZIOMY PASEK ZAKŁADEK */}
        <div className="topbar-nav-bar">
          <nav className="desktop-nav">
            <Nav
              active={view === 'wyniki'}
              icon={<Trophy size={14} />}
              label="Tabela na żywo"
              onClick={handleGoToLeaderboard}
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
            onRefresh={refresh}
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
          adminUnlocked ? (
            <LeagueStandings
              store={store}
              tournaments={tournaments}
              leaguePoints={leaguePoints}
              onOpenPlayer={(id) => setModalPlayerId(id)}
            />
          ) : (
            <div style={{ background: '#ffffff', borderRadius: '12px', padding: '48px 24px', textAlign: 'center', border: '1px solid #cbd5e1', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.04)' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto', color: '#64748b' }}>
                <Award size={24} />
              </div>
              <h2 style={{ color: '#0f172a', fontWeight: 900, margin: '0 0 6px 0', fontSize: '20px' }}>Przerwa techniczna</h2>
              <p style={{ color: '#64748b', fontSize: '13px', margin: 0, maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
                Oficjalna klasyfikacja ligowa jest tymczasowo wstrzymana ze względu na prace konserwacyjne. Zapraszamy wkrótce!
              </p>
            </div>
          )
        )}
        {view === 'archive' && (
          adminUnlocked ? (
            <Archive
              tournaments={tournaments}
              store={store}
              onOpenPlayer={(id) => setModalPlayerId(id)}
            />
          ) : (
            <div style={{ background: '#ffffff', borderRadius: '12px', padding: '48px 24px', textAlign: 'center', border: '1px solid #cbd5e1', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.04)' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto', color: '#64748b' }}>
                <ArchiveIcon size={24} />
              </div>
              <h2 style={{ color: '#0f172a', fontWeight: 900, margin: '0 0 6px 0', fontSize: '20px' }}>Przerwa techniczna</h2>
              <p style={{ color: '#64748b', fontSize: '13px', margin: 0, maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
                Archiwum wyników jest tymczasowo niedostępne dla użytkowników. Zapraszamy wkrótce!
              </p>
            </div>
          )
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
            onBack={handleGoToLeaderboard}
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
      <span>{label}</span>
    </button>
  );
}

export default App;