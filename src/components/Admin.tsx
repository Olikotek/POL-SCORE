import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Check,
  ChevronLeft,
  Edit3,
  Flag,
  Layers,
  LockKeyhole,
  MapPin,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Shuffle,
  UserPlus,
  Users,
  X,
  Trash2,
  Image as ImageIcon,
  Power,
  Trophy,
  Calendar,
  CheckCircle2,
  UserMinus,
  GripVertical,
  Search,
  CircleDot,
} from 'lucide-react';
import type { Category, Flight, Hole, Player, Round, Store, Tournament } from '@/types';
import { CATEGORIES, COUNTRIES, ROUNDS, flagEmoji } from '@/types';
import { ADMIN_CODE } from '@/data';
import { combinedRelative, initials, totalPar, calculateTournamentPoints } from '@/scoring';
import {
  addPlayer,
  assignPlayerToFlight,
  createCourse,
  createFlight,
  createTournament,
  completeTournament,
  deleteCourse,
  deleteFlight,
  deletePlayer,
  deleteTournament,
  reflightForRound2,
  resetRoundScores,
  saveScore,
  setRound1Approved,
  setRound2Started,
  setRoundCourse,
  setTournamentName,
  togglePlayerActive,
  updateCourseHole,
  updateFlight,
  updatePlayer,
  updateTournament,
} from '@/actions';

type FlashFn = (m: string) => void;

export function AdminLock({
  onUnlock,
  onBack,
}: {
  onUnlock: () => void;
  onBack: () => void;
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const unlock = () => (code === ADMIN_CODE ? onUnlock() : setError('Nieprawidłowy kod administratora.'));
  return (
    <section className="lock-page">
      <button className="back-link" onClick={onBack}>
        <ChevronLeft size={15} /> Tabela na żywo
      </button>
      <div className="lock-card">
        <span className="lock-icon">
          <LockKeyhole size={24} />
        </span>
        <p className="eyebrow">
          <span /> STREFA CHRONIONA
        </p>
        <h1>Panel administratora</h1>
        <p>Wprowadź czterocyfrowy kod, aby uzyskać dostęp do ustawień turnieju.</p>
        <input
          autoFocus
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={code}
          onChange={(e) => {
            setCode(e.target.value.replace(/\D/g, ''));
            setError('');
          }}
          onKeyDown={(e) => e.key === 'Enter' && unlock()}
          placeholder="••••"
        />
        {error && <b className="error-text">{error}</b>}
        <button disabled={code.length !== 4} className="primary-button full" onClick={unlock}>
          Odblokuj panel
        </button>
        <small className="lock-note">
          <ShieldCheck size={14} /> Dostęp wyłącznie dla organizatora
        </small>
      </div>
    </section>
  );
}

export function Admin({
  store: initialStore,
  tournaments: initialTournaments,
  activeTournament: initialActiveTournament,
  onSelectTournament,
  onLock,
}: {
  store: Store;
  tournaments: Tournament[];
  activeTournament: Tournament | null;
  onSelectTournament: (id: string) => void;
  onLock: () => void;
}) {
  const [tab, setTab] = useState<'turnieje' | 'ustawienia' | 'pole' | 'zawodnicy' | 'flighty' | 'rundy' | 'wyniki'>('turnieje');
  const [notice, setNotice] = useState('');
  const noticeTimer = useRef<number | null>(null);

  const [localStore, setLocalStore] = useState<Store>(initialStore);
  const [localTournaments, setLocalTournaments] = useState<Tournament[]>(initialTournaments);
  const [localActiveTournament, setLocalActiveTournament] = useState<Tournament | null>(initialActiveTournament);

  useEffect(() => {
    setLocalStore(initialStore);
  }, [initialStore]);

  useEffect(() => {
    setLocalTournaments(initialTournaments);
  }, [initialTournaments]);

  useEffect(() => {
    setLocalActiveTournament(initialActiveTournament);
  }, [initialActiveTournament]);

  const flash = (m: string) => {
    setNotice(m);
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(''), 1800);
  };

  useEffect(() => {
    return () => {
      if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    };
  }, []);

  const tabs: [typeof tab, string, React.ReactNode][] = [
    ['turnieje', 'Turnieje', <Trophy size={15} key="t" />],
    ['ustawienia', 'Ustawienia', <ShieldCheck size={15} key="f" />],
    ['pole', 'Pole', <BarChart3 size={15} key="a" />],
    ['zawodnicy', 'Zawodnicy', <Users size={15} key="b" />],
    ['flighty', 'Flighty', <Flag size={15} key="c" />],
    ['rundy', 'Rundy', <Layers size={15} key="e" />],
    ['wyniki', 'Korekta wyników', <Edit3 size={15} key="d" />],
  ];

  return (
    <section>
      <div className="section-intro">
        <div>
          <p className="eyebrow">
            <span /> STREFA CHRONIONA · DOSTĘP AKTYWNY
          </p>
          <h1>Panel administratora</h1>
          <p className="intro-copy">
            Zarządzaj turniejami, polem, bazą uczestników, flightami i wynikami z jednego centrum.
          </p>
        </div>
        <button className="secondary-button" onClick={onLock}>
          <LockKeyhole size={16} /> Zablokuj
        </button>
      </div>
      {notice && (
        <div className="notice toast-fixed">
          <Check size={16} />
          {notice}
        </div>
      )}
      <div className="admin-tabs">
        {tabs.map(([key, label, icon]) => (
          <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
            {icon}
            {label}
          </button>
        ))}
      </div>
      {tab === 'turnieje' && (
        <TournamentManager
          store={localStore}
          tournaments={localTournaments}
          activeTournament={localActiveTournament}
          onSelectTournament={(id) => {
            const found = localTournaments.find((t) => t.id === id) || null;
            setLocalActiveTournament(found);
            onSelectTournament(id);
          }}
          onUpdateTournaments={setLocalTournaments}
          onUpdateStore={setLocalStore}
          flash={flash}
        />
      )}
      {tab === 'ustawienia' && (
        <TournamentSettings
          store={localStore}
          activeTournament={localActiveTournament}
          onUpdateStore={setLocalStore}
          onUpdateTournaments={setLocalTournaments}
          flash={flash}
        />
      )}
      {tab === 'pole' && <CourseEditor store={localStore} onUpdateStore={setLocalStore} flash={flash} />}
      {tab === 'zawodnicy' && <PlayerManager store={localStore} onUpdateStore={setLocalStore} flash={flash} />}
      {tab === 'flighty' && (
        <FlightManager
          store={localStore}
          activeTournament={localActiveTournament}
          onUpdateStore={setLocalStore}
          flash={flash}
        />
      )}
      {tab === 'rundy' && (
        <RoundManager
          store={localStore}
          activeTournament={localActiveTournament}
          onUpdateStore={setLocalStore}
          flash={flash}
        />
      )}
      {tab === 'wyniki' && (
        <OverridePanel
          store={localStore}
          activeTournament={localActiveTournament}
          onUpdateStore={setLocalStore}
          flash={flash}
        />
      )}
    </section>
  );
}

