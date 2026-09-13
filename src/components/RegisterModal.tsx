// src/components/RegisterModal.tsx
import { useState, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { X, CheckCircle2, UserPlus, Search, UserCheck, Image as ImageIcon, ShieldCheck } from 'lucide-react';
import { compressImage } from '@/lib/imageCompressor';
import type { Player } from '@/types';

export function RegisterModal({
  tournamentId,
  tournamentName,
  userProfile,
  allPlayers = [],
  onClose,
  onRegistered,
}: {
  tournamentId?: string;
  tournamentName: string;
  userProfile: any;
  allPlayers?: Player[];
  onClose: () => void;
  onRegistered: () => void;
}) {
  const [isExisting, setIsExisting] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(userProfile || null);

  const [name, setName] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female'>('Male');
  const [birthYear, setBirthYear] = useState('');
  const [city, setCity] = useState('');
  const [club, setClub] = useState('');
  const [avatar, setAvatar] = useState('');

  const [paymentMethod, setPaymentMethod] = useState<'on_site' | 'online'>('on_site');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    return allPlayers
      .filter((p) => p.name.toLowerCase().includes(q) || (p.club && p.club.toLowerCase().includes(q)))
      .slice(0, 6);
  }, [searchQuery, allPlayers]);

  const handleFileUpload = async (file: File | undefined) => {
    if (!file) return;
    try {
      const compressed = await compressImage(file, 320, 320, 0.88);
      setAvatar(compressed);
    } catch {
      setError('Błąd kompresji zdjęcia.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tournamentId) {
      setError('Nie wybrano turnieju.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let targetPlayerId = selectedPlayer?.id;

      if (isExisting && selectedPlayer) {
        if (avatar && avatar !== selectedPlayer.avatar) {
          await supabase.from('players').update({ avatar }).eq('id', selectedPlayer.id);
        }
      }

      if (!isExisting) {
        if (!name.trim()) {
          throw new Error('Podaj imię i nazwisko.');
        }

        const calculatedBirth = birthYear.trim() ? birthYear.trim() + '-01-01' : null;
        const currentYear = new Date().getFullYear();
        const age = birthYear.trim() ? currentYear - Number(birthYear) : 25;

        let category: any = 'Men';
        if (gender === 'Female') category = 'Ladies';
        else if (age >= 45 && age < 55) category = 'Senior';
        else if (age >= 55) category = 'Super Senior';
        else if (age <= 18) category = 'Junior';

        const { data: newP, error: pError } = await supabase
          .from('players')
          .insert({
            name: name.trim(),
            category,
            gender,
            birth_date: calculatedBirth,
            city: city.trim() || null,
            club: club.trim() || null,
            avatar: avatar || null,
            flag: 'PL',
            is_active: true,
          })
          .select()
          .single();

        if (pError) throw pError;
        targetPlayerId = newP.id;
      }

      if (!targetPlayerId) {
        throw new Error('Wybierz swój profil z listy lub utwórz nowy.');
      }

      const { error: regError } = await supabase.from('tournament_registrations').insert({
        tournament_id: tournamentId,
        player_id: targetPlayerId,
        payment_method: paymentMethod,
        status: 'pending',
      });

      if (regError && !regError.message.includes('duplicate key')) {
        throw regError;
      }

      await supabase.from('tournament_players').upsert({
        tournament_id: tournamentId,
        player_id: targetPlayerId,
      });

      setSuccess(true);
      setTimeout(() => {
        onRegistered();
        onClose();
      }, 1400);
    } catch (err: any) {
      setError(err.message || 'Wystąpił błąd podczas zapisu na turniej.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          maxWidth: '480px',
          width: '100%',
          padding: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          color: '#0f172a',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 900, margin: 0, color: '#0f172a' }}>
              Zapis na Turniej
            </h2>
            <small style={{ color: '#0284c7', fontWeight: 700 }}>{tournamentName}</small>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '6px',
            background: '#f1f5f9',
            padding: '4px',
            borderRadius: '8px',
            marginBottom: '16px',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setIsExisting(true);
              setSelectedPlayer(userProfile || null);
            }}
            style={{
              padding: '8px',
              fontSize: '12px',
              fontWeight: 800,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              background: isExisting ? '#ffffff' : 'transparent',
              color: isExisting ? '#0284c7' : '#64748b',
              boxShadow: isExisting ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            Mam już profil w bazie
          </button>
          <button
            type="button"
            onClick={() => {
              setIsExisting(false);
              setSelectedPlayer(null);
            }}
            style={{
              padding: '8px',
              fontSize: '12px',
              fontWeight: 800,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              background: !isExisting ? '#ffffff' : 'transparent',
              color: !isExisting ? '#0284c7' : '#64748b',
              boxShadow: !isExisting ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            Gram 1. raz (Nowy profil)
          </button>
        </div>

        {error && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              padding: '10px',
              borderRadius: '8px',
              fontSize: '12px',
              marginBottom: '12px',
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        )}

        {success ? (
          <div
            style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              color: '#15803d',
              padding: '20px',
              borderRadius: '8px',
              textAlign: 'center',
              fontWeight: 800,
            }}
          >
            <CheckCircle2 size={32} style={{ margin: '0 auto 8px auto', display: 'block' }} />
            Zgłoszenie przyjęte pomyślnie! Zawodnik dodany do turnieju.
          </div>
        ) : (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {isExisting ? (
              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Wyszukaj swój profil (imię lub nazwisko):
                </label>

                {selectedPlayer ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#f0fdf4',
                      border: '1px solid #86efac',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      marginBottom: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <UserCheck size={20} color="#16a34a" />
                      <div>
                        <strong style={{ fontSize: '14px', color: '#0f172a', display: 'block' }}>{selectedPlayer.name}</strong>
                        <small style={{ color: '#64748b' }}>{(selectedPlayer.club || 'Bez klubu') + ' · ' + selectedPlayer.category}</small>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedPlayer(null)}
                      style={{
                        background: '#fee2e2',
                        border: 'none',
                        color: '#dc2626',
                        borderRadius: '4px',
                        padding: '4px 8px',
                        fontSize: '11px',
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      Zmień
                    </button>
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
                      <Search size={16} />
                    </div>
                    <input
                      type="text"
                      autoFocus
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Wpisz min. 2 litery (np. Kowalski)..."
                      style={{
                        width: '100%',
                        padding: '10px 10px 10px 34px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        fontWeight: 700,
                      }}
                    />
                    {searchResults.length > 0 && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          marginTop: '4px',
                          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                          zIndex: 10,
                          overflow: 'hidden',
                        }}
                      >
                        {searchResults.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => {
                              setSelectedPlayer(p);
                              setSearchQuery('');
                            }}
                            style={{
                              padding: '8px 12px',
                              borderBottom: '1px solid #f1f5f9',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <span style={{ fontWeight: 800, fontSize: '13px' }}>{p.name}</span>
                            <span style={{ fontSize: '11px', color: '#64748b' }}>{p.club || p.category}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ marginTop: '10px', background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: '6px' }}>
                    Zdjęcie profilowe (opcjonalnie zaktualizuj):
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {(avatar || selectedPlayer?.avatar) && (
                      <img
                        src={avatar || selectedPlayer?.avatar}
                        alt="avatar"
                        style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e.target.files?.[0])}
                      style={{ display: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        padding: '6px 10px',
                        fontSize: '11px',
                        fontWeight: 800,
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        background: '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      <ImageIcon size={13} style={{ display: 'inline', marginRight: '4px' }} />
                      {avatar ? 'Zmień wybrane' : 'Wybierz nowe zdjęcie'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="form-field">
                  <label className="form-field-label">Imię i Nazwisko *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="np. Jan Kowalski"
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div className="form-field">
                    <label className="form-field-label">Płeć *</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value as any)}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    >
                      <option value="Male">Mężczyzna</option>
                      <option value="Female">Kobieta</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label className="form-field-label">Rok urodzenia *</label>
                    <input
                      type="number"
                      required
                      min={1940}
                      max={2030}
                      value={birthYear}
                      onChange={(e) => setBirthYear(e.target.value)}
                      placeholder="np. 2000"
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div className="form-field">
                    <label className="form-field-label">Miejscowość *</label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="np. Gdańsk"
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-field-label">Klub (opcjonalnie)</label>
                    <input
                      type="text"
                      value={club}
                      onChange={(e) => setClub(e.target.value)}
                      placeholder="np. KS Footgolf"
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                </div>

                <div className="form-field">
                  <label className="form-field-label">Zdjęcie profilowe</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {avatar && (
                      <img
                        src={avatar}
                        alt="avatar"
                        style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e.target.files?.[0])}
                      style={{ display: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        padding: '6px 10px',
                        fontSize: '11px',
                        fontWeight: 800,
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        background: '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      <ImageIcon size={13} style={{ display: 'inline', marginRight: '4px' }} />
                      Wybierz zdjęcie
                    </button>
                  </div>
                </div>
              </>
            )}

            <div className="form-field">
              <label className="form-field-label">Sposób płatności wpisowego</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              >
                <option value="on_site">Zapłać na miejscu w dniu turnieju</option>
                <option value="online">Przelew online (Blik / Szybki przelew)</option>
              </select>
            </div>

            <div
              style={{
                background: '#f8fafc',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '11px',
                color: '#64748b',
              }}
            >
              <ShieldCheck size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
              Zawodnik zostanie dodany bezpośrednio do listy uczestników bieżącego turnieju.
            </div>

            <button
              type="submit"
              disabled={loading || (isExisting && !selectedPlayer)}
              style={{
                marginTop: '6px',
                background: '#10b981',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '12px',
                fontWeight: 800,
                fontSize: '14px',
                cursor: loading || (isExisting && !selectedPlayer) ? 'not-allowed' : 'pointer',
                opacity: loading || (isExisting && !selectedPlayer) ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 2px 4px rgba(16,185,129,0.3)',
              }}
            >
              <UserPlus size={16} /> {loading ? 'Zapisywanie...' : 'Zatwierdź zgłoszenie'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}