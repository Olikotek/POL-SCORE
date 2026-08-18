import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { X, CheckCircle2, UserPlus, CreditCard, ShieldCheck } from 'lucide-react';

export function RegisterModal({
  tournamentId,
  tournamentName,
  userProfile,
  onClose,
  onRegistered,
}: {
  tournamentId?: string;
  tournamentName: string;
  userProfile: any;
  onClose: () => void;
  onRegistered: () => void;
}) {
  const [paymentMethod, setPaymentMethod] = useState<'on_site' | 'online'>('on_site');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) {
      setError('Brak profilu zalogowanego użytkownika.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (tournamentId) {
        // Zapis do tabeli relacyjnej turniej-gracz
        const { error: regError } = await supabase.from('tournament_registrations').insert({
          tournament_id: tournamentId,
          player_id: userProfile.id,
          payment_method: paymentMethod,
        });

        if (regError && !regError.message.includes('duplicate key')) {
          throw regError;
        }
      }

      // Aktywacja gracza w turnieju
      await supabase
        .from('players')
        .update({ is_active: true })
        .eq('id', userProfile.id);

      setSuccess(true);
      setTimeout(() => {
        onRegistered();
        onClose();
      }, 1500);
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
          borderRadius: '12px',
          maxWidth: '460px',
          width: '100%',
          padding: '24px',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
          color: '#0f172a',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 900, margin: 0, color: '#0f172a' }}>
            Zapis na turniej
          </h2>
          <button
            onClick={onClose}
            style={{ background: '#f1f5f9', border: 'none', borderRadius: '6px', padding: '6px', cursor: 'pointer', color: '#64748b' }}
          >
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: '13px', color: '#475569', marginBottom: '16px' }}>
          Zapisujesz zawodnika: <strong style={{ color: '#0f172a' }}>{userProfile?.name || 'Zalogowany Gracz'}</strong> na turniej: <strong style={{ color: '#0284c7' }}>{tournamentName}</strong>.
        </p>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px', borderRadius: '8px', fontSize: '12px', marginBottom: '12px' }}>
            {error}
          </div>
        )}

        {success ? (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', padding: '16px', borderRadius: '8px', textAlign: 'center', fontWeight: 800 }}>
            <CheckCircle2 size={24} style={{ margin: '0 auto 6px auto', display: 'block' }} />
            Zapisano pomyślnie! Wysłano potwierdzenie na e-mail.
          </div>
        ) : (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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

            <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px', color: '#64748b' }}>
              <ShieldCheck size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
              Po kliknięciu przycisku zostaniesz dodany do oficjalnej listy startowej, a na Twój e-mail zostanie wysłane potwierdzenie rejestracji.
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                background: '#10b981',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '12px',
                fontWeight: 800,
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 2px 4px rgba(16,185,129,0.3)',
              }}
            >
              <UserPlus size={16} /> {loading ? 'Zapisywanie...' : 'Potwierdź zapis na turniej'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