function TournamentManager({
  store,
  tournaments,
  activeTournament,
  onSelectTournament,
  onUpdateTournaments,
  onUpdateStore,
  flash,
}: {
  store: Store;
  tournaments: Tournament[];
  activeTournament: Tournament | null;
  onSelectTournament: (id: string) => void;
  onUpdateTournaments: React.Dispatch<React.SetStateAction<Tournament[]>>;
  onUpdateStore: React.Dispatch<React.SetStateAction<Store>>;
  flash: FlashFn;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [courseName, setCourseName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [isLeague, setIsLeague] = useState(true);
  const [isPolishOpen, setIsPolishOpen] = useState(false);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setCourseName('');
    setDate(new Date().toISOString().slice(0, 10));
    setIsLeague(true);
    setIsPolishOpen(false);
  };

  const startEdit = (t: Tournament) => {
    setEditingId(t.id);
    setName(t.name);
    setCourseName(t.courseName ?? '');
    setDate(t.date);
    setIsLeague(t.isLeague);
    setIsPolishOpen(t.isPolishOpen);
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;

    const trimmedName = name.trim();
    const trimmedCourse = courseName.trim() || undefined;

    if (editingId) {
      onUpdateTournaments((prev) =>
        prev.map((t) =>
          t.id === editingId
            ? { ...t, name: trimmedName, courseName: trimmedCourse, date, isLeague, isPolishOpen }
            : t
        )
      );

      if (activeTournament?.id === editingId) {
        onUpdateStore((prev) => ({ ...prev, tournamentName: trimmedName }));
      }

      try {
        await updateTournament(editingId, {
          name: trimmedName,
          courseName: trimmedCourse,
          date,
          isLeague,
          isPolishOpen,
        });
        flash('Zaktualizowano dane turnieju.');
      } catch {
        flash('Błąd zapisu turnieju.');
      }
      resetForm();
    } else {
      try {
        const created = await createTournament({
          name: trimmedName,
          courseName: trimmedCourse,
          date,
          isLeague,
          isPolishOpen,
        });

        onUpdateTournaments((prev) => [...prev, created]);
        onUpdateStore((prev) => ({ ...prev, tournamentName: created.name }));
        onSelectTournament(created.id);
        flash('Utworzono i aktywowano nowy turniej.');
        resetForm();
      } catch {
        flash('Błąd tworzenia turnieju.');
      }
    }
  };

  const handleComplete = async (t: Tournament) => {
    const confirm = window.confirm(
      `Czy na pewno chcesz ZAKOŃCZYĆ turniej "${t.name}"?\n\nZostaną obliczone oficjalne punkty ligowe dla zawodników, turniej zostanie zamknięty i trafi do archiwum.`
    );
    if (!confirm) return;

    try {
      const holesR1 = store.holesByRound[1];
      const holesR2 = store.holesByRound[2];
      const activePlayers = store.players.filter((p) => p.isActive !== false);

      const sorted = [...activePlayers]
        .map((p) => ({
          id: p.id,
          strokes: combinedRelative(p, holesR1, holesR2),
          category: p.category,
          club: p.club,
        }))
        .sort((a, b) => a.strokes - b.strokes);

      const rankedPlayers: { id: string; rank: number; strokes: number; category: any; club?: string }[] = [];
      let currentRank = 1;
      sorted.forEach((p, idx) => {
        if (idx > 0 && p.strokes > sorted[idx - 1].strokes) {
          currentRank = idx + 1;
        }
        rankedPlayers.push({ ...p, rank: currentRank });
      });

      const pointsResult = calculateTournamentPoints(rankedPlayers);

      onUpdateTournaments((prev) =>
        prev.map((item) => (item.id === t.id ? { ...item, status: 'completed' } : item))
      );

      await completeTournament(t.id, pointsResult);
      flash('Turniej zakończony i przesłany do rankingu!');
    } catch (err) {
      console.error(err);
      flash('Błąd podczas kończenia turnieju.');
    }
  };

  const handleDeleteTournament = async (t: Tournament) => {
    const confirm = window.confirm(
      `CZY NA PEWNO chcesz USUNĄĆ turniej "${t.name}"?\n\nTej operacji nie można cofnąć.`
    );
    if (!confirm) return;

    try {
      await deleteTournament(t.id);
      onUpdateTournaments((prev) => prev.filter((item) => item.id !== t.id));
      flash('Turniej został usunięty.');
    } catch (err) {
      console.error(err);
      flash('Błąd podczas usuwania turnieju.');
    }
  };

  return (
    <div className="management-grid">
      <div className="admin-panel compact">
        <p className="eyebrow">
          <span /> {editingId ? 'EDYCJA TURNIEJU' : 'NOWY TURNIEJ LUB SPOTKANIE'}
        </p>
        <h2>{editingId ? 'Edytuj parametry turnieju' : 'Utwórz zawody'}</h2>
        <div className="form-field">
          <label className="form-field-label">Nazwa turnieju</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="np. PFFG Cup"
          />
        </div>
        <div className="form-field">
          <label className="form-field-label">Nazwa pola / lokalizacja</label>
          <input
            value={courseName}
            onChange={(e) => setCourseName(e.target.value)}
            placeholder="np. Pole Golfowe"
          />
        </div>
        <div className="form-field">
          <label className="form-field-label">Data</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label className="amateur-toggle">
            <input
              type="checkbox"
              checked={isLeague}
              onChange={(e) => setIsLeague(e.target.checked)}
            />
            <span>Zaliczany do Oficjalnej Ligi PFFG</span>
          </label>
        </div>
        <div className="form-field">
          <label className="amateur-toggle">
            <input
              type="checkbox"
              checked={isPolishOpen}
              onChange={(e) => setIsPolishOpen(e.target.checked)}
            />
            <span>Mistrzostwa Polski (Polish Open)</span>
          </label>
        </div>
        <div className="form-actions">
          <button className="primary-button" onClick={handleSubmit}>
            {editingId ? <Save size={16} /> : <Plus size={16} />}
            {editingId ? 'Zapisz zmiany turnieju' : 'Utwórz i aktywuj'}
          </button>
          {editingId && (
            <button className="secondary-button" onClick={resetForm}>
              Anuluj
            </button>
          )}
        </div>
      </div>

      <div className="admin-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">
              <span /> ZARZĄDZANIE TURNIEJAMI
            </p>
            <h2>Wszystkie turnieje ({tournaments.length})</h2>
          </div>
          <Trophy size={20} className="muted-icon" />
        </div>
        <div className="management-list">
          {tournaments.map((t) => {
            const isActive = activeTournament?.id === t.id;
            const isCompleted = t.status === 'completed';
            return (
              <div
                className="management-row"
                key={t.id}
                style={{
                  borderLeft: isActive ? '4px solid #10b981' : '4px solid transparent',
                  background: isActive ? '#f0fdf4' : '#ffffff',
                }}
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {t.isLeague ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        LIGA PFFG
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                        TOWARZYSKI
                      </span>
                    )}
                    {t.isPolishOpen && (
                      <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        POLISH OPEN
                      </span>
                    )}
                    {isCompleted ? (
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded">
                        ZAKOŃCZONY
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded">
                        AKTYWNY W PODGLĄDZIE
                      </span>
                    )}
                  </div>
                  <b>{t.name}</b>
                  <small>
                    <Calendar size={12} className="inline mr-1" /> {t.date} {t.courseName ? `· ${t.courseName}` : ''}
                  </small>
                </div>

                <div className="row-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {!isActive && (
                    <button
                      className="secondary-button"
                      style={{ padding: '4px 10px', fontSize: '12px' }}
                      onClick={() => onSelectTournament(t.id)}
                    >
                      Wybierz do podglądu
                    </button>
                  )}
                  <button
                    className="secondary-button"
                    style={{ padding: '4px 8px', fontSize: '12px' }}
                    onClick={() => startEdit(t)}
                    title="Edytuj dane turnieju"
                  >
                    <Edit3 size={13} />
                  </button>
                  {!isCompleted && t.isLeague && (
                    <button
                      className="primary-button"
                      style={{ padding: '4px 10px', fontSize: '12px', background: '#0284c7' }}
                      onClick={() => handleComplete(t)}
                      title="Zakończ turniej i wyślij punkty do rankingu"
                    >
                      <CheckCircle2 size={14} className="inline mr-1" /> Zakończ turniej
                    </button>
                  )}
                  <button
                    className="secondary-button"
                    style={{ padding: '4px 8px', fontSize: '12px', borderColor: '#fca5a5', color: '#dc2626', background: '#fef2f2' }}
                    onClick={() => handleDeleteTournament(t)}
                    title="Usuń turniej"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TournamentSettings({
  store,
  activeTournament,
  onUpdateStore,
  onUpdateTournaments,
  flash,
}: {
  store: Store;
  activeTournament: Tournament | null;
  onUpdateStore: React.Dispatch<React.SetStateAction<Store>>;
  onUpdateTournaments: React.Dispatch<React.SetStateAction<Tournament[]>>;
  flash: FlashFn;
}) {
  const [name, setName] = useState(store.tournamentName);
  const [round1Course, setRound1Course] = useState(store.round1CourseId ?? '');
  const [round2Course, setRound2Course] = useState(store.round2CourseId ?? '');

  useEffect(() => {
    setName(store.tournamentName);
    setRound1Course(store.round1CourseId ?? '');
    setRound2Course(store.round2CourseId ?? '');
  }, [store.tournamentName, store.round1CourseId, store.round2CourseId]);

  const saveName = async () => {
    const val = name.trim() || 'Mistrzostwa Polski';

    onUpdateStore((prev) => ({ ...prev, tournamentName: val }));
    if (activeTournament) {
      onUpdateTournaments((prev) =>
        prev.map((t) => (t.id === activeTournament.id ? { ...t, name: val } : t))
      );
    }

    try {
      await setTournamentName(val, activeTournament?.id);
      flash('Nazwa turnieju zapisana.');
    } catch {
      flash('Błąd zapisu nazwy.');
    }
  };

  const changeRound1Course = async (id: string) => {
    setRound1Course(id);
    onUpdateStore((prev) => ({ ...prev, round1CourseId: id || undefined }));
    try {
      await setRoundCourse(1, id || null, activeTournament?.id);
      flash('Kurs Rundy 1 przypisany.');
    } catch {
      flash('Błąd przypisania kursu.');
    }
  };

  const changeRound2Course = async (id: string) => {
    setRound2Course(id);
    onUpdateStore((prev) => ({ ...prev, round2CourseId: id || undefined }));
    try {
      await setRoundCourse(2, id || null, activeTournament?.id);
      flash('Kurs Rundy 2 przypisany.');
    } catch {
      flash('Błąd przypisania kursu.');
    }
  };

  return (
    <div className="admin-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">
            <span /> USTAWIENIA TURNIEJU
          </p>
          <h2>Konfiguracja główna</h2>
          <p>Edytuj nazwę turnieju oraz przypisz kursy do rund.</p>
        </div>
        <ShieldCheck size={20} className="muted-icon" />
      </div>

      <div className="form-field">
        <label className="form-field-label">NAZWA TURNIEJU</label>
        <div className="inline-edit-row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveName()}
            placeholder="Mistrzostwa Polski"
          />
          <button className="primary-button" onClick={saveName}>
            <Save size={16} /> Zapisz
          </button>
        </div>
      </div>

      <div className="course-assignment-grid">
        <div className="form-field">
          <label className="form-field-label">KURS RUNDY 1</label>
          <select value={round1Course} onChange={(e) => changeRound1Course(e.target.value)}>
            <option value="">— Wybierz kurs —</option>
            {store.courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label className="form-field-label">KURS RUNDY 2</label>
          <select value={round2Course} onChange={(e) => changeRound2Course(e.target.value)}>
            <option value="">— Jak w Rundzie 1 —</option>
            {store.courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

function CourseEditor({
  store,
  onUpdateStore,
  flash,
}: {
  store: Store;
  onUpdateStore: React.Dispatch<React.SetStateAction<Store>>;
  flash: FlashFn;
}) {
  const [selectedCourseId, setSelectedCourseId] = useState(store.round1CourseId ?? store.courses[0]?.id ?? '');
  const [selectedHole, setSelectedHole] = useState(1);
  const [newCourseName, setNewCourseName] = useState('');

  const course = store.courses.find((c) => c.id === selectedCourseId);
  const holes = store.holesByCourse[selectedCourseId] ?? [];
  const hole = holes[selectedHole - 1];

  const save = async (field: 'par' | 'meters', value: number) => {
    onUpdateStore((prev) => {
      const currentHoles = prev.holesByCourse[selectedCourseId] || [];
      const updated = currentHoles.map((h) => (h.number === selectedHole ? { ...h, [field]: value } : h));
      return {
        ...prev,
        holesByCourse: {
          ...prev.holesByCourse,
          [selectedCourseId]: updated,
        },
      };
    });

    try {
      await updateCourseHole(selectedCourseId, selectedHole, field, value);
      flash(`Dołek ${selectedHole} zapisany.`);
    } catch {
      flash('Błąd zapisu dołka.');
    }
  };

  const addCourse = async () => {
    if (!newCourseName.trim()) return;
    try {
      const created = await createCourse(newCourseName.trim());
      onUpdateStore((prev) => ({
        ...prev,
        courses: [...prev.courses, created],
        holesByCourse: { ...prev.holesByCourse, [created.id]: [] },
      }));
      setSelectedCourseId(created.id);
      setNewCourseName('');
      flash('Kurs utworzony.');
    } catch {
      flash('Błąd tworzenia kursu.');
    }
  };

  const removeCourse = async (id: string) => {
    onUpdateStore((prev) => ({
      ...prev,
      courses: prev.courses.filter((c) => c.id !== id),
    }));
    try {
      await deleteCourse(id);
      if (selectedCourseId === id) {
        setSelectedCourseId(store.courses.find((c) => c.id !== id)?.id ?? '');
      }
      flash('Kurs usunięty.');
    } catch {
      flash('Błąd usuwania kursu.');
    }
  };

  return (
    <div className="admin-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">
            <span /> EDYTOR POLA · WIELOKURSOWY
          </p>
          <h2>Konfiguracja kursów</h2>
          <p>Twórz i edytuj niezależne układy 18 dołków dla każdej rundy.</p>
        </div>
        <div className="par-total">
          <small>PAR KURSU</small>
          <strong>{totalPar(holes)}</strong>
        </div>
      </div>

      <div className="course-manager-bar">
        <div className="course-tabs">
          {store.courses.map((c) => (
            <div key={c.id} className="course-tab-wrapper">
              <button
                className={selectedCourseId === c.id ? 'active' : ''}
                onClick={() => setSelectedCourseId(c.id)}
              >
                {c.name}
              </button>
              {store.courses.length > 1 && (
                <button className="course-delete-btn" onClick={() => removeCourse(c.id)} title="Usuń kurs">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="course-add-inline">
          <input
            value={newCourseName}
            onChange={(e) => setNewCourseName(e.target.value)}
            placeholder="Nazwa nowego kursu"
            onKeyDown={(e) => e.key === 'Enter' && addCourse()}
          />
          <button className="secondary-button" onClick={addCourse}>
            <Plus size={15} /> Dodaj kurs
          </button>
        </div>
      </div>

      {course && hole && (
        <>
          <div className="hole-selector">
            {holes.map((h) => (
              <button
                key={h.number}
                className={selectedHole === h.number ? 'active' : ''}
                onClick={() => setSelectedHole(h.number)}
              >
                {h.number}
              </button>
            ))}
          </div>
          <div className="course-form">
            <label>
              NUMER DOŁKA
              <select value={selectedHole} onChange={(e) => setSelectedHole(Number(e.target.value))}>
                {holes.map((h) => (
                  <option key={h.number} value={h.number}>
                    Dołek {h.number}
                  </option>
                ))}
              </select>
            </label>
            <label>
              PAR
              <select value={hole.par} onChange={(e) => save('par', Number(e.target.value))}>
                <option value={3}>3</option>
                <option value={4}>4</option>
                <option value={5}>5</option>
              </select>
            </label>
            <label>
              DYSTANS <span>(METRY)</span>
              <input
                type="number"
                min={0}
                max={999}
                value={hole.meters}
                onChange={(e) => save('meters', Math.max(0, Number(e.target.value)))}
              />
            </label>
          </div>
          <div className="course-summary">
            <Flag size={17} />
            <span>
              {course.name} · Dołek {hole.number} · Par {hole.par}
            </span>
            <b>{hole.meters} m</b>
          </div>
        </>
      )}
    </div>
  );
}

function PlayerManager({
  store,
  onUpdateStore,
  flash,
}: {
  store: Store;
  onUpdateStore: React.Dispatch<React.SetStateAction<Store>>;
  flash: FlashFn;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('Men');
  const [avatar, setAvatar] = useState('');
  const [club, setClub] = useState('');
  const [ballModel, setBallModel] = useState('');
  const [city, setCity] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female'>('Male');
  const [preferredFoot, setPreferredFoot] = useState<'Right' | 'Left'>('Right');
  const [birthDate, setBirthDate] = useState('');
  const [email, setEmail] = useState('');
  const [flag, setFlag] = useState('PL');
  const [flagImage, setFlagImage] = useState('');
  const [isAmateur, setIsAmateur] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const flagFileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setName('');
    setCategory('Men');
    setAvatar('');
    setClub('');
    setBallModel('');
    setCity('');
    setGender('Male');
    setPreferredFoot('Right');
    setBirthDate('');
    setEmail('');
    setFlag('PL');
    setFlagImage('');
    setIsAmateur(false);
    setIsActive(true);
    setEditing(null);
  };

  const handleFileUpload = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setAvatar(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleFlagFileUpload = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setFlagImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    if (!name.trim()) return;
    const playerData: any = {
      name: name.trim(),
      category,
      avatar: avatar.trim() || undefined,
      club: club.trim() || undefined,
      ball_model: ballModel.trim() || undefined,
      city: city.trim() || undefined,
      gender,
      preferred_foot: preferredFoot,
      birth_date: birthDate || undefined,
      email: email.trim() || undefined,
      flag,
      flagImage: flagImage.trim() || undefined,
      isAmateur,
      isActive,
    };

    try {
      if (editing) {
        onUpdateStore((prev) => ({
          ...prev,
          players: prev.players.map((p) => (p.id === editing ? { ...p, ...playerData } : p)),
        }));
        await updatePlayer(editing, playerData);
        flash('Dane zawodnika zaktualizowane.');
      } else {
        const added = await addPlayer(playerData);
        onUpdateStore((prev) => ({
          ...prev,
          players: [
            ...prev.players,
            added || {
              id: `temp-${Date.now()}`,
              scores: { 1: Array(18).fill(0), 2: Array(18).fill(0) },
              flightId: { 1: null, 2: null },
              ...playerData,
            },
          ],
        }));
        flash('Zawodnik dodany do bazy.');
      }
      reset();
    } catch {
      flash('Błąd zapisu zawodnika.');
    }
  };

  const handleToggleActive = async (p: Player) => {
    const nextState = p.isActive === false ? true : false;

    onUpdateStore((prev) => ({
      ...prev,
      players: prev.players.map((item) => (item.id === p.id ? { ...item, isActive: nextState } : item)),
    }));

    try {
      await togglePlayerActive(p.id, nextState);
      flash(nextState ? `${p.name} dodany do turnieju.` : `${p.name} przeniesiony do pauzy.`);
    } catch {
      flash('Błąd zmiany statusu.');
    }
  };

  const remove = async (id: string) => {
    onUpdateStore((prev) => ({
      ...prev,
      players: prev.players.filter((p) => p.id !== id),
    }));
    try {
      await deletePlayer(id);
      flash('Zawodnik usunięty z bazy.');
    } catch {
      flash('Błąd usuwania.');
    }
  };

  const startEdit = (p: any) => {
    setEditing(p.id);
    setName(p.name);
    setCategory(p.category);
    setAvatar(p.avatar ?? '');
    setClub(p.club ?? '');
    setBallModel(p.ball_model ?? p.ballModel ?? '');
    setCity(p.city ?? '');
    setGender(p.gender ?? 'Male');
    setPreferredFoot(p.preferred_foot ?? p.preferredFoot ?? 'Right');
    setBirthDate(p.birth_date ?? p.birthDate ?? '');
    setEmail(p.email ?? '');
    setFlag(p.flag);
    setFlagImage(p.flagImage ?? '');
    setIsAmateur(p.isAmateur);
    setIsActive(p.isActive !== false);
  };

  const filteredAndSortedPlayers = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const filtered = store.players.filter((p: any) => {
      if (!query) return true;
      return (
        p.name.toLowerCase().includes(query) ||
        (p.club && p.club.toLowerCase().includes(query)) ||
        (p.email && p.email.toLowerCase().includes(query)) ||
        (p.city && p.city.toLowerCase().includes(query)) ||
        p.category.toLowerCase().includes(query)
      );
    });

    return filtered.sort((a, b) => {
      const aActive = a.isActive !== false ? 1 : 0;
      const bActive = b.isActive !== false ? 1 : 0;
      if (aActive !== bActive) {
        return bActive - aActive;
      }
      return a.name.localeCompare(b.name);
    });
  }, [store.players, searchQuery]);

  return (
    <div className="management-grid">
      <div className="admin-panel compact">
        <p className="eyebrow">
          <span /> BAZA ZAWODNIKÓW & PROFILE
        </p>
        <h2>{editing ? 'Edytuj zawodnika' : 'Dodaj zawodnika'}</h2>
        
        <div className="form-field">
          <label className="form-field-label">Imię i nazwisko *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="np. Jan Kowalski"
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </div>

        <div className="form-field">
          <label className="form-field-label">Adres e-mail konta</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="gracz@domena.pl"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div className="form-field">
            <label className="form-field-label">Płeć</label>
            <select value={gender} onChange={(e) => setGender(e.target.value as any)}>
              <option value="Male">Mężczyzna</option>
              <option value="Female">Kobieta</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-field-label">Noga</label>
            <select value={preferredFoot} onChange={(e) => setPreferredFoot(e.target.value as any)}>
              <option value="Right">Prawa</option>
              <option value="Left">Lewa</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div className="form-field">
            <label className="form-field-label">Data urodzenia</label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label className="form-field-label">Miasto</label>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="np. Warszawa"
            />
          </div>
        </div>

        <div className="form-field">
          <label className="form-field-label">Model piłki meczowej</label>
          <input
            value={ballModel}
            onChange={(e) => setBallModel(e.target.value)}
            placeholder="np. Adidas Teamgeist / Jabulani"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div className="form-field">
            <label className="form-field-label">Kategoria</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label className="form-field-label">Flaga (kraj)</label>
            <select value={flag} onChange={(e) => setFlag(e.target.value)}>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {flagEmoji(c.code)} {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-field">
          <label className="form-field-label">Klub</label>
          <input
            value={club}
            onChange={(e) => setClub(e.target.value)}
            placeholder="np. KS Footgolf"
          />
        </div>

        <div className="form-field">
          <label className="form-field-label">Zdjęcie profilowe</label>
          <div className="avatar-upload-row">
            {avatar && <img src={avatar} alt="avatar" className="avatar-preview" />}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleFileUpload(e.target.files?.[0])}
              className="file-input"
            />
            <button className="secondary-button" onClick={() => fileInputRef.current?.click()}>
              <ImageIcon size={15} /> Wybierz plik
            </button>
            {avatar && (
              <button className="secondary-button" onClick={() => setAvatar('')}>
                Wyczyść
              </button>
            )}
          </div>
        </div>

        <div className="form-field">
          <label className="amateur-toggle">
            <input
              type="checkbox"
              checked={isAmateur}
              onChange={(e) => setIsAmateur(e.target.checked)}
            />
            <span>Amator (AM)</span>
          </label>
        </div>

        <div className="form-field">
          <label className="amateur-toggle">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <span>Bierze udział w tym turnieju</span>
          </label>
        </div>

        <div className="form-actions">
          <button className="primary-button" onClick={submit}>
            {editing ? <Save size={16} /> : <UserPlus size={16} />}
            {editing ? 'Zapisz zmiany profilu' : 'Dodaj zawodnika'}
          </button>
          {editing && (
            <button className="secondary-button" onClick={reset}>
              Anuluj
            </button>
          )}
        </div>
      </div>

      <div className="admin-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">
              <span /> REJESTR UCZESTNIKÓW & PROFILE
            </p>
            <h2>{store.players.length} zawodników w bazie</h2>
          </div>
          <Users size={20} className="muted-icon" />
        </div>

        <div style={{ marginBottom: '12px', position: 'relative' }}>
          <div style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
            <Search size={15} />
          </div>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Szukaj zawodnika po nazwisku, klubie, emailu, mieście..."
            style={{ width: '100%', paddingLeft: '34px', fontSize: '13px' }}
          />
        </div>

        <div className="management-list">
          {filteredAndSortedPlayers.map((p: any) => {
            const active = p.isActive !== false;
            return (
              <div
                className="management-row"
                key={p.id}
                style={{ opacity: active ? 1 : 0.55 }}
              >
                {p.avatar ? (
                  <img src={p.avatar} alt={p.name} className="avatar avatar-img" />
                ) : (
                  <span className="avatar">{initials(p.name)}</span>
                )}
                <div>
                  <b>
                    {p.flagImage ? (
                      <img src={p.flagImage} alt={p.flag} className="flag-img-inline" />
                    ) : (
                      <span className="flag-emoji">{flagEmoji(p.flag)}</span>
                    )}
                    {p.name}
                    {p.isAmateur && <span className="am-badge">AM</span>}
                  </b>
                  <small>
                    {p.club ?? 'Bez klubu'} · {p.category} {p.city ? `· ${p.city}` : ''}
                  </small>
                  {p.ball_model && (
                    <small style={{ color: '#0284c7', display: 'block', fontSize: '11px' }}>
                      ⚽ Piłka: {p.ball_model}
                    </small>
                  )}
                </div>

                <div className="row-actions" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <button
                    onClick={() => handleToggleActive(p)}
                    title={active ? 'Wyłącz z tego turnieju' : 'Włącz do tego turnieju'}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: '800',
                      border: 'none',
                      cursor: 'pointer',
                      background: active ? '#dcfce7' : '#f1f5f9',
                      color: active ? '#15803d' : '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Power size={12} />
                    {active ? 'W TURNIEJU' : 'PAUZA'}
                  </button>

                  <button onClick={() => startEdit(p)} title="Edytuj profil gracza">
                    <Edit3 size={15} />
                  </button>
                  <button onClick={() => remove(p.id)} title="Usuń z bazy całkowicie">
                    <X size={15} />
                  </button>
                </div>
              </div>
            );
          })}
          {filteredAndSortedPlayers.length === 0 && (
            <div className="empty-state">Brak zawodników pasujących do wyszukiwania.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function FlightManager({
  store,
  activeTournament,
  onUpdateStore,
  flash,
}: {
  store: Store;
  activeTournament: Tournament | null;
  onUpdateStore: React.Dispatch<React.SetStateAction<Store>>;
  flash: FlashFn;
}) {
  const [round, setRound] = useState<Round>(1);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [startHole, setStartHole] = useState(1);
  const [draggedPlayerId, setDraggedPlayerId] = useState<string | null>(null);
  const [dragOverFlightId, setDragOverFlightId] = useState<string | null>(null);

  const holesR1 = store.holesByRound[1];
  const holesR2 = store.holesByRound[2];

  const roundFlights = store.flights.filter((f) => f.round === round);
  const allFlightIdsInRound = useMemo(() => roundFlights.map((f) => f.id), [roundFlights]);
  const activePlayers = useMemo(
    () => store.players.filter((p) => p.isActive !== false),
    [store.players]
  );

  const rankedPlayers = useMemo(() => {
    return [...activePlayers].sort((a, b) => {
      const strokesA = combinedRelative(a, holesR1, holesR2);
      const strokesB = combinedRelative(b, holesR1, holesR2);
      return strokesA - strokesB;
    });
  }, [activePlayers, holesR1, holesR2]);

  const unassignedPlayers = useMemo(() => {
    return rankedPlayers.filter((p) => !p.flightId[round]);
  }, [rankedPlayers, round]);

  const create = async () => {
    if (!name.trim()) return;
    const fallbackId = `flight-${Date.now()}`;
    const generatedCode = code.length === 4 ? code : String(Math.floor(1000 + Math.random() * 9000));

    onUpdateStore((prev) => ({
      ...prev,
      flights: [
        ...prev.flights,
        {
          id: fallbackId,
          name: name.trim(),
          code: generatedCode,
          round,
          startHole,
          playerIds: [],
        },
      ],
    }));

    flash('Flight utworzony.');
    setName('');
    setCode('');
    setStartHole(1);

    try {
      const created = await createFlight({
        name: name.trim(),
        round,
        startHole,
        code: generatedCode,
        tournamentId: activeTournament?.id,
      });

      if (created?.id) {
        onUpdateStore((prev) => ({
          ...prev,
          flights: prev.flights.map((f) => (f.id === fallbackId ? { ...f, id: created.id } : f)),
        }));
      }
    } catch {
      flash('Błąd tworzenia flightu w bazie.');
    }
  };

  const editFlight = (flight: Flight) => {
    const nextName = window.prompt('Nazwa flightu', flight.name);
    const nextCode = window.prompt('Kod Flightu (4 cyfry)', flight.code);
    const nextStart = window.prompt('Dołek startowy (shotgun)', String(flight.startHole ?? 1));
    if (!nextName?.trim() || !nextCode || nextCode.length !== 4) return;

    const parsedStart = Math.max(1, Math.min(18, Number(nextStart) || 1));

    onUpdateStore((prev) => ({
      ...prev,
      flights: prev.flights.map((f) =>
        f.id === flight.id ? { ...f, name: nextName.trim(), code: nextCode, startHole: parsedStart } : f
      ),
    }));

    updateFlight(flight.id, {
      name: nextName.trim(),
      code: nextCode,
      startHole: parsedStart,
    })
      .then(() => flash('Flight zmieniony.'))
      .catch(() => flash('Błąd edycji flightu.'));
  };

  const removeFlight = async (id: string) => {
    onUpdateStore((prev) => ({
      ...prev,
      flights: prev.flights.filter((f) => f.id !== id),
      players: prev.players.map((p) =>
        p.flightId[round] === id ? { ...p, flightId: { ...p.flightId, [round]: null } } : p
      ),
    }));

    try {
      await deleteFlight(id);
      flash('Flight usunięty.');
    } catch {
      flash('Błąd usuwania.');
    }
  };

  const assignPlayer = async (playerId: string, targetFlightId: string | null) => {
    onUpdateStore((prev) => ({
      ...prev,
      players: prev.players.map((p) =>
        p.id === playerId ? { ...p, flightId: { ...p.flightId, [round]: targetFlightId } } : p
      ),
    }));

    try {
      await assignPlayerToFlight(playerId, targetFlightId, allFlightIdsInRound, activeTournament?.id);
      flash(targetFlightId ? 'Zawodnik przeniesiony do grupy.' : 'Zawodnik cofnięty do puli.');
    } catch (err) {
      console.error(err);
      flash('Błąd zapisu przydziału w bazie.');
    }
  };

  const handleDragStart = (e: React.DragEvent, playerId: string) => {
    e.dataTransfer.setData('text/plain', playerId);
    setDraggedPlayerId(playerId);
  };

  const handleDragOver = (e: React.DragEvent, flightId: string) => {
    e.preventDefault();
    setDragOverFlightId(flightId);
  };

  const handleDropOnFlight = (e: React.DragEvent, flightId: string) => {
    e.preventDefault();
    const playerId = e.dataTransfer.getData('text/plain') || draggedPlayerId;
    if (playerId) {
      assignPlayer(playerId, flightId);
    }
    setDraggedPlayerId(null);
    setDragOverFlightId(null);
  };

  const handleDropUnassign = (e: React.DragEvent) => {
    e.preventDefault();
    const playerId = e.dataTransfer.getData('text/plain') || draggedPlayerId;
    if (playerId) {
      assignPlayer(playerId, null);
    }
    setDraggedPlayerId(null);
    setDragOverFlightId(null);
  };

  return (
    <div className="management-grid">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="admin-panel compact">
          <p className="eyebrow">
            <span /> NOWY FLIGHT
          </p>
          <h2>Utwórz grupę</h2>
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
          <div className="form-field">
            <label className="form-field-label">Nazwa flightu</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="np. Flight A"
            />
          </div>
          <div className="form-field">
            <label className="form-field-label">Kod Flightu (4 cyfry)</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="Auto-generowanie"
            />
          </div>
          <div className="form-field">
            <label className="form-field-label">
              Dołek startowy <span>(Shotgun)</span>
            </label>
            <input
              type="number"
              min={1}
              max={18}
              value={startHole}
              onChange={(e) => setStartHole(Math.max(1, Math.min(18, Number(e.target.value))))}
            />
          </div>
          <div className="form-actions">
            <button className="primary-button" onClick={create}>
              <Plus size={16} /> Utwórz flight
            </button>
          </div>
        </div>

        <div
          className="admin-panel compact"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDropUnassign}
          style={{
            border: dragOverFlightId === 'unassigned' ? '2px dashed #0284c7' : undefined,
            background: dragOverFlightId === 'unassigned' ? '#f0f9ff' : undefined,
          }}
        >
          <div className="panel-heading" style={{ marginBottom: '10px' }}>
            <div>
              <p className="eyebrow">
                <span /> DOSTĘPNI ZAWODNICY ({unassignedPlayers.length})
              </p>
              <h2 style={{ fontSize: '15px' }}>Chwyć i przeciągnij do flightu</h2>
            </div>
            <Users size={16} className="muted-icon" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '420px', overflowY: 'auto' }}>
            {unassignedPlayers.map((p, idx) => {
              const rel = combinedRelative(p, holesR1, holesR2);
              return (
                <div
                  key={p.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, p.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '12px',
                    cursor: 'grab',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <GripVertical size={14} style={{ color: '#94a3b8' }} />
                    <span style={{ fontWeight: 800, color: '#64748b', fontSize: '11px', width: '16px' }}>{idx + 1}.</span>
                    {p.avatar ? (
                      <img src={p.avatar} alt={p.name} style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800 }}>
                        {initials(p.name)}
                      </span>
                    )}
                    <b>
                      {p.flagImage ? (
                        <img src={p.flagImage} alt={p.flag} style={{ width: '14px', height: '10px', display: 'inline-block', marginRight: '4px', verticalAlign: 'middle' }} />
                      ) : (
                        <span style={{ marginRight: '4px' }}>{flagEmoji(p.flag)}</span>
                      )}
                      {p.name}
                    </b>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>({p.category})</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontWeight: 800, fontSize: '11px', color: rel < 0 ? '#10b981' : rel > 0 ? '#ef4444' : '#64748b' }}>
                      {rel > 0 ? `+${rel}` : rel}
                    </span>
                  </div>
                </div>
              );
            })}
            {unassignedPlayers.length === 0 && (
              <div className="empty-state" style={{ padding: '16px', fontSize: '12px' }}>
                Wszyscy aktywni zawodnicy mają przypisany flight w Rundzie {round}.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flight-list">
        {roundFlights.map((flight) => {
          const flightMembers = activePlayers.filter((p) => p.flightId[round] === flight.id);
          const isOverThisFlight = dragOverFlightId === flight.id;

          return (
            <div
              className="flight-card"
              key={flight.id}
              onDragOver={(e) => handleDragOver(e, flight.id)}
              onDragLeave={() => setDragOverFlightId(null)}
              onDrop={(e) => handleDropOnFlight(e, flight.id)}
              style={{
                padding: '14px',
                border: isOverThisFlight ? '2px dashed #10b981' : '1px solid #cbd5e1',
                background: isOverThisFlight ? '#f0fdf4' : '#ffffff',
                transition: 'all 0.15s ease',
              }}
            >
              <div className="flight-card-head" style={{ marginBottom: '12px' }}>
                <div>
                  <h2 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {flight.name}
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>({flightMembers.length} graczy)</span>
                  </h2>
                  <p>
                    KOD <strong>{flight.code}</strong>
                  </p>
                  <p className="flight-start">
                    <MapPin size={12} /> Start dołek {flight.startHole ?? 1}
                  </p>
                </div>
                <div className="row-actions">
                  <button onClick={() => editFlight(flight)} title="Edytuj flight">
                    <Edit3 size={15} />
                  </button>
                  <button onClick={() => removeFlight(flight.id)} title="Usuń flight">
                    <X size={15} />
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px', minHeight: '40px' }}>
                {flightMembers.map((p) => {
                  const rel = combinedRelative(p, holesR1, holesR2);
                  return (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, p.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        fontSize: '12px',
                        cursor: 'grab',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <GripVertical size={13} style={{ color: '#94a3b8' }} />
                        {p.avatar ? (
                          <img src={p.avatar} alt={p.name} style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 800 }}>
                            {initials(p.name)}
                          </span>
                        )}
                        <b>
                          {p.flagImage ? (
                            <img src={p.flagImage} alt={p.flag} style={{ width: '14px', height: '10px', display: 'inline-block', marginRight: '4px', verticalAlign: 'middle' }} />
                          ) : (
                            <span style={{ marginRight: '4px' }}>{flagEmoji(p.flag)}</span>
                          )}
                          {p.name}
                        </b>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: rel < 0 ? '#10b981' : rel > 0 ? '#ef4444' : '#64748b' }}>
                          ({rel > 0 ? `+${rel}` : rel})
                        </span>
                      </div>
                      <button
                        onClick={() => assignPlayer(p.id, null)}
                        title="Usuń z tego flightu"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          padding: '2px',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <UserMinus size={14} />
                      </button>
                    </div>
                  );
                })}
                {flightMembers.length === 0 && (
                  <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', padding: '10px', textAlign: 'center', border: '1px dashed #e2e8f0', borderRadius: '6px' }}>
                    Przeciągnij zawodnika tutaj...
                  </div>
                )}
              </div>

              {unassignedPlayers.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        assignPlayer(e.target.value, flight.id);
                        e.target.value = '';
                      }
                    }}
                    style={{ fontSize: '12px', padding: '6px 8px', width: '100%', background: '#f0fdf4', borderColor: '#86efac' }}
                  >
                    <option value="" disabled>
                      + Przypisz gracza z listy...
                    </option>
                    {unassignedPlayers.map((p) => {
                      const rel = combinedRelative(p, holesR1, holesR2);
                      return (
                        <option key={p.id} value={p.id}>
                          {p.name} ({rel > 0 ? `+${rel}` : rel}) · {p.category}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>
          );
        })}
        {roundFlights.length === 0 && (
          <div className="empty-state">Brak flightów w Rundzie {round}. Utwórz grupę po lewej stronie.</div>
        )}
      </div>
    </div>
  );
}

function RoundManager({
  store,
  activeTournament,
  onUpdateStore,
  flash,
}: {
  store: Store;
  activeTournament: Tournament | null;
  onUpdateStore: React.Dispatch<React.SetStateAction<Store>>;
  flash: FlashFn;
}) {
  const [groupSize, setGroupSize] = useState(4);
  const holesR1 = store.holesByRound[1];
  const holesR2 = store.holesByRound[2];

  const activePlayers = useMemo(
    () => store.players.filter((p) => p.isActive !== false),
    [store.players]
  );

  const allR1Completed = useMemo(
    () =>
      activePlayers.length > 0 &&
      activePlayers.every((p) => p.scores[1].every((s) => s > 0)),
    [activePlayers]
  );

  const approveR1 = async () => {
    onUpdateStore((prev) => ({ ...prev, round1Approved: true }));
    try {
      await setRound1Approved(true, activeTournament?.id);
      flash('Wyniki R1 zatwierdzone.');
    } catch (err) {
      console.error(err);
      flash('Błąd zatwierdzania Rundy 1.');
    }
  };

  const startR2 = async () => {
    onUpdateStore((prev) => ({ ...prev, round2Started: true }));
    try {
      await setRound2Started(true, activeTournament?.id);
      flash('Runda 2 uruchomiona.');
    } catch (err) {
      console.error(err);
      flash('Błąd uruchamiania Rundy 2.');
    }
  };

  const doReflight = async () => {
    try {
      const existingR2 = store.flights.filter((f) => f.round === 2);
      await reflightForRound2(activePlayers, holesR1, holesR2, groupSize, existingR2, activeTournament?.id);
      flash(`Flighty R2 przegrupowane (grupy po ${groupSize}).`);
    } catch {
      flash('Błąd przegrupowania.');
    }
  };

  const handleResetRound = async (r: Round) => {
    const confirm = window.confirm(
      `CZY NA PEWNO chcesz wyzerować WSZYSTKIE wyniki dla Rundy ${r}?\n\nZawodnicy oraz ich przydziały do flightów zostaną zachowani, ale ich karty wyników będą puste.`
    );
    if (!confirm) return;

    onUpdateStore((prev) => ({
      ...prev,
      players: prev.players.map((p) => ({
        ...p,
        scores: { ...p.scores, [r]: Array(18).fill(0) },
      })),
    }));

    try {
      await resetRoundScores(r);
      flash(`Wyzerowano wyniki Rundy ${r}.`);
    } catch {
      flash(`Błąd podczas zerowania Rundy ${r}.`);
    }
  };

  const standings = useMemo(
    () =>
      [...activePlayers].sort(
        (a, b) => combinedRelative(a, holesR1, holesR2) - combinedRelative(b, holesR1, holesR2)
      ),
    [activePlayers, holesR1, holesR2]
  );

  return (
    <div className="admin-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">
            <span /> ZARZĄDZANIE RUNDAMI
          </p>
          <h2>Rundy turnieju</h2>
          <p>Zatwierdź Rundę 1, uruchom Rundę 2 lub zresetuj wyniki w razie potrzeby.</p>
        </div>
        <Layers size={20} className="muted-icon" />
      </div>

      <div className="round-status">
        <div className={`round-status-pill ${allR1Completed ? 'complete' : 'pending'}`}>
          <Check size={16} />
          {allR1Completed ? 'Runda 1 ukończona' : 'Runda 1 w toku'}
        </div>
        <span>
          R1: {store.round1Approved ? 'Zatwierdzona' : 'Nie zatwierdzona'} · R2:{' '}
          {store.round2Started ? 'Aktywna' : 'Nieaktywna'}
        </span>
      </div>

      <div className="round-section">
        <h3>Zatwierdzenie Rundy 1</h3>
        <p className="round-desc">
          Gdy wszyscy zawodnicy ukończą 18 dołków, zatwierdź wyniki R1, aby odblokować Rundę 2.
        </p>
        <div className="round-actions">
          <button
            className="secondary-button"
            onClick={approveR1}
            disabled={!allR1Completed || store.round1Approved}
          >
            <Check size={16} /> {store.round1Approved ? 'R1 zatwierdzona' : 'Zatwierdź wyniki R1'}
          </button>
          <button
            className="secondary-button"
            onClick={startR2}
            disabled={!store.round1Approved || store.round2Started}
          >
            <Plus size={16} /> {store.round2Started ? 'R2 aktywna' : 'Uruchom Rundę 2'}
          </button>
        </div>
      </div>

      <div className="round-section">
        <h3>Automatyczny przydział flightów R2</h3>
        <p className="round-desc">
          Przegrupuj zawodników w flightach Rundy 2 na podstawie klasyfikacji generalnej. Liderzy
          grają w pierwszych flightach.
        </p>
        <div className="reflight-controls">
          <label className="form-field-label">LICZBA GRACZY W GRUPIE</label>
          <select value={groupSize} onChange={(e) => setGroupSize(Number(e.target.value))}>
            <option value={2}>2 graczy</option>
            <option value={3}>3 graczy</option>
            <option value={4}>4 graczy</option>
            <option value={5}>5 graczy</option>
          </select>
          <button
            className="primary-button reflight-btn"
            onClick={doReflight}
            disabled={!store.round2Started || activePlayers.length === 0}
          >
            <Shuffle size={16} /> Automatyczny przydział R2 według wyników
          </button>
        </div>
      </div>

      <div className="round-section" style={{ borderTop: '1px solid #fee2e2', paddingTop: '16px', marginTop: '24px' }}>
        <h3 style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RotateCcw size={18} /> Czyszczenie i reset wyników
        </h3>
        <p className="round-desc">
          Wyzeruj wpisane punkty (18x0) bez kasowania zawodników ani flightów.
        </p>
        <div style={{ display: 'flex', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
          <button
            className="secondary-button"
            style={{ borderColor: '#fca5a5', color: '#dc2626', background: '#fef2f2' }}
            onClick={() => handleResetRound(1)}
          >
            <RotateCcw size={15} /> Wyzeruj wyniki Rundy 1
          </button>
          <button
            className="secondary-button"
            style={{ borderColor: '#fca5a5', color: '#dc2626', background: '#fef2f2' }}
            onClick={() => handleResetRound(2)}
          >
            <RotateCcw size={15} /> Wyzeruj wyniki Rundy 2
          </button>
        </div>
      </div>

      {standings.length > 0 && (
        <div className="round-section">
          <h3>Aktualna klasyfikacja</h3>
          <div className="standings-list">
            {standings.map((p, idx) => {
              const rel = combinedRelative(p, holesR1, holesR2);
              const flightName =
                store.flights.find((f) => f.id === p.flightId[1])?.name ?? 'Bez flightu';
              return (
                <div className="standings-row" key={p.id}>
                  <span className="standings-pos">{idx + 1}</span>
                  <span className="avatar">{initials(p.name)}</span>
                  <span className="standings-name">
                    <b>{p.name}</b>
                    <small>{flightName}</small>
                  </span>
                  <span className={`standings-rel ${rel < 0 ? 'neg' : ''}`}>
                    {rel > 0 ? '+' : ''}
                    {rel} do par
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function OverridePanel({
  store,
  activeTournament,
  onUpdateStore,
  flash,
}: {
  store: Store;
  activeTournament: Tournament | null;
  onUpdateStore: React.Dispatch<React.SetStateAction<Store>>;
  flash: FlashFn;
}) {
  const [round, setRound] = useState<Round>(1);
  const activePlayers = store.players.filter((p) => p.isActive !== false);
  const [selected, setSelected] = useState(activePlayers[0]?.id ?? store.players[0]?.id ?? '');

  const player = store.players.find((p) => p.id === selected);
  const [scoresBuffer, setScoresBuffer] = useState<number[]>([]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (player) {
      setScoresBuffer([...player.scores[round]]);
    }
  }, [player, round]);

  if (!player) return null;

  const handleScoreChange = (holeIndex: number, val: number) => {
    const updated = [...scoresBuffer];
    updated[holeIndex] = Math.max(0, val);
    setScoresBuffer(updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, currentIndex: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (currentIndex < 17) {
        inputRefs.current[currentIndex + 1]?.focus();
        inputRefs.current[currentIndex + 1]?.select();
      } else {
        handleSaveScores();
      }
    }
  };

  const handleSaveScores = async () => {
    onUpdateStore((prev) => ({
      ...prev,
      players: prev.players.map((p) =>
        p.id === player.id
          ? {
              ...p,
              scores: {
                ...p.scores,
                [round]: scoresBuffer,
              },
            }
          : p
      ),
    }));

    try {
      for (let i = 0; i < 18; i++) {
        await saveScore(player.id, round, i + 1, scoresBuffer[i] || 0, activeTournament?.id);
      }
      flash(`Zapisano kartę wyników dla ${player.name}.`);
    } catch {
      flash('Błąd zapisu wyników.');
    }
  };

  return (
    <div className="admin-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">
            <span /> GLOBALNA KOREKTA
          </p>
          <h2>Edytuj kartę wyników</h2>
          <p>Wpisz wynik i wciśnij Enter, aby przejść do kolejnego dołka.</p>
        </div>
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          {store.players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} {p.isActive === false ? '(PAUZA)' : ''}
            </option>
          ))}
        </select>
      </div>

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

      <div className="override-grid">
        {scoresBuffer.map((score, hole) => (
          <label key={hole}>
            DOŁEK {hole + 1}
            <input
              ref={(el) => (inputRefs.current[hole] = el)}
              type="number"
              min={0}
              value={score || ''}
              placeholder="–"
              onChange={(e) => handleScoreChange(hole, Number(e.target.value))}
              onKeyDown={(e) => handleKeyDown(e, hole)}
            />
          </label>
        ))}
      </div>

      <div className="form-actions" style={{ marginTop: '16px' }}>
        <button className="primary-button" onClick={handleSaveScores}>
          <Save size={16} /> Zapisz i zaktualizuj wyniki
        </button>
      </div>
    </div>
  );
}
