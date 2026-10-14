import { useState } from 'react';
import {
  ShoppingCart,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  Clock,
  Sparkles,
  ShoppingBag,
  Check
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import * as boardApi from '../services/noticeboard';
import ConfirmModal from '../components/ConfirmModal';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import { formatDate, formatTime } from '../utils/format';

const QUICK_SUGGESTIONS = [
  '🥛 Milk',
  '🥚 Eggs',
  '🧅 Onions & Veggies',
  '🧼 Dish Soap / Detergent',
  '🧻 Paper Towels',
  '🫖 Tea Powder',
  '☕ Coffee',
  '🌾 Rice / Atta',
  '🛢️ Cooking Oil',
  '💧 Drinking Water Can'
];

export default function Noticeboard() {
  const { board, loading, reloadBoard } = useApp();
  const { session } = useAuth();
  const toast = useToast();

  const [shoppingText, setShoppingText] = useState('');
  const [busy, setBusy] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const { shopping = [] } = board || {};

  const pendingItems = shopping.filter((s) => !s.checked);
  const boughtItems = shopping.filter((s) => s.checked);

  const addShopping = async (textToAdd) => {
    const text = (textToAdd || shoppingText).trim();
    if (!text) return;
    setBusy('shopping-add');
    try {
      await boardApi.addShopping(text);
      toast.show('✓ Added to shopping list');
      setShoppingText('');
      await reloadBoard();
    } catch (err) {
      toast.show(err.message || 'Failed to add item', 'error');
    } finally {
      setBusy('');
    }
  };

  const toggleShopping = async (item) => {
    setBusy(`shop-${item._id}`);
    try {
      await boardApi.toggleShopping(item._id, !item.checked);
      toast.show(item.checked ? 'Item marked unbought' : '✓ Item bought (clears in 24h)');
      await reloadBoard();
    } catch (err) {
      toast.show(err.message || 'Failed to update item', 'error');
    } finally {
      setBusy('');
    }
  };

  const confirmRemove = async () => {
    const target = confirmDelete;
    setConfirmDelete(null);
    if (!target) return;
    setBusy(`del-${target.id}`);
    try {
      await boardApi.deleteShopping(target.id);
      toast.show('✓ Item deleted');
      await reloadBoard();
    } catch (err) {
      toast.show(err.message || 'Failed to delete item', 'error');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="page">
      {/* Shopping List Hero Overview */}
      <section className="card" style={shoppingHeroCardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={shoppingIconBadge}>
              <ShoppingCart size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#fff' }}>
                Household Shopping List
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: 'rgba(255, 255, 255, 0.7)' }}>
                Shared list for the house • Anyone can add or grab items
              </p>
            </div>
          </div>
          <span style={pendingBadgeStyle}>
            {pendingItems.length} to buy
          </span>
        </div>

        {/* 24-Hour Auto-Delete notice */}
        <div style={autoDeleteBannerStyle}>
          <Clock size={13} color="#34d399" style={{ flexShrink: 0 }} />
          <span>
            Bought items are automatically cleared <strong>after 24 hours</strong>.
          </span>
        </div>
      </section>

      {/* Quick Add Bar */}
      <section className="card" style={{ marginBottom: '16px', padding: '14px' }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addShopping();
          }}
          style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
        >
          <input
            className="text-input"
            placeholder="Add an item to buy... (e.g. Milk, Onions, Detergent)"
            value={shoppingText}
            maxLength={120}
            onChange={(e) => setShoppingText(e.target.value)}
            style={{ height: '42px', fontSize: '13.5px' }}
          />
          <button
            type="submit"
            className="btn btn--primary"
            disabled={busy === 'shopping-add' || !shoppingText.trim()}
            style={{ height: '42px', padding: '0 16px', gap: '6px', whiteSpace: 'nowrap' }}
          >
            {busy === 'shopping-add' ? <span className="spinner" /> : <Plus size={16} />}
            <span>Add</span>
          </button>
        </form>

        {/* Quick Suggestion Chips */}
        <div style={{ marginTop: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
            ⚡ Quick Suggestions:
          </div>
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
            {QUICK_SUGGESTIONS.map((item) => (
              <button
                key={item}
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => addShopping(item)}
                disabled={busy === 'shopping-add'}
                style={{
                  fontSize: '11.5px',
                  padding: '3px 8px',
                  height: '28px',
                  borderRadius: '20px',
                  background: 'var(--surface-2, rgba(255, 255, 255, 0.05))',
                  border: '1px solid var(--border)',
                  whiteSpace: 'nowrap'
                }}
              >
                + {item}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Active Items to Buy */}
      <section className="card" style={{ marginBottom: '16px' }}>
        <div className="card__head" style={{ marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShoppingBag size={16} color="var(--accent, #60a5fa)" />
            <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 800 }}>
              Need to Buy ({pendingItems.length})
            </h3>
          </div>
        </div>

        {loading.board ? (
          <div className="stack">
            <Skeleton height={50} />
            <Skeleton height={50} />
          </div>
        ) : pendingItems.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center' }}>
            <span style={{ fontSize: '28px', display: 'block', marginBottom: '8px' }}>🎉</span>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>
              All caught up! Nothing to buy right now.
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
              Add items above as soon as household supplies run low.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {pendingItems.map((s) => (
              <div
                key={s._id}
                style={itemRowStyle}
              >
                <button
                  type="button"
                  onClick={() => toggleShopping(s)}
                  disabled={busy === `shop-${s._id}`}
                  title="Click to mark as bought"
                  style={checkCircleBtnStyle}
                >
                  <Circle size={18} color="var(--muted)" />
                </button>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', wordBreak: 'break-word' }}>
                    {s.text}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                    Added by {s.createdBy?.name || 'Someone'} • {formatDate(s.createdAt)}
                  </div>
                </div>

                <button
                  type="button"
                  className="icon-btn icon-btn--sm"
                  onClick={() => setConfirmDelete({ id: s._id, label: s.text })}
                  title="Remove item"
                  style={{ color: 'var(--muted)', opacity: 0.8 }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Bought / Cleared Items */}
      {boughtItems.length > 0 && (
        <section className="card" style={{ background: 'rgba(0, 0, 0, 0.15)', border: '1px dashed var(--border)' }}>
          <div className="card__head" style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} color="#34d399" />
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: 'var(--muted)' }}>
                Recently Bought ({boughtItems.length})
              </h3>
            </div>
            <span style={{ fontSize: '10.5px', color: '#34d399', fontWeight: 700 }}>
              Auto-clears in 24h
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {boughtItems.map((s) => (
              <div
                key={s._id}
                style={{ ...itemRowStyle, opacity: 0.7, background: 'rgba(16, 185, 129, 0.05)' }}
              >
                <button
                  type="button"
                  onClick={() => toggleShopping(s)}
                  disabled={busy === `shop-${s._id}`}
                  title="Click to unmark"
                  style={{ ...checkCircleBtnStyle, color: '#34d399' }}
                >
                  <CheckCircle2 size={18} color="#34d399" />
                </button>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13.5px', textDecoration: 'line-through', color: 'var(--muted)', wordBreak: 'break-word' }}>
                    {s.text}
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#34d399', marginTop: '2px' }}>
                    ✓ Bought by {s.checkedBy?.name || 'Someone'} • {formatDate(s.checkedAt)} {formatTime(s.checkedAt)}
                  </div>
                </div>

                <button
                  type="button"
                  className="icon-btn icon-btn--sm"
                  onClick={() => setConfirmDelete({ id: s._id, label: s.text })}
                  title="Remove item"
                  style={{ color: 'var(--muted)' }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={confirmRemove}
        title="Remove Item"
        message={`Remove "${confirmDelete?.label}" from the shopping list?`}
        confirmLabel="Remove"
        danger
      />
    </div>
  );
}

const shoppingHeroCardStyle = {
  background: 'linear-gradient(135deg, #1e3a8a 0%, #1e1b4b 60%, #0f172a 100%)',
  border: '1px solid rgba(59, 130, 246, 0.3)',
  borderRadius: '16px',
  padding: '16px',
  marginBottom: '16px',
  color: '#fff'
};

const shoppingIconBadge = {
  width: '34px',
  height: '34px',
  borderRadius: '9px',
  background: 'rgba(255, 255, 255, 0.2)',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const pendingBadgeStyle = {
  fontSize: '11px',
  fontWeight: 800,
  padding: '3px 8px',
  borderRadius: '6px',
  background: 'rgba(59, 130, 246, 0.3)',
  color: '#93c5fd',
  border: '1px solid rgba(59, 130, 246, 0.4)'
};

const autoDeleteBannerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  background: 'rgba(16, 185, 129, 0.12)',
  border: '1px solid rgba(16, 185, 129, 0.25)',
  padding: '6px 10px',
  borderRadius: '8px',
  fontSize: '11.5px',
  color: '#a7f3d0',
  marginTop: '10px'
};

const itemRowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 12px',
  borderRadius: '10px',
  background: 'var(--surface, rgba(255, 255, 255, 0.04))',
  border: '1px solid var(--border)',
  gap: '10px'
};

const checkCircleBtnStyle = {
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};
