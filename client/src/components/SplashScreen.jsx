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
        scale: exiting ? 1.05 : 1,
        filter: exiting ? 'blur(12px)' : 'blur(0px)'
      }}
      transition={{ duration: exiting ? 0.55 : 0.4, ease: [0.22, 1, 0.36, 1] }}
      aria-hidden="true"
    >
      {/* Background Animated Photo with Ken Burns Effect */}
      <motion.img
        src={welcomePhoto}
        alt="Sweet Home Housemates"
        className="splash__photo"
        initial={{ scale: 1, filter: 'brightness(0.72) contrast(1.04)' }}
        animate={{
          scale: exiting ? 1.12 : 1.07,
          filter: exiting ? 'brightness(0.35) contrast(1.08)' : 'brightness(0.88) contrast(1.06)'
        }}
        transition={{
          duration: 3.5,
          ease: 'easeOut'
        }}
      />

      {/* Cinematic Vignette Overlays */}
      <div className="splash__overlay" />
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
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        title="Skip to Dashboard"
      >
        <span>Skip</span>
        <ArrowRight size={13} />
      </motion.button>

      {/* Center Welcome Card & Content */}
      <div className="splash__content">
        <motion.div
          className="splash__badge"
          initial={{ opacity: 0, scale: 0.88, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: reduced ? 0 : 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="splash__badge-dot" />
          <span>SWEET HOME • 2026</span>
          <Sparkles size={12} style={{ color: '#fbbf24' }} />
        </motion.div>

        <motion.h1
          className="splash__title"
          initial={{ opacity: 0, y: 24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: reduced ? 0 : 0.55, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          Welcome Home ❤️
        </motion.h1>

        <motion.p
          className="splash__tag"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduced ? 0 : 0.85, duration: 0.6, ease: 'easeOut' }}
        >
          Our House • Our Brotherhood • Good Times
        </motion.p>
      </div>

      {/* Bottom Hint & Progress Indicator */}
      <motion.div
        className="splash__bottom-bar"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: 0.5 }}
      >
        <span className="splash__tap-hint">Tap anywhere to enter</span>
        <div className="splash__progress-track">
          <motion.div
            className="splash__progress-fill"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 2.9, ease: 'linear' }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}
