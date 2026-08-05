import { useEffect, useRef } from 'react';

// Adapted from React Bits "CursorGrid" background: an interactive grid that
// softly illuminates cells near the pointer and pulses on click.
const CELL = 42;
const COLORS = ['59,130,246', '124,58,237', '34,211,238', '99,102,241'];

export default function AnimatedGrid({ className }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let raf = 0;
    let cells = [];
    let cols = 0;
    let rows = 0;
    let dpr = 1;
    const pointer = { x: -9999, y: -9999, pulse: 0 };
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      cols = Math.ceil(w / CELL);
      rows = Math.ceil(h / CELL);
      cells = Array.from({ length: cols * rows }, (_, i) => ({
        x: (i % cols) * CELL + CELL / 2,
        y: Math.floor(i / cols) * CELL + CELL / 2,
        a: 0,
        hue: (i + Math.floor(i / cols)) % COLORS.length
      }));
    };

    const onMove = (e) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    };
    const onLeave = () => {
      pointer.x = -9999;
      pointer.y = -9999;
    };
    const onDown = () => {
      pointer.pulse = 1;
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = 'rgba(148,163,184,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= canvas.width; x += CELL * dpr) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
      }
      for (let y = 0; y <= canvas.height; y += CELL * dpr) {
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
      }
      ctx.stroke();

      const glowR = 2.6 * CELL * dpr;
      const pulseCenterR = 2.2 * CELL * dpr;
      const pulseR = pulseCenterR * (1 + pointer.pulse * 3.2);
      for (const c of cells) {
        const dx = c.x * dpr - pointer.x * dpr;
        const dy = c.y * dpr - pointer.y * dpr;
        const dist = Math.hypot(dx, dy);
        const near = Math.max(0, 1 - dist / glowR);
        const ring = pointer.pulse > 0 ? Math.max(0, 1 - Math.abs(dist - pulseR) / (CELL * dpr)) : 0;
        const target = Math.min(1, near + ring * 0.9);
        c.a += (target - c.a) * 0.14;
        if (c.a > 0.005) {
          ctx.fillStyle = `rgba(${COLORS[c.hue]},${(c.a * 0.5).toFixed(3)})`;
          const s = CELL * dpr * 0.62;
          ctx.fillRect(c.x * dpr - s / 2, c.y * dpr - s / 2, s, s);
        }
      }
      pointer.pulse = Math.max(0, pointer.pulse - 0.05);
      raf = requestAnimationFrame(draw);
    };

    const drawStatic = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = 'rgba(148,163,184,0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= canvas.width; x += CELL * dpr) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
      }
      for (let y = 0; y <= canvas.height; y += CELL * dpr) {
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
      }
      ctx.stroke();
    };

    resize();
    window.addEventListener('resize', resize);
    if (reduced) {
      drawStatic();
    } else {
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerleave', onLeave);
      window.addEventListener('pointerdown', onDown);
      raf = requestAnimationFrame(draw);
    }

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('pointerdown', onDown);
      cancelAnimationFrame(raf);
    };
  }, []);

  return <canvas ref={canvasRef} className={`animated-grid ${className || ''}`} aria-hidden="true" />;
}
