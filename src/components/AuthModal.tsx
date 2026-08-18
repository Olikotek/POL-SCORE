import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Shield, AlertCircle, CheckCircle2, Image as ImageIcon, KeyRound, UserCheck } from 'lucide-react';
import type { Category, Player } from '@/types';
import { CATEGORIES, COUNTRIES, flagEmoji } from '@/types';

export function AuthModal({
  onClose,
  onSuccess,
  initialMode = 'login',
  currentUserProfile = null,
}: {
  onClose: () => void;
  onSuccess: () => void;
  initialMode?: 'login' | 'register' | 'forgot' | 'edit_profile';
  currentUserProfile?: Player | any | null;
}) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'edit_profile'>(initialMode);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female'>('Male');
  const [preferredFoot, setPreferredFoot] = useState<'Right' | 'Left'>('Right');
  const [birthDate, setBirthDate] = useState('');
  const [city, setCity] = useState('');
  const [club, setClub] = useState('');
  const [ballModel, setBallModel] = useState('');
  const [avatar, setAvatar] = useState('');
  const [flag, setFlag] = useState('PL');
  const [category, setCategory] = useState<Category>('Men');
  const [isAmateur, setIsAmateur] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentUserProfile && (mode === 'edit_profile' || initialMode === 'edit_profile')) {
      const p = currentUserProfile;
      const parts = (p.name || '').trim().split(/\s+/);
      setFirstName(parts[0] || '');
      setLastName(parts.slice(1).join(' ') || '');
      setGender(p.gender || 'Male');
      setPreferredFoot(p.preferredFoot || p.preferred_foot || 'Right');
      setBirthDate(p.birthDate || p.birth_date || '');
      setCity(p.city || '');
      setClub(p.club || '');
      setBallModel(p.ballModel || p.ball_model || '');
      setAvatar(p.avatar || '');
      setFlag(p.flag || 'PL');
      setCategory(p.category || 'Men');
      setIsAmateur(Boolean(p.isAmateur ?? p.is_amateur));
      if (p.email) setEmail(p.email);
    }
  }, [currentUserProfile, mode, initialMode]);

  const handleFileUpload = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setAvatar(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
        onSuccess();
        onClose();
      } else if (mode === 'forgot') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim());
        if (resetError) throw resetError;
        setMessage('Link do zresetowania hasła został wysłany na Twój adres e-mail.');
      } else if (mode === 'edit_profile') {
        const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
        if (!fullName) throw new Error('Podaj imię i nazwisko.');

        const updateData: any = {
          name: fullName,
          category,
          club: club.trim() || null,
          ball_model: ballModel.trim() || null,
          avatar: avatar.trim() || null,
          flag,
          is_amateur: isAmateur,
          gender,
          preferred_foot: preferredFoot,
          birth_date: birthDate || null,
          city: city.trim() || null,
        };

        const { error: updateError } = await supabase
          .from('players')
          .update(updateData)
          .eq('id', currentUserProfile.id);

        if (updateError) throw updateError;

        setMessage('Profil został pomyślnie zaktualizowany!');
        onSuccess();
        setTimeout(() => onClose(), 1200);
      } else {
        const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
        if (!fullName) throw new Error('Podaj imię i nazwisko.');

        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (signUpError) throw signUpError;

        const userId = authData.user?.id;
        if (userId) {
          const { error: profileError } = await supabase.from('players').insert({
            user_id: userId,
            name: fullName,
            category,
            club: club.trim() || null,
            ball_model: ballModel.trim() || null,
            avatar: avatar.trim() || null,
            flag,
            is_amateur: isAmateur,
            email: email.trim(),
            gender,
            preferred_foot: preferredFoot,
            birth_date: birthDate || null,
            city: city.trim() || null,
            is_active: true,
            role: 'player',
          });

          if (profileError) {
            console.error('Błąd tworzenia profilu:', profileError);
          }
        }

        setMessage('Profil został utworzony! Zaloguj się, aby kontynuować.');
        setMode('login');
      }
    } catch (err: any) {
      setError(err.message || 'Wystąpił błąd podczas autoryzacji.');
    } finally {
      setLoading(false);
    }
  };

  const isWideModal = mode === 'register' || mode === 'edit_profile';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
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
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          maxWidth: isWideModal ? '700px' : '420px',
          width: '100%',
          padding: '24px',
          maxHeight: '90vh',
          overflowY: 'auto',
          color: '#0f172a',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: '#ecfdf5', color: '#10b981', padding: '8px', borderRadius: '8px' }}>
              {mode === 'edit_profile' ? <UserCheck size={22} /> : mode === 'forgot' ? <KeyRound size={22} /> : <Shield size={22} />}
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                {mode === 'login' && 'Logowanie do systemu PFFG'}
                {mode === 'register' && 'Rejestracja Zawodnika'}
                {mode === 'forgot' && 'Odzyskiwanie hasła'}
                {mode === 'edit_profile' && 'Edycja Twojego Profilu'}
              </h2>
              <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                {mode === 'login' && 'Wprowadź dane dostępowe do konta'}
                {mode === 'register' && 'Wypełnij kartę rejestracyjną zawodnika'}
                {mode === 'forgot' && 'Wpisz email przypisany do Twojego profilu'}
                {mode === 'edit_profile' && 'Zaktualizuj swoje dane zawodnika'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '6px',
              padding: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 12px', borderRadius: '8px', fontSize: '12px', display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '14px' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', padding: '10px 12px', borderRadius: '8px', fontSize: '12px', display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '14px' }}>
            <CheckCircle2 size={16} />
            <span>{message}</span>
          </div>
        )}

        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {mode === 'login' && (
            <>
              <div className="form-field">
                <label className="form-field-label">Adres e-mail</label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="twoj.email@domena.pl"
                />
              </div>

              <div className="form-field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-field-label">Hasło</label>
                  <button
                    type="button"
                    onClick={() => setMode('forgot')}
                    style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '11px', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                  >
                    Nie pamiętasz hasła?
                  </button>
                </div>
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            </>
          )}

          {mode === 'forgot' && (
            <div className="form-field">
              <label className="form-field-label">Podaj adres e-mail do resetu hasła</label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="twoj.email@domena.pl"
              />
            </div>
          )}

          {isWideModal && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {/* 1. DANE OSOBOWE */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <p style={{ fontSize: '11px', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', margin: 0 }}>
                  1. Dane osobowe
                </p>

                <div className="form-field">
                  <label className="form-field-label">Imię *</label>
                  <input
                    required
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="np. Jan"
                  />
                </div>

                <div className="form-field">
                  <label className="form-field-label">Nazwisko *</label>
                  <input
                    required
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="np. Kowalski"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-field">
                    <label className="form-field-label">Płeć *</label>
                    <select value={gender} onChange={(e) => setGender(e.target.value as any)}>
                      <option value="Male">Mężczyzna</option>
                      <option value="Female">Kobieta</option>
                    </select>
                  </div>

                  <div className="form-field">
                    <label className="form-field-label">Lepsza noga *</label>
                    <select value={preferredFoot} onChange={(e) => setPreferredFoot(e.target.value as any)}>
                      <option value="Right">Prawa</option>
                      <option value="Left">Lewa</option>
                    </select>
                  </div>
                </div>

                <div className="form-field">
                  <label className="form-field-label">Data urodzenia *</label>
                  <input
                    required
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label className="form-field-label">Zdjęcie profilowe</label>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    {avatar && (
                      <img src={avatar} alt="Podgląd" style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover' }} />
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
                      className="secondary-button"
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <ImageIcon size={14} /> Wybierz zdjęcie
                    </button>
                    {avatar && (
                      <button type="button" className="secondary-button" style={{ padding: '6px' }} onClick={() => setAvatar('')}>
                        Usuń
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. SPRZĘT & KONTO */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <p style={{ fontSize: '11px', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', margin: 0 }}>
                  2. Footgolf & Konto
                </p>

                {mode === 'register' && (
                  <>
                    <div className="form-field">
                      <label className="form-field-label">Adres e-mail (Login) *</label>
                      <input
                        required
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="twoj.email@domena.pl"
                      />
                    </div>

                    <div className="form-field">
                      <label className="form-field-label">Hasło (min. 6 znaków) *</label>
                      <input
                        required
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        minLength={6}
                      />
                    </div>
                  </>
                )}

                <div className="form-field">
                  <label className="form-field-label">Model piłki meczowej</label>
                  <input
                    type="text"
                    value={ballModel}
                    onChange={(e) => setBallModel(e.target.value)}
                    placeholder="np. Adidas Teamgeist / Jabulani"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-field">
                    <label className="form-field-label">Miasto</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="np. Warszawa"
                    />
                  </div>

                  <div className="form-field">
                    <label className="form-field-label">Kraj / Flaga</label>
                    <select value={flag} onChange={(e) => setFlag(e.target.value)}>
                      {COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>{flagEmoji(c.code)} {c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-field">
                  <label className="form-field-label">Klub Footgolfowy</label>
                  <input
                    type="text"
                    value={club}
                    onChange={(e) => setClub(e.target.value)}
                    placeholder="np. KS Footgolf"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', alignItems: 'center', marginTop: '2px' }}>
                  <div className="form-field">
                    <label className="form-field-label">Kategoria</label>
                    <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field" style={{ paddingTop: '16px' }}>
                    <label className="amateur-toggle">
                      <input
                        type="checkbox"
                        checked={isAmateur}
                        onChange={(e) => setIsAmateur(e.target.checked)}
                      />
                      <span>Amator (AM)</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            className="primary-button full"
            disabled={loading}
            style={{ marginTop: '8px' }}
          >
            {loading ? 'Przetwarzanie...' : 
              mode === 'login' ? 'Zaloguj się' : 
              mode === 'forgot' ? 'Wyślij link resetujący' : 
              mode === 'edit_profile' ? 'Zapisz zmiany profilu' : 
              'Zarejestruj profil gracza'}
          </button>
        </form>

        <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>
          {mode === 'login' && (
            <>
              Nie posiadasz konta?{' '}
              <button
                type="button"
                onClick={() => setMode('register')}
                style={{ background: 'none', border: 'none', color: '#10b981', fontWeight: 700, cursor: 'pointer' }}
              >
                Utwórz profil zawodnika
              </button>
            </>
          )}

          {(mode === 'register' || mode === 'forgot') && (
            <>
              Pamiętasz hasło lub masz konto?{' '}
              <button
                type="button"
                onClick={() => setMode('login')}
                style={{ background: 'none', border: 'none', color: '#10b981', fontWeight: 700, cursor: 'pointer' }}
              >
                Wróć do logowania
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}