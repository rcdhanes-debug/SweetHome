import { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import SplashScreen from './components/SplashScreen';
import Dashboard from './pages/Dashboard';
import Collection from './pages/Collection';
import Redeem from './pages/Redeem';
import Expenses from './pages/Expenses';
import Chores from './pages/Chores';
import Dues from './pages/Dues';

// Code-split heavy/rarely-accessed pages to keep initial bundle ultra fast
const Admin = lazy(() => import('./pages/Admin'));
const Print = lazy(() => import('./pages/Print'));
const Calendar = lazy(() => import('./pages/Calendar'));
const Noticeboard = lazy(() => import('./pages/Noticeboard'));
const Members = lazy(() => import('./pages/Members'));

import UpdateBanner from './components/UpdateBanner';

const INTRO_KEY = 'homehq_intro_seen';

function readIntro() {
  try {
    return !sessionStorage.getItem(INTRO_KEY);
  } catch (_) {
    return false;
  }
}

function markIntroSeen() {
  try {
    sessionStorage.setItem(INTRO_KEY, '1');
  } catch (_) {}
}

export default function App() {
  const [phase, setPhase] = useState('intro');

  const handleSkip = () => {
    if (phase === 'intro') {
      setPhase('exit');
    }
  };

  useEffect(() => {
    if (phase === 'intro') {
      const t = setTimeout(() => setPhase('exit'), 3000);
      return () => clearTimeout(t);
    }
    if (phase === 'exit') {
      const t = setTimeout(() => {
        setPhase('done');
      }, 550);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [phase]);

  const app = (
    <ToastProvider>
      <UpdateBanner />
      <AppProvider>
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={null}>
              <Routes>
                <Route element={<Layout />}>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/collection" element={<Collection />} />
                  <Route path="/redeem" element={<Redeem />} />
                  <Route path="/dues" element={<Dues />} />
                  <Route path="/print" element={<Print />} />
                  <Route path="/expenses" element={<Expenses />} />
                  <Route path="/chores" element={<Chores />} />
                  <Route path="/noticeboard" element={<Noticeboard />} />
                  <Route path="/members" element={<Members />} />
                  <Route path="/calendar" element={<Calendar />} />
                  <Route path="/admin" element={<Admin />} />
                  <Route path="/bank" element={<Navigate to="/expenses" replace />} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Route>
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </AppProvider>
    </ToastProvider>
  );

  if (phase === 'done') return app;

  return (
    <>
      {phase === 'exit' && app}
      <SplashScreen exiting={phase === 'exit'} onSkip={handleSkip} />
    </>
  );
}
