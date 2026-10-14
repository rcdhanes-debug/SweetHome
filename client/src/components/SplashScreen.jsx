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
      transition={{ duration: exiting ? 0.45 : 0.35, ease: [0.22, 1, 0.36, 1] }}
      aria-hidden="true"
    >
      {/* Background ambient lighting */}
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
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.35 }}
        title="Skip intro"
      >
        <span>Skip</span>
        <ArrowRight size={13} />
      </motion.button>

      {/* Centered Frame Style Layout */}
      <div className="splash__frame-container">
        {/* Top Badge */}
        <motion.div
          className="splash__badge"
          initial={{ opacity: 0, scale: 0.9, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: reduced ? 0 : 0.12, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="splash__badge-dot" />
          <span>SWEET HOME • 2026</span>
          <Sparkles size={12} style={{ color: '#fbbf24' }} />
        </motion.div>

        {/* Small Framed Picture with Border & Shadow */}
        <motion.div
          className="splash__photo-frame"
          initial={{ opacity: 0, scale: 0.92, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: reduced ? 0 : 0.22, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.img
            src={welcomePhoto}
            alt="Sweet Home Housemates"
            className="splash__frame-img"
            initial={{ scale: 1 }}
            animate={{ scale: 1.05 }}
            transition={{ duration: 3.5, ease: 'easeOut' }}
          />
          <div className="splash__frame-shine" />
        </motion.div>

        {/* Centered Welcome Typography */}
        <div className="splash__text-block">
          <motion.h1
            className="splash__title"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduced ? 0 : 0.4, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            Welcome Home ❤️
          </motion.h1>

          <motion.p
            className="splash__tag"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduced ? 0 : 0.55, duration: 0.5, ease: 'easeOut' }}
          >
            Our House • Our Brotherhood • Good Times
          </motion.p>
        </div>

        {/* Centered Loader & Tap Hint */}
        <motion.div
          className="splash__loader-wrap"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65, duration: 0.45 }}
        >
          <div className="splash__progress-track">
            <motion.div
              className="splash__progress-fill"
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: 2.8, ease: 'linear' }}
            />
          </div>
          <span className="splash__tap-hint">Tap anywhere to enter</span>
        </motion.div>
      </div>
    </motion.div>
  );
}
