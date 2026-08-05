import { initials } from '../utils/format';

export default function Avatar({ user, name, size = 38 }) {
  const displayName = name || user?.name || '';
  const src = user?.avatar;

  return (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {src ? <img className="avatar__img" src={src} alt="" /> : initials(displayName) || '?'}
    </span>
  );
}
