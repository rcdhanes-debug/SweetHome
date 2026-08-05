import { useEffect, useMemo } from 'react';

const COLORS = ['#6366f1', '#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#ec4899', '#06b6d4'];

export default function Confetti({ count = 70, onDone }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const size = Math.random() * 10 + 6;
        const rect = Math.random() > 0.45;
        return {
          id: i,
          left: Math.random() * 100,
          color: COLORS[i % COLORS.length],
          size,
          shape: rect ? 'confetti__piece--rect' : 'confetti__piece--circle',
          delay: Math.random() * 0.4,
          duration: Math.random() * 1.3 + 1.6,
          drift: Math.random() * 100 - 50
        };
      }),
    [count]
  );

  useEffect(() => {
    const t = setTimeout(() => onDone?.(), 3200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className={`confetti__piece ${p.shape}`}
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.shape === 'confetti__piece--rect' ? p.size * 0.45 : p.size,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            '--drift': `${p.drift}px`
          }}
        />
      ))}
    </div>
  );
}
