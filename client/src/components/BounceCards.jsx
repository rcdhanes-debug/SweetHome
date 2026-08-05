import { motion, useReducedMotion } from 'motion/react';

// Adapted from React Bits "BounceCards": elastic stagger entrance with a
// gentle 3D/rise reaction on hover. Decorative only — no data or logic.
export default function BounceCards({ images = [], className, size = 64 }) {
  const reduced = useReducedMotion();
  const cards = images.filter(Boolean);
  if (cards.length === 0) return null;

  return (
    <div className={`bounce-cards ${className || ''}`} aria-hidden="true">
      {cards.map((img, i) => (
        <motion.div
          key={i}
          className="bounce-card"
          style={{
            zIndex: cards.length - i,
            width: size,
            height: size,
            '--card-index': i
          }}
          initial={reduced ? { opacity: 0 } : { scale: 0.35, y: 70, opacity: 0, rotate: (i % 2 ? 1 : -1) * 14 }}
          animate={reduced ? { opacity: 1 } : { scale: 1, y: 0, opacity: 1, rotate: (i % 2 ? 1 : -1) * 4 }}
          transition={
            reduced
              ? { duration: 0.01 }
              : { type: 'spring', stiffness: 260, damping: 17, delay: 0.4 + i * 0.09 }
          }
          whileHover={reduced ? undefined : { scale: 1.05, y: -8, rotate: (i % 2 ? 1 : -1) * 2 }}
        >
          <img src={img.src} alt={img.alt || ''} />
        </motion.div>
      ))}
    </div>
  );
}
