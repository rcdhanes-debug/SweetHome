import { useState } from 'react';
import { ArrowLeftRight, RotateCcw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import * as choreApi from '../services/chores';
import ChoreDayCard from '../components/ChoreDayCard';
import DutyBlock from '../components/DutyBlock';
import SwapModal from '../components/SwapModal';
import ScheduleEditor from '../components/ScheduleEditor';
import ConfirmModal from '../components/ConfirmModal';
import Skeleton from '../components/Skeleton';
import { todayDayName } from '../utils/format';

export default function Chores() {
  const { chores, today, users, loading, reloadChores } = useApp();
  const { isAdmin, runWithAuth } = useAuth();
  const toast = useToast();

  const [swapOpen, setSwapOpen] = useState(false);
  const [editingDay, setEditingDay] = useState(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [busy, setBusy] = useState(false);

  const doSwap = async ({ day, personA, personB }) => {
    setBusy(true);
    try {
      await runWithAuth({ title: 'Confirm Swap', subtitle: 'Admin PIN required', adminOnly: true }, async (token) => {
        await choreApi.swap(token, day, personA, personB);
      });
      toast.show('✓ Duties swapped successfully');
      setSwapOpen(false);
      await reloadChores();
    } catch (err) {
      if (err.message !== 'Cancelled') toast.show(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const doSaveDay = async ({ day, cooking, cleaning, homeClean }) => {
    setBusy(true);
    try {
      await runWithAuth({ title: 'Save Schedule', subtitle: 'Admin PIN required', adminOnly: true }, async (token) => {
        await choreApi.updateDay(token, day, { cooking, cleaning, homeClean });
      });
      toast.show('✓ Schedule updated');
      setEditingDay(null);
      await reloadChores();
    } catch (err) {
      if (err.message !== 'Cancelled') toast.show(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const doRestore = async () => {
    setConfirmRestore(false);
    setBusy(true);
    try {
      await runWithAuth({ title: 'Restore Default Schedule', subtitle: 'Admin PIN required', adminOnly: true }, async (token) => {
        await choreApi.restoreDefault(token);
      });
      toast.show('✓ Default schedule restored');
      await reloadChores();
    } catch (err) {
      if (err.message !== 'Cancelled') toast.show(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <section
        className="today-card"
        style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--border)',
          borderRadius: '20px',
          padding: '20px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15)',
          marginBottom: '20px',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(90deg, #f59e0b, #0ea5e9, #a855f7, #10b981)'
          }}
        />
        <div className="today-card__head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '0.5px' }}>
            TODAY — {todayDayName().toUpperCase()}
          </h3>
          {isAdmin && <span className="badge badge--admin">Admin Mode</span>}
        </div>
        {loading.chores || !today ? (
          <Skeleton height={140} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
            <DutyBlock role="cooking" members={today.cooking} />
            <DutyBlock role="cleaning" members={today.cleaning} />
            <DutyBlock role="homeClean" members={today.homeClean ? [today.homeClean] : []} />
          </div>
        )}
      </section>

      {isAdmin && (
        <div className="admin-bar">
          <button type="button" className="btn btn--primary" onClick={() => setSwapOpen(true)} disabled={busy}>
            <ArrowLeftRight size={16} /> Swap Duties
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => setConfirmRestore(true)} disabled={busy}>
            <RotateCcw size={16} /> Restore Default
          </button>
        </div>
      )}

      <h2 className="section-title">Weekly Chores</h2>

      {loading.chores ? (
        <div className="stack">
          <Skeleton height={150} />
          <Skeleton height={150} />
        </div>
      ) : (
        <div className="week-list" style={{ marginBottom: '24px' }}>
          {chores.map((day) => (
            <ChoreDayCard key={day._id} day={day} canEdit={isAdmin} onEdit={() => setEditingDay(day)} highlight />
          ))}
        </div>
      )}

      <SwapModal open={swapOpen} onClose={() => setSwapOpen(false)} chores={chores} onConfirm={doSwap} loading={busy} />

      <ScheduleEditor
        open={Boolean(editingDay)}
        onClose={() => setEditingDay(null)}
        chores={chores}
        users={users}
        initialDay={editingDay?.day}
        onSave={doSaveDay}
        loading={busy}
      />

      <ConfirmModal
        open={confirmRestore}
        onClose={() => setConfirmRestore(false)}
        onConfirm={doRestore}
        title="Restore Default Schedule"
        message="Restore the original Sweet Home weekly schedule? Your current custom schedule will be replaced."
        confirmLabel="Restore"
      />
    </div>
  );
}
