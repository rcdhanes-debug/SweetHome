import { motion, useReducedMotion } from 'motion/react';

export default function ProgressBar({ value, max = 100, color, height = 10 }) {
  const reduced = useReducedMotion();
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className="progress-track" style={{ height }}>
      <motion.div
        className="progress-fill"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={reduced ? { duration: 0.01 } : { type: 'spring', stiffness: 110, damping: 22 }}
        style={{ '--fill': color || 'var(--accent)', height }}
      />
    </div>
  );
}
