import { motion, useReducedMotion } from 'motion/react';
import welcomePhoto from '../assets/welcome-photo.jpg';
import { ArrowRight, Sparkles } from 'lucide-react';

export default function SplashScreen({ exiting, onSkip }) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className="splash"
      onClick={onSkip}
      initial={{ opacity: 1 }}
      animate={{
        opacity: exiting ? 0 : 1,
        scale: exiting ? 1.04 : 1,
        filter: exiting ? 'blur(10px)' : 'blur(0px)'
      }}
      transition={{ duration: exiting ? 0.45 : 0.25, ease: [0.22, 1, 0.36, 1] }}
      aria-hidden="true"
    >
      {/* Ambient glowing halos */}
      <div className="splash__halo splash__halo--1" />
      <div className="splash__halo splash__halo--2" />

      {/* Top Skip Button */}
      <motion.button
        type="button"
        className="splash__skip-btn"
        onClick={(e) => {
          e.stopPropagation();
          onSkip?.();
        }}
        initial={{ opacity: 1, y: 0 }}
        animate={{ opacity: 1, y: 0 }}
        title="Skip to Dashboard"
      >
        <span>Skip</span>
        <ArrowRight size={13} />
      </motion.button>

      {/* Centered Frame Style Layout - DIRECT without delays */}
      <div className="splash__frame-container">
        {/* Top Badge */}
        <div className="splash__badge">
          <span className="splash__badge-dot" />
          <span>SWEET HOME • 2026</span>
          <Sparkles size={12} style={{ color: '#fbbf24' }} />
        </div>

        {/* Framed Picture - Instant display */}
        <div className="splash__photo-frame">
          <motion.img
            src={welcomePhoto}
            alt="Sweet Home Housemates"
            className="splash__frame-img"
            loading="eager"
            fetchpriority="high"
            decoding="async"
            initial={{ scale: 1 }}
            animate={{ scale: 1.05 }}
            transition={{ duration: 3.5, ease: 'easeOut' }}
          />
          <div className="splash__frame-shine" />
        </div>

        {/* Centered Welcome Typography */}
        <div className="splash__text-block">
          <h1 className="splash__title">
            Welcome Home ❤️
          </h1>
          <p className="splash__tag">
            Our House • Our Brotherhood • Good Times
          </p>
        </div>

        {/* Centered Loader & Tap Hint */}
        <div className="splash__loader-wrap">
          <div className="splash__progress-track">
            <motion.div
              className="splash__progress-fill"
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: 2.8, ease: 'linear' }}
            />
          </div>
          <span className="splash__tap-hint">Tap anywhere to enter</span>
        </div>
      </div>
    </motion.div>
  );
}
