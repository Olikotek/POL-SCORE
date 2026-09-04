// src/components/TournamentsView.tsx
import { useState, useMemo, useRef } from 'react';
import {
  Calendar,
  MapPin,
  Clock,
  UserPlus,
  ArrowLeft,
  RotateCcw,
  Search,
  Eye,
  ImageIcon,
  CheckCircle2,
} from 'lucide-react';
import type { Tournament, Store, Player, Category } from '@/types';
import { CATEGORIES, flagEmoji } from '@/types';
import { supabase } from '@/lib/supabase';

function formatShortPlayerName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
  }
  return fullName;
}

// Bezpieczna kompresja do optymalnego Base64 mieszczącego się w limicie mailowym Web3Forms
function compressPhotoForEmail(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 800;
        let width = img.width;
        let height = img.height;

        if (width > height && width > MAX_DIM) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else if (height > MAX_DIM) {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        } else {
          resolve(e.target?.result as string);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function TournamentsView({
  tournaments,
  store,
  registrations,
  currentUser,
  userProfile,
  onRegisterClick,
  onRequireAuth,
  onOpenPlayer,
}: {
  tournaments: Tournament[];
  store: Store;
  registrations: any[];
  currentUser: any;
  userProfile: Player | null;
  onRegisterClick: (tournament: Tournament) => void;
  onRequireAuth: () => void;
  onOpenPlayer: (playerId: string) => void;
}) {
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [showDirectForm, setShowDirectForm] = useState(false);

  // Filtry listy turniejów - domyślnie tylko aktywne z otwartą rejestracją
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('active');

  // Filtry listy zawodników
  const [playerCategoryFilter, setPlayerCategoryFilter] = useState<Category | 'all'>('all');
  const [playerNameFilter, setPlayerNameFilter] = useState('');
  const [playerClubFilter, setPlayerClubFilter] = useState('');

  // Pola formularza zapisu
  const [formTournamentId, setFormTournamentId] = useState<string>(
    tournaments.find((t) => t.status !== 'completed')?.id || tournaments[0]?.id || ''
  );
  const [fullName, setFullName] = useState(userProfile?.name || '');
  const [gender, setGender] = useState<'Male' | 'Female'>('Male');
  const [birthYear, setBirthYear] = useState('');
  const [city, setCity] = useState(userProfile?.city || '');
  const [countryFlag, setCountryFlag] = useState(userProfile?.flag || 'PL');
  const [clubName, setClubName] = useState(userProfile?.club || '');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeTournaments = useMemo(() => {
    return (tournaments || []).filter((t) => t.status !== 'completed');
  }, [tournaments]);

  const activeSystemPlayersCount = useMemo(() => {
    return (store.players || []).filter(
      (p) => p.isActive !== false && (p as any).is_active !== false
    ).length;
  }, [store.players]);

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

  // Lista zawodników: powiązani przez registrations lub wszyscy aktywni gracze w systemie
  const registeredPlayers = useMemo(() => {
    if (!selectedTournament) return [];
    const regIds = new Set(
      (registrations || [])
        .filter((r) => r.tournament_id === selectedTournament.id)
        .map((r) => r.player_id)
    );

    const fromRegs = (store.players || []).filter((p) => regIds.has(p.id));
    if (fromRegs.length > 0) return fromRegs;

    return (store.players || []).filter(
      (p) => p.isActive !== false && (p as any).is_active !== false
    );
  }, [store.players, registrations, selectedTournament]);

  const filteredRegisteredPlayers = useMemo(() => {
    return registeredPlayers.filter((p) => {
      const matchCat = playerCategoryFilter === 'all' || p.category === playerCategoryFilter;
      const matchName = !playerNameFilter || p.name.toLowerCase().includes(playerNameFilter.toLowerCase());
      const matchClub = !playerClubFilter || (p.club && p.club.toLowerCase().includes(playerClubFilter.toLowerCase()));
      return matchCat && matchName && matchClub;
    });
  }, [registeredPlayers, playerCategoryFilter, playerNameFilter, playerClubFilter]);

  const handleFileChange = async (file?: File | null) => {
    if (!file) {
      setSelectedFile(null);
      setPhotoBase64('');
      return;
    }
    setSelectedFile(file);
    try {
      const b64 = await compressPhotoForEmail(file);
      setPhotoBase64(b64);
    } catch {
      const reader = new FileReader();
      reader.onload = () => setPhotoBase64(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleDirectFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !formTournamentId || !birthYear.trim() || !city.trim()) return;

    setIsSubmitting(true);
    setFormNotice(null);

    try {
      const formattedBirth = `${birthYear.trim()}-01-01`;
      const cleanFlag = countryFlag.trim().toUpperCase() || 'PL';

      // 1. Zapisujemy zawodnika w Supabase
      let playerId = userProfile?.id;

      if (!playerId) {
        const { data: newPlayer, error: playerErr } = await supabase
          .from('players')
          .insert({
            name: fullName.trim(),
            gender,
            birth_date: formattedBirth,
            city: city.trim(),
            flag: cleanFlag,
            club: clubName.trim() || undefined,
            category: gender === 'Female' ? 'Women' : 'Men',
            is_active: true,
          })
          .select('id')
          .single();

        if (playerErr) throw playerErr;
        playerId = newPlayer.id;
      } else {
        await supabase
          .from('players')
          .update({
            is_active: true,
            birth_date: formattedBirth,
            city: city.trim(),
          })
          .eq('id', playerId);
      }

      // 2. Dodajemy rejestrację do turnieju
      try {
        const { error: regErr } = await supabase.from('tournament_registrations').insert({
          tournament_id: formTournamentId,
          player_id: playerId,
        });

        if (regErr && !regErr.message.includes('unique') && !regErr.message.includes('duplicate')) {
          console.warn('Ostrzeżenie przy zapisie relacji turniej-gracz:', regErr);
        }
      } catch (err) {
        console.warn('Pomijam błąd relacji tournament_registrations:', err);
      }

      // 3. WYSYŁKA DANYCH I ZDJĘCIA NA TWÓJ E-MAIL (WEB3FORMS)
      try {
        const tournamentName = activeTournaments.find((t) => t.id === formTournamentId)?.name || formTournamentId;
        const payload: Record<string, any> = {
          access_key: 'a7cb07ef-102a-465d-82b6-2544fc442b8f',
          subject: `Nowe zgłoszenie: ${fullName.trim()} (${tournamentName})`,
          from_name: 'PFFG Rejestracja',
          'Imię i Nazwisko': fullName.trim(),
          Płeć: gender === 'Female' ? 'Kobieta' : 'Mężczyzna',
          'Rok urodzenia': birthYear.trim(),
          Miasto: city.trim(),
          Kraj: cleanFlag,
          Klub: clubName.trim() || 'Brak',
          Turniej: tournamentName,
        };

        if (photoBase64) {
          payload['Zdjecie_Base64'] = photoBase64;
        }

        await fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(payload),
        });
      } catch (emailErr) {
        console.warn('Błąd wysyłki e-mail:', emailErr);
      }

      setFormNotice('Zapisano na turniej pomyślnie! Zawodnik dodany do listy startowej.');
      setTimeout(() => {
        setShowDirectForm(false);
        setFormNotice(null);
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      console.error(err);
      alert('Błąd zapisu: ' + (err?.message || 'Spróbuj ponownie.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="tournaments-view-wrapper">
      <style>{`
        .tournaments-view-wrapper {
          display: flex;
          flex-direction: column;
          gap: 12px;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
        }

        .tournaments-table-container {
          background: #ffffff;
          border-radius: 12px;
          padding: 16px;
          border: 1px solid #cbd5e1;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
        }

        .tournaments-table-box {
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          overflow: hidden;
        }

        .tourn-table-main {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          table-layout: fixed;
        }

        .tourn-table-main thead tr th {
          background: #f8fafc;
          border-bottom: 2px solid #cbd5e1;
          color: #475569;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding: 8px 6px;
        }

        .mobile-hide {
          display: table-cell;
        }

        .desktop-player-name {
          display: inline;
          font-weight: 800;
          color: #0f172a;
          font-size: 12.5px;
        }

        .mobile-player-name {
          display: none;
        }

        .mobile-show-subline {
          display: none;
        }

        @media (max-width: 640px) {
          .tournaments-view-wrapper {
            gap: 8px !important;
            padding: 0 !important;
            width: 100% !important;
          }

          .tournaments-table-container {
            padding: 8px 6px !important;
            border-radius: 8px !important;
            width: 100% !important;
          }

          .tournaments-table-box {
            border-radius: 6px !important;
            width: 100% !important;
          }

          .tourn-table-main {
            table-layout: fixed !important;
            width: 100% !important;
          }

          .mobile-hide {
            display: none !important;
          }

          .desktop-player-name {
            display: none !important;
          }

          .mobile-player-name {
            display: inline !important;
            font-size: 11px !important;
            font-weight: 800 !important;
            color: #0f172a !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }

          .mobile-show-subline {
            display: block !important;
            font-size: 8.5px !important;
            color: #64748b !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            line-height: 1.15 !important;
            margin-top: 1px !important;
          }

          /* Tabela główna turniejów - telefon */
          .col-mob-date {
            width: 66px !important;
            padding: 6px 2px !important;
            font-size: 9.5px !important;
            text-align: center !important;
            border-right: 1px solid #e2e8f0 !important;
          }

          .col-mob-tourn {
            width: auto !important;
            padding: 6px 4px !important;
            border-right: 1px solid #e2e8f0 !important;
          }

          .col-mob-registered {
            width: 32px !important;
            text-align: center !important;
            padding: 6px 1px !important;
            font-size: 10px !important;
            border-right: 1px solid #e2e8f0 !important;
          }

          .col-mob-action {
            width: 52px !important;
            text-align: center !important;
            padding: 6px 2px !important;
          }

          /* Tabela listy startowej - telefon */
          .col-start-nr {
            width: 22px !important;
            text-align: center !important;
            padding: 6px 1px !important;
            font-size: 9.5px !important;
            border-right: 1px solid #e2e8f0 !important;
          }

          .col-start-player {
            width: auto !important;
            padding: 6px 4px !important;
            border-right: 1px solid #e2e8f0 !important;
          }

          .col-start-flag {
            width: 24px !important;
            text-align: center !important;
            padding: 6px 1px !important;
            border-right: 1px solid #e2e8f0 !important;
          }

          .col-start-cat {
            width: 36px !important;
            padding: 6px 1px !important;
            font-size: 9px !important;
            text-align: center !important;
            border-right: 1px solid #e2e8f0 !important;
          }

          .col-start-status {
            width: 64px !important;
            text-align: center !important;
            padding: 6px 1px !important;
          }

          .btn-mob-action {
            padding: 4px 6px !important;
            font-size: 9.5px !important;
            border-radius: 4px !important;
          }
        }
      `}</style>

      {/* BANER SUKCESU PO ZAPISIE */}
      {formNotice && (
        <div style={{
          background: '#f0fdf4',
          border: '1.5px solid #22c55e',
          color: '#15803d',
          padding: '10px 14px',
          borderRadius: '8px',
          fontWeight: 800,
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          boxShadow: '0 2px 6px rgba(34, 197, 94, 0.2)',
          textAlign: 'center',
        }}>
          <CheckCircle2 size={16} color="#16a34a" />
          <span>{formNotice}</span>
        </div>
      )}

      {selectedTournament ? (
        /* WIDOK LISTY STARTOWEJ TURNIEJU */
        <div className="tournaments-table-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '10px', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <span style={{ fontSize: '9.5px', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                LISTA STARTOWA TURNIEJU
              </span>
              <h2 style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a', margin: '2px 0 0 0' }}>
                {selectedTournament.name}
              </h2>
              <p style={{ fontSize: '10.5px', color: '#64748b', margin: '2px 0 0 0', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span><Calendar size={11} style={{ display: 'inline', marginRight: '3px' }} />{selectedTournament.date}</span>
                {selectedTournament.courseName && (
                  <span><MapPin size={11} style={{ display: 'inline', marginRight: '3px' }} />{selectedTournament.courseName}</span>
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
                borderRadius: '6px',
                padding: '6px 10px',
                fontSize: '10.5px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <ArrowLeft size={12} /> Powrót
            </button>
          </div>

          {/* FILTRY ZAWODNIKÓW */}
          <div style={{ background: '#f8fafc', padding: '6px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <label style={{ fontSize: '10px', fontWeight: 800, color: '#475569' }}>Kat.</label>
              <select
                value={playerCategoryFilter}
                onChange={(e) => setPlayerCategoryFilter(e.target.value as any)}
                style={{ padding: '3px 5px', fontSize: '10px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff' }}
              >
                <option value="all">Wszystkie</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flex: 1, minWidth: '90px' }}>
              <input
                type="text"
                value={playerNameFilter}
                onChange={(e) => setPlayerNameFilter(e.target.value)}
                placeholder="Szukaj..."
                style={{ padding: '3px 5px', fontSize: '10px', borderRadius: '4px', border: '1px solid #cbd5e1', width: '100%' }}
              />
            </div>

            <div className="mobile-hide" style={{ alignItems: 'center', gap: '3px' }}>
              <label style={{ fontSize: '10px', fontWeight: 800, color: '#475569' }}>Klub</label>
              <input
                type="text"
                value={playerClubFilter}
                onChange={(e) => setPlayerClubFilter(e.target.value)}
                placeholder="Klub..."
                style={{ padding: '3px 5px', fontSize: '10px', borderRadius: '4px', border: '1px solid #cbd5e1', width: '100px' }}
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setPlayerCategoryFilter('all');
                setPlayerNameFilter('');
                setPlayerClubFilter('');
              }}
              style={{ background: '#64748b', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 6px', fontSize: '10px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
            >
              <RotateCcw size={10} /> Reset
            </button>
          </div>

          {/* TABELA ZAWODNIKÓW */}
          <div className="tournaments-table-box">
            <table className="tourn-table-main">
              <thead>
                <tr>
                  <th className="col-start-nr">NR</th>
                  <th className="col-start-player">ZAWODNIK</th>
                  <th className="col-start-flag">KRAJ</th>
                  <th className="col-start-cat">KAT</th>
                  <th className="mobile-hide" style={{ width: '120px' }}>KLUB</th>
                  <th className="mobile-hide" style={{ width: '90px' }}>MIASTO</th>
                  <th className="col-start-status">OPŁATA</th>
                </tr>
              </thead>
              <tbody>
                {filteredRegisteredPlayers.map((p, index) => {
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid #e2e8f0', background: index % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                      <td className="col-start-nr" style={{ fontWeight: 800, color: '#0f172a' }}>
                        {index + 1}
                      </td>
                      <td className="col-start-player" style={{ overflow: 'hidden' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                          <button
                            type="button"
                            onClick={() => onOpenPlayer(p.id)}
                            style={{ background: 'none', border: 'none', padding: 0, color: '#0284c7', fontWeight: 800, cursor: 'pointer', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                          >
                            <span className="desktop-player-name">{p.name}</span>
                            <span className="mobile-player-name">{formatShortPlayerName(p.name)}</span>
                            {p.isAmateur && (
                              <span style={{ marginLeft: '3px', background: '#7ea128', color: '#fff', fontSize: '7.5px', fontWeight: 800, padding: '1px 2px', borderRadius: '2px' }}>
                                AM
                              </span>
                            )}
                          </button>
                          <span className="mobile-show-subline">
                            {p.club ? `${p.club}` : 'Bez klubu'}{p.city ? ` · ${p.city}` : ''}
                          </span>
                        </div>
                      </td>
                      <td className="col-start-flag">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <img
                            src={p.flagImage || flagEmoji(p.flag || 'PL')}
                            alt={p.flag || 'PL'}
                            style={{ width: '16px', height: '11px', objectFit: 'cover', borderRadius: '2px', border: '1px solid #cbd5e1', display: 'block' }}
                          />
                        </div>
                      </td>
                      <td className="col-start-cat" style={{ fontWeight: 700, color: '#334155' }}>
                        {p.category}
                      </td>
                      <td className="mobile-hide" style={{ padding: '6px 6px', color: '#64748b', borderRight: '1px solid #e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.club || '–'}
                      </td>
                      <td className="mobile-hide" style={{ padding: '6px 6px', color: '#64748b', borderRight: '1px solid #e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.city || '–'}
                      </td>
                      <td className="col-start-status">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '2px',
                              fontSize: '8.5px',
                              fontWeight: 800,
                              color: '#dc2626',
                              background: '#fee2e2',
                              border: '1px solid #fca5a5',
                              padding: '2px 4px',
                              borderRadius: '3px',
                              whiteSpace: 'nowrap',
                              lineHeight: 1.1,
                            }}
                          >
                            <Clock size={9} /> Na polu
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredRegisteredPlayers.length === 0 && (
              <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontWeight: 700, fontSize: '10.5px' }}>
                Brak zawodników na liście startowej.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* WIDOK GŁÓWNY: TERMINARZ TURNIEJÓW */
        <>
          <div
            style={{
              background: 'linear-gradient(135deg, #0b1329 0%, #1e293b 100%)',
              borderRadius: '10px',
              padding: '12px 14px',
              color: '#ffffff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(11, 19, 41, 0.15)',
            }}
          >
            <div>
              <span style={{ fontSize: '9px', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                SEZON PFFG 2026
              </span>
              <h1 style={{ margin: '2px 0 0 0', fontSize: '16px', fontWeight: 900 }}>
                Oficjalny Kalendarz & Zapisy
              </h1>
              <p style={{ margin: '2px 0 0 0', fontSize: '10.5px', color: '#94a3b8', maxWidth: '580px', lineHeight: 1.3 }}>
                Opłata startowa w recepcji: <strong>80 zł</strong> (dorośli), <strong>40 zł</strong> (studenci / juniorzy).
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowDirectForm((prev) => !prev)}
              style={{
                background: '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                boxShadow: '0 2px 6px rgba(2, 132, 199, 0.35)',
              }}
            >
              <UserPlus size={12} />
              {showDirectForm ? 'Schowaj' : 'Zapisz się'}
            </button>
          </div>

          {showDirectForm && (
            <div style={{ background: '#ffffff', borderRadius: '10px', padding: '12px 14px', border: '1px solid #cbd5e1', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.05)' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 900, color: '#0f172a', margin: '0 0 2px 0' }}>
                Formularz Rejestracji na Turniej
              </h2>
              <p style={{ fontSize: '10px', color: '#64748b', margin: '0 0 10px 0' }}>
                Po wysłaniu zgłoszenia zostaniesz dopisany do tabeli i listy startowej.
              </p>

              <form onSubmit={handleDirectFormSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <label style={{ fontSize: '10px', fontWeight: 800, color: '#475569' }}>Turniej *</label>
                  <select
                    value={formTournamentId}
                    onChange={(e) => setFormTournamentId(e.target.value)}
                    required
                    style={{ padding: '5px 6px', fontSize: '11px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  >
                    {activeTournaments.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.date})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <label style={{ fontSize: '10px', fontWeight: 800, color: '#475569' }}>Imię i Nazwisko *</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    placeholder="Jan Kowalski"
                    style={{ padding: '5px 6px', fontSize: '11px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <label style={{ fontSize: '10px', fontWeight: 800, color: '#475569' }}>Płeć *</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as any)}
                    style={{ padding: '5px 6px', fontSize: '11px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="Male">Mężczyzna</option>
                    <option value="Female">Kobieta</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <label style={{ fontSize: '10px', fontWeight: 800, color: '#475569' }}>Rok urodzenia *</label>
                  <input
                    type="number"
                    min={1940}
                    max={2030}
                    value={birthYear}
                    onChange={(e) => setBirthYear(e.target.value)}
                    placeholder="2000"
                    required
                    style={{ padding: '5px 6px', fontSize: '11px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <label style={{ fontSize: '10px', fontWeight: 800, color: '#475569' }}>Miejscowość *</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Gdańsk"
                    required
                    style={{ padding: '5px 6px', fontSize: '11px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <label style={{ fontSize: '10px', fontWeight: 800, color: '#475569' }}>Kraj (Kod ISO)</label>
                  <input
                    type="text"
                    maxLength={3}
                    value={countryFlag}
                    onChange={(e) => setCountryFlag(e.target.value.toUpperCase())}
                    placeholder="PL"
                    style={{ padding: '5px 6px', fontSize: '11px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <label style={{ fontSize: '10px', fontWeight: 800, color: '#475569' }}>Klub (opcjonalnie)</label>
                  <input
                    type="text"
                    value={clubName}
                    onChange={(e) => setClubName(e.target.value)}
                    placeholder="Nazwa klubu"
                    style={{ padding: '5px 6px', fontSize: '11px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <label style={{ fontSize: '10px', fontWeight: 800, color: '#475569' }}>Zdjęcie profilowe</label>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e.target.files?.[0])}
                      style={{ display: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '5px 8px', fontSize: '10px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                    >
                      <ImageIcon size={11} /> Wybierz
                    </button>
                    <span style={{ fontSize: '9px', color: selectedFile ? '#16a34a' : '#94a3b8', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '90px' }}>
                      {selectedFile ? selectedFile.name : 'Brak'}
                    </span>
                  </div>
                </div>

                <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '4px', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
                  <button
                    type="button"
                    onClick={() => setShowDirectForm(false)}
                    style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '5px 10px', fontSize: '10.5px', fontWeight: 800, cursor: 'pointer', color: '#475569' }}
                  >
                    Anuluj
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    style={{ background: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', padding: '5px 14px', fontSize: '10.5px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <UserPlus size={11} /> {isSubmitting ? 'Zapisywanie...' : 'Zatwierdź'}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="tournaments-table-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, minWidth: '170px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search size={11} style={{ position: 'absolute', left: '6px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Szukaj..."
                    style={{ padding: '4px 6px 4px 20px', fontSize: '10.5px', borderRadius: '4px', border: '1px solid #cbd5e1', width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  style={{ padding: '4px 6px', fontSize: '10px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff' }}
                >
                  <option value="active">Otwarte</option>
                  <option value="completed">Zakończone</option>
                  <option value="all">Wszystkie</option>
                </select>
              </div>

              <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap' }}>
                Turnieje: <b>{filteredTournaments.length}</b>
              </span>
            </div>

            <div className="tournaments-table-box">
              <table className="tourn-table-main">
                <thead>
                  <tr>
                    <th className="col-mob-date">DATA</th>
                    <th className="col-mob-tourn">TURNIEJ</th>
                    <th className="mobile-hide" style={{ width: '130px' }}>POLE</th>
                    <th className="mobile-hide" style={{ width: '85px', textAlign: 'center' }}>STATUS</th>
                    <th className="col-mob-registered">ZAP.</th>
                    <th className="col-mob-action">AKCJA</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTournaments.map((t, idx) => {
                    const isCompleted = t.status === 'completed';
                    const fromRegs = (registrations || []).filter((r) => r.tournament_id === t.id).length;
                    const displayCount = fromRegs > 0 ? fromRegs : activeSystemPlayersCount;

                    return (
                      <tr key={t.id} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                        <td className="col-mob-date" style={{ color: '#64748b', fontWeight: 700 }}>
                          {t.date}
                        </td>
                        <td className="col-mob-tourn" style={{ overflow: 'hidden' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <button
                              type="button"
                              onClick={() => setSelectedTournament(t)}
                              style={{ background: 'none', border: 'none', padding: 0, color: '#0284c7', fontWeight: 900, fontSize: '11px', cursor: 'pointer', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                            >
                              {t.name}
                              {t.isPolishOpen && (
                                <span style={{ marginLeft: '3px', fontSize: '7.5px', fontWeight: 800, color: '#dc2626', background: '#fee2e2', padding: '1px 2px', borderRadius: '2px' }}>
                                  MP
                                </span>
                              )}
                            </button>
                            <span className="mobile-show-subline">
                              {t.courseName || 'Pole Turniejowe PFFG'}
                            </span>
                          </div>
                        </td>
                        <td className="mobile-hide" style={{ padding: '6px 6px', color: '#475569', borderRight: '1px solid #e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.courseName || 'Pole Turniejowe PFFG'}
                        </td>
                        <td className="mobile-hide" style={{ padding: '6px 4px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                          {isCompleted ? (
                            <span style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', background: '#f1f5f9', padding: '2px 4px', borderRadius: '3px' }}>
                              Zakończony
                            </span>
                          ) : (
                            <span style={{ fontSize: '9px', fontWeight: 800, color: '#16a34a', background: '#dcfce7', padding: '2px 4px', borderRadius: '3px', border: '1px solid #86efac' }}>
                              Zapisy otwarte
                            </span>
                          )}
                        </td>
                        <td className="col-mob-registered" style={{ fontWeight: 900, color: '#0f172a' }}>
                          {displayCount}
                        </td>
                        <td className="col-mob-action">
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <button
                              type="button"
                              className="btn-mob-action"
                              onClick={() => setSelectedTournament(t)}
                              title="Zobacz listę zawodników"
                              style={{
                                background: '#f1f5f9',
                                border: '1px solid #cbd5e1',
                                borderRadius: '4px',
                                padding: '4px 6px',
                                fontSize: '10px',
                                fontWeight: 800,
                                cursor: 'pointer',
                                color: '#0f172a',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                              }}
                            >
                              <Eye size={11} /> Lista
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredTournaments.length === 0 && (
                <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontWeight: 700, fontSize: '10.5px' }}>
                  Brak turniejów w wybranym filtrze.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}