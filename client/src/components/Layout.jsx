import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import { House, Wallet, Receipt, CalendarDays, ClipboardList, ShieldCheck, Users, CalendarClock, CheckCircle2, HandCoins, FolderHeart } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { greeting } from '../utils/format';
import AnimatedGrid from './AnimatedGrid';
import BounceCards from './BounceCards';
import NotificationBell from './NotificationBell';
import { PHOTO_SRC } from './SplashScreen';

const NAV = [
  { to: '/dashboard', label: 'Home', icon: House },
  { to: '/collection', label: 'Collection', icon: Wallet },
  { to: '/expenses', label: 'Expenses', icon: Receipt },
  { to: '/redeem', label: 'Redeem', icon: HandCoins },
  { to: '/chores', label: 'Schedule', icon: CalendarDays },
  { to: '/memories', label: 'Memories', icon: FolderHeart },
  { to: '/noticeboard', label: 'Board', icon: ClipboardList },
  { to: '/calendar', label: 'Calendar', icon: CalendarClock },
  { to: '/members', label: 'Members', icon: Users }
];

const PARTICLES = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  left: `${(i * 83) % 100}%`,
  size: 2 + ((i * 3) % 5),
  duration: 15 + ((i * 5) % 13),
  delay: -((i * 7) % 18),
  drift: `${((i % 3) - 1) * 44}px`
}));

function NavItems({ renderItem, placement, hide = [] }) {
  return NAV.filter(({ to }) => !hide.includes(to)).map(({ to, label, icon: Icon }) =>
    renderItem ? renderItem(to, label, Icon, placement) : null
  );
}

export default function Layout() {
  const { isAdmin } = useAuth();
  const { funding } = useApp();
  const location = useLocation();
  const reduced = useReducedMotion();

  const pageTitles = {
    '/dashboard': 'Overview',
    '/collection': 'Collection',
    '/redeem': 'Redeem',
    '/dues': 'Dues & Payoff',
    '/print': 'Monthly Report',
    '/expenses': 'Expenses',
    '/memories': 'Memories & Gallery',
    '/chores': 'Schedule',
    '/noticeboard': 'Noticeboard',
    '/members': 'Members',
    '/calendar': 'Calendar',
    '/admin': 'Admin'
  };
  const title = pageTitles[location.pathname] || 'Sweet Home';

  const navLink = (to, label, Icon, cls, indicator) => (
    <NavLink key={to} to={to} className={({ isActive }) => `${cls} ${isActive ? 'is-active' : ''}`}>
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId={indicator}
              className="nav-indicator"
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            />
          )}
          <Icon size={20} />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  );

  return (
    <div className="app-shell">
      <AnimatedGrid />
      <div className="bg-orbs" aria-hidden="true">
        <span className="orb orb--1" />
        <span className="orb orb--2" />
        <span className="orb orb--3" />
        <span className="orb orb--4" />
        {PARTICLES.map((p) => (
          <span
            key={p.id}
            className="particle"
            style={{
              left: p.left,
              width: p.size,
              height: p.size,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
              '--drift': p.drift
            }}
          />
        ))}
      </div>
      <aside className="desktop-nav">
          <div className="desktop-nav__brand">
            <span className="brand-logo">SH</span>
            <div>
              <div className="brand-name">Sweet Home</div>
              <div className="brand-month">{funding?.monthLabel || ''}</div>
            </div>
          </div>
        <NavItems renderItem={(to, label, Icon) => navLink(to, label, Icon, 'desktop-nav__item', 'desktop-nav-pill')} placement="desktop" />
        <div className="desktop-nav__admin">
          {navLink('/admin', isAdmin ? 'Admin Mode' : 'Admin', ShieldCheck, 'desktop-nav__item', 'desktop-nav-pill')}
          <div style={{ width: '100%', height: '1px', background: 'var(--border)', margin: '6px 0' }} />
          <div className="desktop-nav__item" style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', cursor: 'pointer' }}>
            <NotificationBell />
            <span style={{ fontSize: '14px', fontWeight: 700 }}>Notifications</span>
          </div>
        </div>
        <div className="desktop-nav__memory">
          <BounceCards images={[{ src: PHOTO_SRC, alt: 'Sweet Home' }]} size={92} />
          <span className="desktop-nav__memory-caption">Our Sweet Home</span>
        </div>
      </aside>

      <header className="topbar">
        <div className="topbar__inner">
          <div className="topbar__brand">
            <span className="brand-logo">SH</span>
            <div>
              <div className="brand-name">Sweet Home</div>
              <div className="brand-month">{funding?.monthLabel || ''}</div>
            </div>
          </div>

          <div className="topbar__right">
            {isAdmin && (
              <span className="admin-pill" title="Admin mode active">
                <ShieldCheck size={14} /> Admin
              </span>
            )}
            <Link to="/admin" className={`topbar__admin ${location.pathname === '/admin' ? 'is-active' : ''}`} title="Admin Mode">
              <ShieldCheck size={18} />
            </Link>
            <NotificationBell />
          </div>
        </div>
        <div className="topbar__greeting">
          {greeting()} 👋 <span className="topbar__page">{title}</span>
        </div>
      </header>

      <main className="content">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10, filter: 'blur(5px)' }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8, filter: 'blur(5px)' }}
            transition={reduced ? { duration: 0.1 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="bottomnav">
        <NavItems renderItem={(to, label, Icon) => navLink(to, label, Icon, 'bottomnav__item', 'bottom-nav-pill')} placement="bottom" hide={['/dues']} />
      </nav>
    </div>
  );
}
