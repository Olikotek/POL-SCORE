// src/components/TournamentsView.tsx
import { useState, useMemo, useRef } from 'react';
import {
  Calendar,
  MapPin,
  CheckCircle2,
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
import { compressImage } from '@/lib/imageCompressor';

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

  // Filtry listy turniejów
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');

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
  const [rawPhotoData, setRawPhotoData] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeTournaments = useMemo(() => {
    return (tournaments || []).filter((t) => t.status !== 'completed');
  }, [tournaments]);

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
    if (!selectedTournament) return [];
    const regIds = new Set(
      (registrations || [])
        .filter((r) => r.tournament_id === selectedTournament.id)
        .map((r) => r.player_id)
    );
    return (store.players || []).filter((p) => regIds.has(p.id));
  }, [store.players, registrations, selectedTournament]);

  const filteredRegisteredPlayers = useMemo(() => {
    return registeredPlayers.filter((p) => {
      const matchCat = playerCategoryFilter === 'all' || p.category === playerCategoryFilter;
      const matchName = !playerNameFilter || p.name.toLowerCase().includes(playerNameFilter.toLowerCase());
      const matchClub = !playerClubFilter || (p.club && p.club.toLowerCase().includes(playerClubFilter.toLowerCase()));
      return matchCat && matchName && matchClub;
    });
  }, [registeredPlayers, playerCategoryFilter, playerNameFilter, playerClubFilter]);

  const handlePhotoUpload = async (file?: File) => {
    if (!file) return;
    try {
      const compressed = await compressImage(file, 400, 400, 0.9);
      setRawPhotoData(compressed);
    } catch {
      alert('Błąd przetwarzania zdjęcia.');
    }
  };

  const handleDirectFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !formTournamentId) return;

    setIsSubmitting(true);
    setFormNotice(null);

    try {
      const formattedBirth = birthYear.trim() ? `${birthYear.trim()}-01-01` : undefined;
      const cleanFlag = countryFlag.trim().toUpperCase() || 'PL';

      // 1. Zapisujemy/aktualizujemy gracza w tabeli players (isActive: true natychmiast wrzuca go do tabeli na żywo)
      let playerId = userProfile?.id;

      if (!playerId) {
        const { data: newPlayer, error: playerErr } = await supabase
          .from('players')
          .insert({
            name: fullName.trim(),
            gender,
            birth_date: formattedBirth,
            city: city.trim() || undefined,
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
          .update({ is_active: true })
          .eq('id', playerId);
      }

      // 2. Dodajemy zgłoszenie turniejowe wraz ze zdjęciem dla admina
      const { error: regErr } = await supabase.from('tournament_registrations').insert({
        tournament_id: formTournamentId,
        player_id: playerId,
        status: 'pending',
        photo_data: rawPhotoData || undefined,
      });

      if (regErr && !regErr.message.includes('unique')) {
        throw regErr;
      }

      setFormNotice('Zapisano pomyślnie! Zawodnik został dodany do turnieju.');
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

  if (selectedTournament) {
    return (
      <section style={{ background: '#ffffff', borderRadius: '12px', padding: '24px', border: '1px solid #cbd5e1', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.04)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '14px', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              LISTA STARTOWA TURNIEJU
            </span>
            <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', margin: '2px 0 0 0' }}>
              {selectedTournament.name}
            </h2>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <ArrowLeft size={15} /> Wróć do listy turniejów
          </button>
        </div>

        <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 800, color: '#475569' }}>Kategoria</label>
            <select
              value={playerCategoryFilter}
              onChange={(e) => setPlayerCategoryFilter(e.target.value as any)}
              style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
            >
              <option value="all">Wszystkie</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 800, color: '#475569' }}>Zawodnik</label>
            <input
              type="text"
              value={playerNameFilter}
              onChange={(e) => setPlayerNameFilter(e.target.value)}
              placeholder="Imię lub nazwisko..."
              style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', width: '160px' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 800, color: '#475569' }}>Klub</label>
            <input
              type="text"
              value={playerClubFilter}
              onChange={(e) => setPlayerClubFilter(e.target.value)}
              placeholder="Nazwa klubu..."
              style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', width: '140px' }}
            />
          </div>

          <button
            type="button"
            onClick={() => {
              setPlayerCategoryFilter('all');
              setPlayerNameFilter('');
              setPlayerClubFilter('');
            }}
            style={{ background: '#64748b', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <RotateCcw size={12} /> Resetuj
          </button>
        </div>

        <div style={{ overflowX: 'auto', border: '1px solid #cbd5e1', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1', color: '#475569', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase' }}>
                <th style={{ padding: '10px 8px', width: '45px', textAlign: 'center' }}>Nr</th>
                <th style={{ padding: '10px 14px' }}>Zawodnik</th>
                <th style={{ padding: '10px 8px', textAlign: 'center', width: '50px' }}>Kraj</th>
                <th style={{ padding: '10px 12px' }}>Kategoria</th>
                <th style={{ padding: '10px 12px' }}>Klub</th>
                <th style={{ padding: '10px 12px' }}>Miasto</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', width: '110px' }}>Status opłaty</th>
              </tr>
            </thead>
            <tbody>
              {filteredRegisteredPlayers.map((p, index) => {
                const regItem = (registrations || []).find(
                  (r) => r.tournament_id === selectedTournament.id && r.player_id === p.id
                );
                const isPaid = regItem?.status === 'confirmed' || regItem?.status === 'paid';

                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9', background: index % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                    <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 800, color: '#64748b' }}>
                      {index + 1}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <button
                        type="button"
                        onClick={() => onOpenPlayer(p.id)}
                        style={{ background: 'none', border: 'none', padding: 0, color: '#0284c7', fontWeight: 800, fontSize: '13px', cursor: 'pointer', textAlign: 'left' }}
                      >
                        {p.name}
                      </button>
                      {p.isAmateur && (
                        <span style={{ marginLeft: '6px', background: '#7ea128', color: '#fff', fontSize: '9px', fontWeight: 800, padding: '1px 4px', borderRadius: '3px' }}>
                          AM
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                      <img
                        src={p.flagImage || flagEmoji(p.flag || 'PL')}
                        alt={p.flag || 'PL'}
                        style={{ width: '20px', height: '14px', objectFit: 'cover', borderRadius: '2px', border: '1px solid #cbd5e1', display: 'inline-block' }}
                      />
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: '#334155' }}>
                      {p.category}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>
                      {p.club || '–'}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>
                      {p.city || '–'}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      {isPaid ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 800, color: '#15803d', background: '#dcfce7', padding: '3px 8px', borderRadius: '4px', border: '1px solid #86efac' }}>
                          <CheckCircle2 size={13} /> Opłacone
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 800, color: '#b45309', background: '#fef3c7', padding: '3px 8px', borderRadius: '4px', border: '1px solid #fde68a' }}>
                          <Clock size={13} /> Oczekuje
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredRegisteredPlayers.length === 0 && (
            <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontWeight: 700 }}>
              Brak zawodników na liście startowej.
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div
        style={{
          background: 'linear-gradient(135deg, #0b1329 0%, #1e293b 100%)',
          borderRadius: '12px',
          padding: '20px 24px',
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          boxShadow: '0 4px 12px rgba(11, 19, 41, 0.15)',
        }}
      >
        <div>
          <span style={{ fontSize: '11px', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            SEZON PFFG 2026
          </span>
          <h1 style={{ margin: '4px 0 0 0', fontSize: '24px', fontWeight: 900 }}>
            Oficjalny Kalendarz & Zapisy
          </h1>
          <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#94a3b8', maxWidth: '580px', lineHeight: 1.4 }}>
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
            padding: '10px 20px',
            fontSize: '13px',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 2px 8px rgba(2, 132, 199, 0.4)',
          }}
        >
          <UserPlus size={16} />
          {showDirectForm ? 'Schowaj formularz' : 'Zapisz się na turniej'}
        </button>
      </div>

      {showDirectForm && (
        <div style={{ background: '#ffffff', borderRadius: '12px', padding: '24px', border: '1px solid #cbd5e1', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.05)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', margin: '0 0 4px 0' }}>
            Formularz Rejestracji na Turniej
          </h2>
          <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 16px 0' }}>
            Po wysłaniu zgłoszenia zostaniesz automatycznie przypisany do wybranego turnieju.
          </p>

          <form onSubmit={handleDirectFormSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569' }}>Turniej *</label>
              <select
                value={formTournamentId}
                onChange={(e) => setFormTournamentId(e.target.value)}
                required
                style={{ padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              >
                {activeTournaments.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.date})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569' }}>Imię i Nazwisko *</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder="Jan Kowalski"
                style={{ padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569' }}>Płeć *</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as any)}
                style={{ padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              >
                <option value="Male">Mężczyzna</option>
                <option value="Female">Kobieta</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569' }}>Rok urodzenia</label>
              <input
                type="number"
                min={1940}
                max={2030}
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)}
                placeholder="2000"
                style={{ padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569' }}>Miejscowość</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Gdańsk"
                style={{ padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569' }}>Kraj (Kod ISO)</label>
              <input
                type="text"
                maxLength={3}
                value={countryFlag}
                onChange={(e) => setCountryFlag(e.target.value.toUpperCase())}
                placeholder="PL"
                style={{ padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569' }}>Klub (opcjonalnie)</label>
              <input
                type="text"
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                placeholder="Nazwa Twojego klubu"
                style={{ padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569' }}>Zdjęcie profilowe (do weryfikacji)</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handlePhotoUpload(e.target.files?.[0])}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <ImageIcon size={14} /> Wybierz plik
                </button>
                <span style={{ fontSize: '11px', color: rawPhotoData ? '#16a34a' : '#94a3b8', fontWeight: 700 }}>
                  {rawPhotoData ? 'Zdjęcie dołączone' : 'Brak pliku'}
                </span>
              </div>
            </div>

            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 800 }}>
                {formNotice}
              </span>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowDirectForm(false)}
                  style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px 16px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', color: '#475569' }}
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{ background: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 20px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <UserPlus size={14} /> {isSubmitting ? 'Zapisywanie...' : 'Zatwierdź zgłoszenie'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      <div style={{ background: '#ffffff', borderRadius: '12px', padding: '20px', border: '1px solid #cbd5e1', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.04)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Szukaj po nazwie lub polu..."
                style={{ padding: '6px 10px 6px 30px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', width: '220px' }}
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
            >
              <option value="all">Wszystkie statusy</option>
              <option value="active">Otwarte (rejestracja)</option>
              <option value="completed">Zakończone</option>
            </select>
          </div>

          <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>
            Turniejów w terminarzu: <b>{filteredTournaments.length}</b>
          </span>
        </div>

        <div style={{ overflowX: 'auto', border: '1px solid #cbd5e1', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1', color: '#475569', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase' }}>
                <th style={{ padding: '10px 12px', width: '100px' }}>Data</th>
                <th style={{ padding: '10px 14px' }}>Turniej</th>
                <th style={{ padding: '10px 12px' }}>Pole</th>
                <th style={{ padding: '10px 10px', textAlign: 'center', width: '110px' }}>Status</th>
                <th style={{ padding: '10px 10px', textAlign: 'center', width: '80px' }}>Zapisanych</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', width: '140px' }}>Akcja</th>
              </tr>
            </thead>
            <tbody>
              {filteredTournaments.map((t, idx) => {
                const isCompleted = t.status === 'completed';
                const count = (registrations || []).filter((r) => r.tournament_id === t.id).length;

                return (
                  <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                    <td style={{ padding: '10px 12px', color: '#64748b', fontWeight: 700, fontSize: '12px' }}>
                      {t.date}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedTournament(t)}
                        style={{ background: 'none', border: 'none', padding: 0, color: '#0284c7', fontWeight: 900, fontSize: '13px', cursor: 'pointer', textAlign: 'left' }}
                      >
                        {t.name}
                      </button>
                      {t.isPolishOpen && (
                        <span style={{ marginLeft: '6px', fontSize: '9px', fontWeight: 800, color: '#dc2626', background: '#fee2e2', padding: '1px 5px', borderRadius: '3px' }}>
                          MP
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#475569' }}>
                      {t.courseName || 'Pole Turniejowe PFFG'}
                    </td>
                    <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                      {isCompleted ? (
                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                          Zakończony
                        </span>
                      ) : (
                        <span style={{ fontSize: '10px', fontWeight: 800, color: '#16a34a', background: '#dcfce7', padding: '2px 6px', borderRadius: '4px', border: '1px solid #86efac' }}>
                          Zapisy otwarte
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px 10px', textAlign: 'center', fontWeight: 900, color: '#0f172a' }}>
                      {count}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'center' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedTournament(t)}
                          title="Zobacz listę zapisanych zawodników"
                          style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', fontWeight: 800, cursor: 'pointer', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Eye size={13} /> Lista
                        </button>
                        {!isCompleted && (
                          <button
                            type="button"
                            onClick={() => {
                              setFormTournamentId(t.id);
                              setShowDirectForm(true);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            title="Zapisz się"
                            style={{ background: '#0284c7', border: 'none', color: '#fff', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <UserPlus size={13} /> Zapisz
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
            <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontWeight: 700 }}>
              Brak turniejów w wybranym filtrze.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}