// src/components/Archive.tsx
import { useState } from 'react';
import { Archive as ArchiveIcon, Calendar, MapPin, Award, ArrowRight } from 'lucide-react';
import type { Tournament } from '@/types';

export function Archive({
  tournaments,
  onSelectTournament,
}: {
  tournaments: Tournament[];
  onSelectTournament: (t: Tournament) => void;
}) {
  const [filter, setFilter] = useState<'all' | 'league' | 'training'>('all');

  const completed = tournaments.filter((t) => t.status === 'completed');

  const filtered = completed.filter((t) => {
    if (filter === 'league') return t.isLeague;
    if (filter === 'training') return !t.isLeague;
    return true;
  });

  return (
    <section className="leaderboard-section-wrap">
      <div className="section-intro">
        <div>
          <p className="eyebrow">
            <span className="eyebrow-line" /> HISTORIA ROZGRYWEK
          </p>
          <h1 className="tournament-title">Archiwum Turniejów</h1>
          <p className="intro-copy">
            Przeglądaj zakończone turnieje, historyczne tabele wyników i karty graczy.
          </p>
        </div>

        <div className="filter-bar">
          <button
            className={`filter-chip ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Wszystkie ({completed.length})
          </button>
          <button
            className={`filter-chip ${filter === 'league' ? 'active' : ''}`}
            onClick={() => setFilter('league')}
          >
            Ligowe PFFG
          </button>
          <button
            className={`filter-chip ${filter === 'training' ? 'active' : ''}`}
            onClick={() => setFilter('training')}
          >
            Treningowe / Towarzyskie
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((t) => (
          <div
            key={t.id}
            className="stat-card cursor-pointer hover:border-slate-400 transition-all flex justify-between items-center"
            onClick={() => onSelectTournament(t)}
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
              </div>
              <h2 className="text-base font-bold text-slate-900">{t.name}</h2>
              <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
                <span className="flex items-center gap-1">
                  <Calendar size={13} /> {t.date}
                </span>
                {t.courseName && (
                  <span className="flex items-center gap-1">
                    <MapPin size={13} /> {t.courseName}
                  </span>
                )}
              </div>
            </div>
            <button className="icon-button">
              <ArrowRight size={18} />
            </button>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-2 empty-state">Brak zakończonych turniejów w archiwum.</div>
        )}
      </div>
    </section>
  );
}