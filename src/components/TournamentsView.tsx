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
} from 'lucide-react';
import type { Tournament, Store, Player, Category } from '@/types';
import { CATEGORIES, flagEmoji } from '@/types';
import { supabase } from '@/lib/supabase';

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

  const handleDirectFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !formTournamentId || !birthYear.trim() || !city.trim()) return;

    setIsSubmitting(true);
    setFormNotice(null);

    try {
      const formattedBirth = `${birthYear.trim()}-01-01`;
      const cleanFlag = countryFlag.trim().toUpperCase() || 'PL';

      // 1. Zapisujemy zawodnika w Supabase – wyłącznie dane tekstowe
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

      // 2. Dodajemy rejestrację do turnieju (bez kolumny status)
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
        const emailFormData = new FormData();
        emailFormData.append('access_key', 'a7cb07ef-102a-465d-82b6-2544fc442b8f');
        emailFormData.append('subject', `Nowe zgłoszenie: ${fullName.trim()} (${tournamentName})`);
        emailFormData.append('from_name', 'PFFG Rejestracja');
        emailFormData.append('Zawodnik', fullName.trim());
        emailFormData.append('Płeć', gender === 'Female' ? 'Kobieta' : 'Mężczyzna');
        emailFormData.append('Rok urodzenia', birthYear.trim());
        emailFormData.append('Miasto', city.trim());
        emailFormData.append('Kraj', cleanFlag);
        emailFormData.append('Klub', clubName.trim() || 'Brak');
        emailFormData.append('Turniej', tournamentName);

        if (selectedFile) {
          emailFormData.append('attachment', selectedFile);
        }

        await fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          body: emailFormData,
        });
      } catch (emailErr) {
        console.warn('Błąd wysyłki e-mail:', emailErr);
      }

      setFormNotice('Zapisano pomyślnie! Zawodnik trafił do turnieju.');
      setTimeout(() => {
        setShowDirectForm(false);
        setFormNotice(null);
        window.location.reload();
      }, 1200);
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
          gap: 16px;
          width: 100%;
          box-sizing: border-box;
        }

        .tournaments-table-container {
          background: #ffffff;
          border-radius: 12px;
          padding: 20px;
          border: 1px solid #cbd5e1;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);
          width: 100%;
          box-sizing: border-box;
        }

        .tournaments-table-box {
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          width: 100%;
          overflow-x: auto;
          box-sizing: border-box;
        }

        .tourn-table-main {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          text-align: left;
        }

        .tourn-table-main thead tr {
          background: #f8fafc;
          border-bottom: 2px solid #cbd5e1;
          color: #475569;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .mobile-hide {
          display: table-cell;
        }

        .mobile-show-subline {
          display: none;
        }

        @media (max-width: 640px) {
          .tournaments-view-wrapper {
            gap: 10px !important;
          }

          .tournaments-table-container {
            padding: 10px 8px !important;
            border-radius: 8px !important;
          }

          .tournaments-table-box {
            border-radius: 6px !important;
            overflow-x: hidden !important;
            width: 100% !important;
          }

          .tourn-table-main {
            table-layout: fixed !important;
            width: 100% !important;
            font-size: 12px !important;
          }

          .mobile-hide {
            display: none !important;
          }

          .mobile-show-subline {
            display: block !important;
            font-size: 10px !important;
            color: #64748b !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            margin-top: 1px !important;
          }

          .col-mob-date {
            width: 68px !important;
            padding: 8px 4px !important;
            font-size: 11px !important;
          }

          .col-mob-tourn {
            width: auto !important;
            padding: 8px 6px !important;
            overflow: hidden !important;
          }

          .col-mob-registered {
            width: 44px !important;
            text-align: center !important;
            padding: 8px 2px !important;
            font-size: 11px !important;
          }

          .col-mob-action {
            width: 78px !important;
            text-align: center !important;
            padding: 8px 4px !important;
          }

          /* Tabela listy startowej zawodników na mobile */
          .col-mob-nr {
            width: 28px !important;
            text-align: center !important;
            padding: 8px 2px !important;
          }

          .col-mob-player {
            width: auto !important;
            padding: 8px 4px !important;
            overflow: hidden !important;
          }

          .col-mob-flag {
            width: 26px !important;
            text-align: center !important;
            padding: 8px 2px !important;
          }

          .col-mob-cat {
            width: 48px !important;
            padding: 8px 2px !important;
            font-size: 10px !important;
          }

          .col-mob-status {
            width: 82px !important;
            text-align: center !important;
            padding: 8px 2px !important;
          }

          .btn-mob-action {
            padding: 4px 6px !important;
            font-size: 10px !important;
            border-radius: 4px !important;
          }
        }
      `}</style>

      {selectedTournament ? (
        /* WIDOK LISTY STARTOWEJ TURNIEJU */
        <div className="tournaments-table-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '14px', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                LISTA STARTOWA TURNIEJU
              </span>
              <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', margin: '2px 0 0 0' }}>
                {selectedTournament.name}
              </h2>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                padding: '8px 14px',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <ArrowLeft size={14} /> Wróć do listy turniejów
            </button>
          </div>

          <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569' }}>Kategoria</label>
              <select
                value={playerCategoryFilter}
                onChange={(e) => setPlayerCategoryFilter(e.target.value as any)}
                style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
              >
                <option value="all">Wszystkie</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569' }}>Zawodnik</label>
              <input
                type="text"
                value={playerNameFilter}
                onChange={(e) => setPlayerNameFilter(e.target.value)}
                placeholder="Szukaj..."
                style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '6px', border: '1px solid #cbd5e1', width: '120px' }}
              />
            </div>

            <div className="mobile-hide" style={{ alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569' }}>Klub</label>
              <input
                type="text"
                value={playerClubFilter}
                onChange={(e) => setPlayerClubFilter(e.target.value)}
                placeholder="Nazwa klubu..."
                style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '6px', border: '1px solid #cbd5e1', width: '120px' }}
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setPlayerCategoryFilter('all');
                setPlayerNameFilter('');
                setPlayerClubFilter('');
              }}
              style={{ background: '#64748b', color: '#fff', border: 'none', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <RotateCcw size={11} /> Resetuj
            </button>
          </div>

          <div className="tournaments-table-box">
            <table className="tourn-table-main">
              <thead>
                <tr>
                  <th className="col-mob-nr" style={{ padding: '8px 6px', width: '40px', textAlign: 'center' }}>Nr</th>
                  <th className="col-mob-player" style={{ padding: '8px 10px' }}>Zawodnik</th>
                  <th className="col-mob-flag" style={{ padding: '8px 4px', textAlign: 'center', width: '36px' }}>Kraj</th>
                  <th className="col-mob-cat" style={{ padding: '8px 6px', width: '80px' }}>Kategoria</th>
                  <th className="mobile-hide" style={{ padding: '8px 10px' }}>Klub</th>
                  <th className="mobile-hide" style={{ padding: '8px 10px' }}>Miasto</th>
                  <th className="col-mob-status" style={{ padding: '8px 6px', textAlign: 'center', width: '120px' }}>Status opłaty</th>
                </tr>
              </thead>
              <tbody>
                {filteredRegisteredPlayers.map((p, index) => {
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9', background: index % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                      <td className="col-mob-nr" style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 800, color: '#64748b' }}>
                        {index + 1}
                      </td>
                      <td className="col-mob-player" style={{ padding: '8px 10px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <button
                            type="button"
                            onClick={() => onOpenPlayer(p.id)}
                            style={{ background: 'none', border: 'none', padding: 0, color: '#0284c7', fontWeight: 800, fontSize: '12px', cursor: 'pointer', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                          >
                            {p.name}
                            {p.isAmateur && (
                              <span style={{ marginLeft: '4px', background: '#7ea128', color: '#fff', fontSize: '8px', fontWeight: 800, padding: '1px 3px', borderRadius: '3px' }}>
                                AM
                              </span>
                            )}
                          </button>
                          <span className="mobile-show-subline">
                            {p.club ? `${p.club}` : 'Bez klubu'}{p.city ? ` · ${p.city}` : ''}
                          </span>
                        </div>
                      </td>
                      <td className="col-mob-flag" style={{ padding: '8px 4px', textAlign: 'center' }}>
                        <img
                          src={p.flagImage || flagEmoji(p.flag || 'PL')}
                          alt={p.flag || 'PL'}
                          style={{ width: '18px', height: '12px', objectFit: 'cover', borderRadius: '2px', border: '1px solid #cbd5e1', display: 'inline-block' }}
                        />
                      </td>
                      <td className="col-mob-cat" style={{ padding: '8px 6px', fontWeight: 700, color: '#334155' }}>
                        {p.category}
                      </td>
                      <td className="mobile-hide" style={{ padding: '8px 10px', color: '#64748b' }}>
                        {p.club || '–'}
                      </td>
                      <td className="mobile-hide" style={{ padding: '8px 10px', color: '#64748b' }}>
                        {p.city || '–'}
                      </td>
                      <td className="col-mob-status" style={{ padding: '8px 4px', textAlign: 'center' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '3px',
                            fontSize: '10px',
                            fontWeight: 800,
                            color: '#dc2626',
                            background: '#fee2e2',
                            border: '1px solid #fca5a5',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <Clock size={11} /> Opłata na polu
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredRegisteredPlayers.length === 0 && (
              <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontWeight: 700, fontSize: '12px' }}>
                Brak zawodników na liście startowej.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* WIDOK GŁÓWNY: KALENDARZ & LISTA TURNIEJÓW */
        <>
          <div
            style={{
              background: 'linear-gradient(135deg, #0b1329 0%, #1e293b 100%)',
              borderRadius: '12px',
              padding: '16px 20px',
              color: '#ffffff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              boxShadow: '0 4px 12px rgba(11, 19, 41, 0.15)',
            }}
          >
            <div>
              <span style={{ fontSize: '10px', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                SEZON PFFG 2026
              </span>
              <h1 style={{ margin: '2px 0 0 0', fontSize: '20px', fontWeight: 900 }}>
                Oficjalny Kalendarz & Zapisy
              </h1>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8', maxWidth: '580px', lineHeight: 1.4 }}>
                Opłata startowa uiszczana w dniu turnieju w recepcji: <strong>80 zł</strong> (dorośli), <strong>40 zł</strong> (studenci / niepełnoletni).
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowDirectForm((prev) => !prev)}
              style={{
                background: '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(2, 132, 199, 0.4)',
              }}
            >
              <UserPlus size={14} />
              {showDirectForm ? 'Schowaj formularz' : 'Zapisz się na turniej'}
            </button>
          </div>

          {showDirectForm && (
            <div style={{ background: '#ffffff', borderRadius: '12px', padding: '16px 20px', border: '1px solid #cbd5e1', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.05)' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a', margin: '0 0 4px 0' }}>
                Formularz Rejestracji na Turniej
              </h2>
              <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 14px 0' }}>
                Po wysłaniu zgłoszenia zostaniesz automatycznie dopisany do tabeli turniejowej.
              </p>

              <form onSubmit={handleDirectFormSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569' }}>Turniej *</label>
                  <select
                    value={formTournamentId}
                    onChange={(e) => setFormTournamentId(e.target.value)}
                    required
                    style={{ padding: '7px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  >
                    {activeTournaments.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.date})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569' }}>Imię i Nazwisko *</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    placeholder="Jan Kowalski"
                    style={{ padding: '7px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569' }}>Płeć *</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as any)}
                    style={{ padding: '7px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="Male">Mężczyzna</option>
                    <option value="Female">Kobieta</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569' }}>Rok urodzenia *</label>
                  <input
                    type="number"
                    min={1940}
                    max={2030}
                    value={birthYear}
                    onChange={(e) => setBirthYear(e.target.value)}
                    placeholder="2000"
                    required
                    style={{ padding: '7px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569' }}>Miejscowość *</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Gdańsk"
                    required
                    style={{ padding: '7px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569' }}>Kraj (Kod ISO)</label>
                  <input
                    type="text"
                    maxLength={3}
                    value={countryFlag}
                    onChange={(e) => setCountryFlag(e.target.value.toUpperCase())}
                    placeholder="PL"
                    style={{ padding: '7px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569' }}>Klub (opcjonalnie)</label>
                  <input
                    type="text"
                    value={clubName}
                    onChange={(e) => setClubName(e.target.value)}
                    placeholder="Nazwa klubu"
                    style={{ padding: '7px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569' }}>Zdjęcie profilowe (wysyłane na maila)</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      style={{ display: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '6px 10px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                    >
                      <ImageIcon size={13} /> Wybierz plik
                    </button>
                    <span style={{ fontSize: '10px', color: selectedFile ? '#16a34a' : '#94a3b8', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>
                      {selectedFile ? selectedFile.name : 'Brak pliku'}
                    </span>
                  </div>
                </div>

                <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 800 }}>
                    {formNotice}
                  </span>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setShowDirectForm(false)}
                      style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '7px 14px', fontSize: '11px', fontWeight: 800, cursor: 'pointer', color: '#475569' }}
                    >
                      Anuluj
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      style={{ background: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', padding: '7px 16px', fontSize: '11px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                    >
                      <UserPlus size={13} /> {isSubmitting ? 'Zapisywanie...' : 'Zatwierdź zgłoszenie'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          <div className="tournaments-table-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: '220px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search size={13} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Szukaj turnieju..."
                    style={{ padding: '6px 8px 6px 26px', fontSize: '11px', borderRadius: '6px', border: '1px solid #cbd5e1', width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  style={{ padding: '6px 8px', fontSize: '11px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
                >
                  <option value="active">Otwarte (rejestracja)</option>
                  <option value="completed">Zakończone</option>
                  <option value="all">Wszystkie</option>
                </select>
              </div>

              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap' }}>
                Turniejów: <b>{filteredTournaments.length}</b>
              </span>
            </div>

            <div className="tournaments-table-box">
              <table className="tourn-table-main">
                <thead>
                  <tr>
                    <th className="col-mob-date" style={{ padding: '8px 10px' }}>Data</th>
                    <th className="col-mob-tourn" style={{ padding: '8px 10px' }}>Turniej</th>
                    <th className="mobile-hide" style={{ padding: '8px 10px' }}>Pole</th>
                    <th className="mobile-hide" style={{ padding: '8px 8px', textAlign: 'center' }}>Status</th>
                    <th className="col-mob-registered" style={{ padding: '8px 6px', textAlign: 'center' }}>Zapisani</th>
                    <th className="col-mob-action" style={{ padding: '8px 6px', textAlign: 'center' }}>Akcja</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTournaments.map((t, idx) => {
                    const isCompleted = t.status === 'completed';
                    const fromRegs = (registrations || []).filter((r) => r.tournament_id === t.id).length;
                    const displayCount = fromRegs > 0 ? fromRegs : activeSystemPlayersCount;

                    return (
                      <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                        <td className="col-mob-date" style={{ padding: '8px 10px', color: '#64748b', fontWeight: 700 }}>
                          {t.date}
                        </td>
                        <td className="col-mob-tourn" style={{ padding: '8px 10px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <button
                              type="button"
                              onClick={() => setSelectedTournament(t)}
                              style={{ background: 'none', border: 'none', padding: 0, color: '#0284c7', fontWeight: 900, fontSize: '12px', cursor: 'pointer', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                            >
                              {t.name}
                              {t.isPolishOpen && (
                                <span style={{ marginLeft: '4px', fontSize: '8px', fontWeight: 800, color: '#dc2626', background: '#fee2e2', padding: '1px 3px', borderRadius: '3px' }}>
                                  MP
                                </span>
                              )}
                            </button>
                            <span className="mobile-show-subline">
                              {t.courseName || 'Pole Turniejowe PFFG'}
                            </span>
                          </div>
                        </td>
                        <td className="mobile-hide" style={{ padding: '8px 10px', color: '#475569' }}>
                          {t.courseName || 'Pole Turniejowe PFFG'}
                        </td>
                        <td className="mobile-hide" style={{ padding: '8px 8px', textAlign: 'center' }}>
                          {isCompleted ? (
                            <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', background: '#f1f5f9', padding: '2px 5px', borderRadius: '4px' }}>
                              Zakończony
                            </span>
                          ) : (
                            <span style={{ fontSize: '10px', fontWeight: 800, color: '#16a34a', background: '#dcfce7', padding: '2px 5px', borderRadius: '4px', border: '1px solid #86efac' }}>
                              Zapisy otwarte
                            </span>
                          )}
                        </td>
                        <td className="col-mob-registered" style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 900, color: '#0f172a' }}>
                          {displayCount}
                        </td>
                        <td className="col-mob-action" style={{ padding: '8px 6px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'center' }}>
                            <button
                              type="button"
                              className="btn-mob-action"
                              onClick={() => setSelectedTournament(t)}
                              title="Zobacz listę zapisanych zawodników"
                              style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '5px', padding: '4px 8px', fontSize: '11px', fontWeight: 800, cursor: 'pointer', color: '#475569', display: 'flex', alignItems: 'center', gap: '3px' }}
                            >
                              <Eye size={12} /> Lista
                            </button>
                            {!isCompleted && (
                              <button
                                type="button"
                                className="btn-mob-action"
                                onClick={() => {
                                  setFormTournamentId(t.id);
                                  setShowDirectForm(true);
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                title="Zapisz się"
                                style={{ background: '#0284c7', border: 'none', color: '#fff', borderRadius: '5px', padding: '4px 8px', fontSize: '11px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                              >
                                <UserPlus size={12} /> Zapisz
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
                <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontWeight: 700, fontSize: '12px' }}>
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