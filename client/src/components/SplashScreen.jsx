import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { resolveMediaUrl } from '../services/api';

export const PHOTO_SRC = resolveMediaUrl('/api/photo/file');

export default function SplashScreen({ exiting }) {
  const reduced = useReducedMotion();
  const [photoOk, setPhotoOk] = useState(true);

  return (
    <motion.div
      className="splash"
      initial={{ opacity: 1 }}
      animate={{ opacity: exiting ? 0 : 1, scale: exiting ? 1.06 : 1, filter: exiting ? 'blur(10px)' : 'blur(0px)' }}
      transition={{ duration: exiting ? 0.5 : 0.3, ease: 'easeInOut' }}
      aria-hidden="true"
    >
      <div className="splash__halo splash__halo--1" />
      <div className="splash__halo splash__halo--2" />

      {photoOk && (
        <motion.img
          className="splash__photo"
          src={PHOTO_SRC}
          alt=""
          initial={{ scale: reduced ? 1 : 1.18 }}
          animate={{ scale: 1 }}
          transition={{ duration: reduced ? 0 : 2.6, ease: [0.25, 0.1, 0.25, 1] }}
          onError={() => setPhotoOk(false)}
          onLoad={(e) => {
            if (!e.currentTarget.naturalWidth) setPhotoOk(false);
          }}
        />
      )}

      <div className="splash__overlay" />

      <motion.h1
        className="splash__title"
        initial={{ opacity: 0, y: 26, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: reduced ? 0 : 0.65, duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
      >
        Sweet Home ❤️
      </motion.h1>

      <motion.p
        className="splash__tag"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: reduced ? 0 : 0.95, duration: 0.65, ease: 'easeOut' }}
      >
        Welcome to HomeHQ
      </motion.p>
    </motion.div>
  );
}
