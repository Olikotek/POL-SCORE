import type { ScoreStyle } from '@/types';

function scoreStyleFor(delta: number): ScoreStyle {
  if (delta <= -2) return { label: 'Eagle', className: 'score-eagle' };
  if (delta === -1) return { label: 'Birdie', className: 'score-birdie' };
  if (delta === 0) return { label: 'Par', className: 'score-par' };
  if (delta === 1) return { label: 'Bogey', className: 'score-bogey' };
  if (delta === 2) return { label: 'Double', className: 'score-double' };
  return { label: 'Triple+', className: 'score-triple' };
}

export function ScoreBadge({
  stroke,
  par,
  size = 'md',
}: {
  stroke: number;
  par: number;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClass = size === 'sm' ? 'badge-sm' : size === 'lg' ? 'badge-lg' : 'badge-md';

  if (stroke <= 0) {
    return <span className={`score-badge dash ${sizeClass}`}>–</span>;
  }
  const delta = stroke - par;
  const style = scoreStyleFor(delta);
  return <span className={`score-badge ${style.className} ${sizeClass}`}>{stroke}</span>;
}
