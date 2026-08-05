import { useState } from 'react';
import {
  ShoppingCart,
  Wrench,
  Users,
  Vote,
  Plus,
  Trash2,
  CheckCircle2,
  RotateCcw,
  Lock,
  Unlock
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
  const { isAdmin, session, runWithAuth } = useAuth();
  const toast = useToast();

  const [shoppingText, setShoppingText] = useState('');
  const [fixTitle, setFixTitle] = useState('');
  const [fixDesc, setFixDesc] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestStart, setGuestStart] = useState('');
  const [guestEnd, setGuestEnd] = useState('');
  const [resTitle, setResTitle] = useState('');
  const [resOptions, setResOptions] = useState('');
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

  const addShopping = () => {
    const text = shoppingText.trim();
    if (!text) return;
    run({ busy: 'shopping-add', pin: { title: 'Add Shopping Item', subtitle: text, defaultName: session?.user?.name } }, (t) => boardApi.addShopping(t, text), '✓ Item added to shopping list').then(() => setShoppingText(''));
  };

  const toggleShopping = (item) =>
    run(
      { busy: `shop-${item._id}`, pin: { title: item.checked ? 'Uncheck Item' : 'Check Item', subtitle: item.text, defaultName: session?.user?.name } },
      (t) => boardApi.toggleShopping(t, item._id, !item.checked),
      item.checked ? 'Item unchecked' : '✓ Item checked off'
    );

  const addFix = () => {
    const title = fixTitle.trim();
    if (!title) return;
    run({ busy: 'fix-add', pin: { title: 'Open Fix-It Issue', subtitle: title, defaultName: session?.user?.name } }, (t) => boardApi.addFix(t, title, fixDesc.trim()), '✓ Issue logged').then(() => {
      setFixTitle('');
      setFixDesc('');
    });
  };

  const setFix = (ticket) =>
    run(
      { busy: `fix-${ticket._id}`, pin: { title: ticket.resolved ? 'Reopen Issue' : 'Resolve Issue', subtitle: ticket.title, defaultName: session?.user?.name } },
      (t) => boardApi.setFix(t, ticket._id, !ticket.resolved),
      ticket.resolved ? 'Issue reopened' : '✓ Issue resolved'
    );

  const addGuest = () => {
    if (!guestName.trim() || !guestStart || !guestEnd) return;
    run(
      { busy: 'guest-add', pin: { title: 'Add Guest Visit', subtitle: `${guestName.trim()} • ${guestStart} → ${guestEnd}`, defaultName: session?.user?.name } },
      (t) => boardApi.addGuest(t, { guestName: guestName.trim(), startDate: guestStart, endDate: guestEnd }),
      '✓ Guest visit added'
    ).then(() => {
      setGuestName('');
      setGuestStart('');
      setGuestEnd('');
    });
  };

  const createResolution = () => {
    const options = resOptions
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    if (!resTitle.trim() || options.length < 2) return;
    run(
      { busy: 'res-add', pin: { title: 'Create Resolution', subtitle: resTitle.trim(), defaultName: session?.user?.name } },
      (t) => boardApi.createResolution(t, resTitle.trim(), options),
      '✓ Resolution posted — cast your vote'
    ).then(() => {
      setResTitle('');
      setResOptions('');
    });
  };

  const vote = (resolution, option) =>
    run(
      { busy: `vote-${resolution._id}`, pin: { title: 'Cast Vote', subtitle: `${resolution.title} — ${option}`, defaultName: session?.user?.name } },
      (t) => boardApi.voteResolution(t, resolution._id, option),
      '✓ Vote recorded'
    );

  const confirmRemove = async () => {
    const target = confirmDelete;
    setConfirmDelete(null);
    const pin = { title: target.type === 'resolution' ? 'Delete Resolution' : 'Remove Item', subtitle: target.label, adminOnly: target.type === 'resolution', defaultName: session?.user?.name };
    await run({ busy: `del-${target.type}`, pin }, (t) => {
      if (target.type === 'shopping') return boardApi.deleteShopping(t, target.id);
      if (target.type === 'fix') return boardApi.deleteFix(t, target.id);
      if (target.type === 'guest') return boardApi.deleteGuest(t, target.id);
      return boardApi.deleteResolution(t, target.id);
    }, '✓ Removed');
  };

  const toggleResolutionClosed = (resolution) =>
    run(
      { busy: `res-${resolution._id}`, pin: { title: resolution.closed ? 'Reopen Resolution' : 'Close Resolution', subtitle: resolution.title, adminOnly: true } },
      (t) => (resolution.closed ? boardApi.reopenResolution(t, resolution._id) : boardApi.closeResolution(t, resolution._id)),
      resolution.closed ? 'Resolution reopened' : 'Resolution closed'
    );

  const { shopping, fixes, guests, resolutions } = board;
  const myName = session?.user?.name;
  const todayStr = new Date().toISOString().slice(0, 10);
  const ongoingGuest = (g) => todayStr >= g.startDate.slice(0, 10) && todayStr <= g.endDate.slice(0, 10);

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

      {/* ── Guest Protocol ── */}
      <section className="card">
        <div className="card__head">
          <h3>
            <Users size={16} /> Guest Protocol
          </h3>
          <span className="badge badge--protected">{guests.filter(ongoingGuest).length} now</span>
        </div>
        <div className="add-row">
          <input className="text-input" placeholder="Guest name" value={guestName} maxLength={80} onChange={(e) => setGuestName(e.target.value)} />
          <input className="text-input text-input--date" type="date" value={guestStart} onChange={(e) => setGuestStart(e.target.value)} aria-label="From date" />
          <input className="text-input text-input--date" type="date" value={guestEnd} onChange={(e) => setGuestEnd(e.target.value)} aria-label="To date" />
          <button type="button" className="btn btn--primary" onClick={addGuest} disabled={busy === 'guest-add' || !guestName.trim() || !guestStart || !guestEnd}>
            <Plus size={16} />
          </button>
        </div>
        {loading.board ? (
          <Skeleton height={80} />
        ) : guests.length === 0 ? (
          <EmptyState icon="🏡" title="No upcoming guests" subtitle="Give a heads-up when family or friends are visiting." />
        ) : (
          <div className="nb-list">
            {guests.map((g) => (
              <div key={g._id} className="nb-row">
                <div className="nb-row__body">
                  <div className="nb-row__text">
                    {g.guestName}
                    {ongoingGuest(g) && <span className="badge badge--today">Now</span>}
                  </div>
                  <div className="nb-row__meta">
                    {formatDate(g.startDate)} → {formatDate(g.endDate)} • hosted by {g.host?.name || '—'}
                  </div>
                </div>
                <button type="button" className="icon-btn icon-btn--sm" onClick={() => setConfirmDelete({ type: 'guest', id: g._id, label: g.guestName })} title="Remove">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── House Resolutions ── */}
      <section className="card">
        <div className="card__head">
          <h3>
            <Vote size={16} /> House Resolutions
          </h3>
        </div>
        <p className="muted card__hint">Democratic group decisions. One vote per person, locked with your PIN.</p>
        <div className="stack">
          <input
            className="text-input"
            placeholder="Question — e.g. Split a new router?"
            value={resTitle}
            maxLength={160}
            onChange={(e) => setResTitle(e.target.value)}
          />
          <input
            className="text-input"
            placeholder="Options, comma-separated — e.g. Yes, No, Wait"
            value={resOptions}
            onChange={(e) => setResOptions(e.target.value)}
          />
          <button type="button" className="btn btn--primary btn--block" onClick={createResolution} disabled={busy === 'res-add' || !resTitle.trim() || resOptions.split(',').filter((o) => o.trim()).length < 2}>
            {busy === 'res-add' ? 'Posting…' : 'Post Resolution'}
          </button>
        </div>
        {loading.board ? (
          <Skeleton height={120} />
        ) : resolutions.length === 0 ? (
          <EmptyState icon="🗳️" title="No resolutions" subtitle="Ask the house a question and vote on it together." />
        ) : (
          <div className="res-list">
            {resolutions.map((r) => {
              const total = r.votes.length;
              const counts = Object.fromEntries(r.options.map((o) => [o, r.votes.filter((v) => v.option === o).length]));
              const max = Math.max(...r.options.map((o) => counts[o] || 0), 0);
              const myVote = r.votes.find((v) => v.user?.name === myName)?.option;
              return (
                <div key={r._id} className="res-card">
                  <div className="res-card__head">
                    <div className="res-card__title">{r.title}</div>
                    <div className="res-card__meta">
                      {r.closed ? <span className="badge badge--away">Closed</span> : <span className="badge badge--today">Open</span>}
                      <span>{total} vote{total === 1 ? '' : 's'}</span>
                    </div>
                  </div>
                  <div className="res-options">
                    {r.options.map((o) => {
                      const n = counts[o] || 0;
                      const pct = total ? Math.round((n / total) * 100) : 0;
                      const isWinner = r.closed && n === max && max > 0;
                      const isMine = myVote === o;
                      return (
                        <div key={o} className={`res-option ${isMine ? 'res-option--mine' : ''} ${r.closed ? 'res-option--locked' : ''}`}>
                          <div className="res-option__top">
                            <span className="res-option__label">{o}</span>
                            <span className="res-option__count">{n} · {pct}%</span>
                          </div>
                          <div className="res-bar">
                            <span className="res-bar__fill" style={{ width: `${pct}%` }} />
                          </div>
                          {!r.closed && (
                            <button type="button" className="btn btn--ghost btn--sm res-option__vote" disabled={busy === `vote-${r._id}` || isMine} onClick={() => vote(r, o)}>
                              {isMine ? <Lock size={13} /> : <Vote size={13} />}
                              {isMine ? 'Your vote' : 'Vote'}
                            </button>
                          )}
                          {isWinner && <span className="res-option__winner">✓ Winner</span>}
                        </div>
                      );
                    })}
                  </div>
                  {isAdmin && (
                    <div className="res-card__admin">
                      <button type="button" className="btn btn--ghost btn--sm" disabled={busy === `res-${r._id}`} onClick={() => toggleResolutionClosed(r)}>
                        {r.closed ? <Unlock size={13} /> : <Lock size={13} />}
                        {r.closed ? 'Reopen' : 'Close'}
                      </button>
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirmDelete({ type: 'resolution', id: r._id, label: r.title })}>
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <ConfirmModal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={confirmRemove}
        loading={busy === 'del-shopping' || busy === 'del-fix' || busy === 'del-guest' || busy === 'del-resolution'}
        title="Remove"
        message={`Remove "${confirmDelete?.label}"? This cannot be undone.`}
        confirmLabel="Remove"
        danger
      />
    </div>
  );
}
