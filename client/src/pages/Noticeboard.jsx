import { useState } from 'react';
import {
  ShoppingCart,
  Wrench,
  Plus,
  Trash2,
  CheckCircle2,
  RotateCcw
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import * as boardApi from '../services/noticeboard';
import ConfirmModal from '../components/ConfirmModal';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import { formatDate } from '../utils/format';

export default function Noticeboard() {
  const { board, loading, reloadBoard } = useApp();
  const { session, runWithAuth } = useAuth();
  const toast = useToast();

  const [shoppingText, setShoppingText] = useState('');
  const [fixTitle, setFixTitle] = useState('');
  const [fixDesc, setFixDesc] = useState('');
  const [busy, setBusy] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const run = async (opts, fn, okMsg) => {
    setBusy(opts.busy);
    try {
      await runWithAuth(opts.pin, (token) => fn(token));
      if (okMsg) toast.show(okMsg);
      await reloadBoard();
    } catch (err) {
      if (err.message !== 'Cancelled') toast.show(err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const addShopping = async () => {
    const text = shoppingText.trim();
    if (!text) return;
    setBusy('shopping-add');
    try {
      await boardApi.addShopping(text);
      toast.show('✓ Item added to shopping list');
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
      toast.show(item.checked ? 'Item unchecked' : '✓ Item checked off');
      await reloadBoard();
    } catch (err) {
      toast.show(err.message || 'Failed to update item', 'error');
    } finally {
      setBusy('');
    }
  };

  const addFix = async () => {
    const title = fixTitle.trim();
    if (!title) return;
    setBusy('fix-add');
    try {
      await boardApi.addFix(title, fixDesc.trim());
      toast.show('✓ Issue logged');
      setFixTitle('');
      setFixDesc('');
      await reloadBoard();
    } catch (err) {
      toast.show(err.message || 'Failed to log issue', 'error');
    } finally {
      setBusy('');
    }
  };

  const setFix = async (ticket) => {
    setBusy(`fix-${ticket._id}`);
    try {
      await boardApi.setFix(ticket._id, !ticket.resolved);
      toast.show(ticket.resolved ? 'Issue reopened' : '✓ Issue resolved');
      await reloadBoard();
    } catch (err) {
      toast.show(err.message || 'Failed to update issue', 'error');
    } finally {
      setBusy('');
    }
  };

  const confirmRemove = async () => {
    const target = confirmDelete;
    setConfirmDelete(null);
    setBusy(`del-${target.type}`);
    try {
      if (target.type === 'shopping') {
        await boardApi.deleteShopping(target.id);
      } else {
        await boardApi.deleteFix(target.id);
      }
      toast.show('✓ Removed');
      await reloadBoard();
    } catch (err) {
      toast.show(err.message || 'Failed to remove item', 'error');
    } finally {
      setBusy('');
    }
  };

  const { shopping = [], fixes = [] } = board || {};

  return (
    <div className="page">
      {/* ── Shared Shopping List ── */}
      <section className="card">
        <div className="card__head">
          <h3>
            <ShoppingCart size={16} /> Shopping List
          </h3>
          <span className="badge badge--today">{shopping.filter((s) => !s.checked).length} to buy</span>
        </div>
        <div className="add-row">
          <input
            className="text-input"
            placeholder="Add an item… e.g. Milk, detergent"
            value={shoppingText}
            maxLength={120}
            onChange={(e) => setShoppingText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addShopping()}
          />
          <button type="button" className="btn btn--primary" onClick={addShopping} disabled={busy === 'shopping-add' || !shoppingText.trim()}>
            {busy === 'shopping-add' ? <span className="spinner" /> : <Plus size={16} />}
          </button>
        </div>
        {loading.board ? (
          <Skeleton height={80} />
        ) : shopping.length === 0 ? (
          <EmptyState icon="🛒" title="List is empty" subtitle="Add supplies so anyone can grab them at the store." />
        ) : (
          <div className="nb-list">
            {shopping.map((s) => (
              <div key={s._id} className={`nb-row ${s.checked ? 'nb-row--checked' : ''}`}>
                <button
                  type="button"
                  className={`nb-check ${s.checked ? 'nb-check--on' : ''}`}
                  disabled={busy === `shop-${s._id}`}
                  onClick={() => toggleShopping(s)}
                  title={s.checked ? 'Mark as not needed' : 'Mark as bought'}
                >
                  {s.checked && <CheckCircle2 size={17} />}
                </button>
                <div className="nb-row__body">
                  <div className="nb-row__text">{s.text}</div>
                  <div className="nb-row__meta">
                    {s.checked ? `Bought • ${s.checkedBy?.name || 'someone'} • ${formatDate(s.checkedAt)}` : `Added by ${s.createdBy?.name || '—'}`}
                  </div>
                </div>
                <button type="button" className="icon-btn icon-btn--sm" onClick={() => setConfirmDelete({ type: 'shopping', id: s._id, label: s.text })} title="Remove">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Fix-It Log ── */}
      <section className="card">
        <div className="card__head">
          <h3>
            <Wrench size={16} /> Fix-It Log
          </h3>
          <span className="badge badge--away">{fixes.filter((f) => !f.resolved).length} open</span>
        </div>
        <div className="stack">
          <input
            className="text-input"
            placeholder="Issue — e.g. Leaking kitchen pipe"
            value={fixTitle}
            maxLength={120}
            onChange={(e) => setFixTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addFix()}
          />
          <input
            className="text-input"
            placeholder="Details (optional)"
            value={fixDesc}
            maxLength={500}
            onChange={(e) => setFixDesc(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addFix()}
          />
          <button type="button" className="btn btn--primary btn--block" onClick={addFix} disabled={busy === 'fix-add' || !fixTitle.trim()}>
            {busy === 'fix-add' ? 'Logging…' : 'Log Issue'}
          </button>
        </div>
        {loading.board ? (
          <Skeleton height={80} />
        ) : fixes.length === 0 ? (
          <EmptyState icon="🔧" title="No issues" subtitle="Log broken things here until someone fixes them." />
        ) : (
          <div className="nb-list">
            {fixes.map((f) => (
              <div key={f._id} className={`nb-row ${f.resolved ? 'nb-row--checked' : ''}`}>
                <div className="nb-row__body">
                  <div className="nb-row__text">{f.title}</div>
                  {f.description && <div className="nb-row__desc">{f.description}</div>}
                  <div className="nb-row__meta">
                    {f.resolved ? `Resolved by ${f.resolvedBy?.name || '—'} • ${formatDate(f.resolvedAt)}` : `Opened by ${f.createdBy?.name || '—'}`}
                  </div>
                </div>
                <div className="nb-row__actions">
                  <button type="button" className={`btn btn--sm ${f.resolved ? 'btn--ghost' : 'btn--primary'}`} disabled={busy === `fix-${f._id}`} onClick={() => setFix(f)}>
                    {f.resolved ? <RotateCcw size={13} /> : <CheckCircle2 size={13} />}
                    {f.resolved ? 'Reopen' : 'Resolve'}
                  </button>
                  <button type="button" className="icon-btn icon-btn--sm" onClick={() => setConfirmDelete({ type: 'fix', id: f._id, label: f.title })} title="Remove">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <ConfirmModal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={confirmRemove}
        loading={busy === 'del-shopping' || busy === 'del-fix'}
        title="Remove"
        message={`Remove "${confirmDelete?.label}"? This cannot be undone.`}
        confirmLabel="Remove"
        danger
      />
    </div>
  );
}
