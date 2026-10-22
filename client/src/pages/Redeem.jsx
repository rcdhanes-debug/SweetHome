import { useState, useMemo, useEffect } from 'react';
import {
  HandCoins,
  Plus,
  Send,
  CheckCircle2,
  RotateCcw,
  Trash2,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  Layers,
  List,
  Search,
  Copy,
  Zap,
  Clock,
  AlertCircle
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import * as redeemApi from '../services/redeem';
import BottomSheet from '../components/BottomSheet';
import ConfirmModal from '../components/ConfirmModal';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import { formatCurrency, formatDate, formatTime } from '../utils/format';
import { HOUSEMATES, DEFAULT_UPI_IDS } from '../constants';
import * as expenseApi from '../services/expenses';

const UPI_PATTERN = /^[^\s@]+@[a-zA-Z]{2,}$/;
const WAITING_STORAGE_KEY = 'sweethome_waiting_confirmations';

const loadWaitingMap = () => {
  try {
    const raw = localStorage.getItem(WAITING_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const now = Date.now();
    const valid = {};
    for (const [id, item] of Object.entries(parsed)) {
      if (item && item.expiresAt > now) {
        valid[id] = item;
      }
    }
    return valid;
  } catch {
    return {};
  }
};

const saveWaitingMap = (map) => {
  try {
    localStorage.setItem(WAITING_STORAGE_KEY, JSON.stringify(map));
  } catch (e) {
    console.error('Failed to save waiting confirmations', e);
  }
};

const formatRemainingTime = (expiresAt, now) => {
  const diffSec = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

export default function Redeem() {
  const { redeems = [], users = [], loading, reloadRedeems, reloadExpenses } = useApp();
  const { isAdmin, session, runWithAuth } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('open'); // 'open' | 'settled'
  const [settledSearch, setSettledSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedName, setSelectedName] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [upiInput, setUpiInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [busy, setBusy] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [copiedUpi, setCopiedUpi] = useState('');
  const [waitingMap, setWaitingMap] = useState(loadWaitingMap);
  const [now, setNow] = useState(Date.now());
  const [viewMode, setViewMode] = useState('grouped'); // 'grouped' (combined per person) | 'individual'
  const [openPage, setOpenPage] = useState(1);
  const [closedPage, setClosedPage] = useState(1);
  const pageSize = 8;

  // 1-second interval to update countdown & auto-restore expired items after 2 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      const currentNow = Date.now();
      setNow(currentNow);

      setWaitingMap((prev) => {
        let hasExpired = false;
        const next = { ...prev };
        for (const [id, entry] of Object.entries(prev)) {
          if (entry.expiresAt <= currentNow) {
            delete next[id];
            hasExpired = true;
          }
        }
        if (hasExpired) {
          saveWaitingMap(next);
          toast.show('2 mins elapsed with no SMS confirmation. Restored to Open.');
          return next;
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [toast]);

  // If there are items waiting confirmation, poll redeems every 4s so auto-close from SMS is fast
  useEffect(() => {
    const waitingCount = Object.keys(waitingMap).length;
    if (waitingCount === 0) return;

    const pollTimer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        reloadRedeems();
      }
    }, 4000);

    return () => clearInterval(pollTimer);
  }, [waitingMap, reloadRedeems]);

  // Clean up any items from waitingMap that have been settled/closed on the server
  useEffect(() => {
    if (Object.keys(waitingMap).length === 0) return;
    setWaitingMap((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const id of Object.keys(prev)) {
        const found = redeems.find((r) => r._id === id);
        if (found && found.closed) {
          delete next[id];
          changed = true;
        }
      }
      if (changed) {
        saveWaitingMap(next);
        return next;
      }
      return prev;
    });
  }, [redeems, waitingMap]);

  const getUpiFor = (name) => {
    const u = users.find((x) => x.name === name);
    return u?.upiId || DEFAULT_UPI_IDS[name] || (name ? `${name.toLowerCase()}@okaxis` : '');
  };

  const handleCopyUpi = (upiId, amount, itemsToWait = []) => {
    if (!upiId) {
      toast.show('No UPI ID found for this person', 'error');
      return;
    }
    navigator.clipboard.writeText(upiId);
    setCopiedUpi(upiId);

    const items = Array.isArray(itemsToWait) ? itemsToWait : [itemsToWait];
    if (items.length > 0) {
      const currentNow = Date.now();
      const expiresAt = currentNow + 120 * 1000; // 2 minutes
      setWaitingMap((prev) => {
        const next = { ...prev };
        for (const it of items) {
          if (it && it._id) {
            next[it._id] = {
              id: it._id,
              amount: it.amount,
              personName: it.createdBy?.name || 'Housemate',
              upiId,
              copiedAt: currentNow,
              expiresAt
            };
          }
        }
        saveWaitingMap(next);
        return next;
      });
      toast.show(`✓ Copied ${upiId}! Moved to Waiting for Confirmation (2 mins)`);
    } else {
      toast.show(`✓ Copied ${upiId} to clipboard! (Amount: ₹${amount || 0})`);
    }
    setTimeout(() => setCopiedUpi(''), 2500);
  };

  const handleRestore = (itemOrItems) => {
    const items = Array.isArray(itemOrItems) ? itemOrItems : [itemOrItems];
    const idsToRemove = items.map((it) => it._id || it.id || it);
    setWaitingMap((prev) => {
      const next = { ...prev };
      for (const id of idsToRemove) {
        delete next[id];
      }
      saveWaitingMap(next);
      return next;
    });
    toast.show('✓ Restored to Open requests');
  };

  const handleOpenForm = () => {
    const initName = session?.user?.name || (users[0]?.name || HOUSEMATES[0]);
    setSelectedName(initName);
    setUpiInput(getUpiFor(initName));
    setShowForm(true);
  };

  const handleSelectHousemate = (name) => {
    setSelectedName(name);
    setUpiInput(getUpiFor(name));
  };

  const resetForm = () => {
    setAmountInput('');
    setUpiInput('');
    setNoteInput('');
    setSelectedName('');
  };

  const run = async (opts, fn, okMsg) => {
    setBusy(opts.busy);
    try {
      await runWithAuth(opts.pin, (token) => fn(token));
      if (okMsg) toast.show(okMsg);
      await reloadRedeems();
    } catch (err) {
      if (err.message !== 'Cancelled') toast.show(err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const submitRedeem = async () => {
    const amount = Number(amountInput);
    const upiId = upiInput.trim();
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.show('Enter a valid amount', 'error');
      return;
    }
    if (!UPI_PATTERN.test(upiId)) {
      toast.show('Enter a valid UPI ID (e.g. name@okbank)', 'error');
      return;
    }

    setBusy('redeem-add');
    try {
      await redeemApi.createRedeem(session?.token || null, {
        amount,
        upiId,
        note: noteInput.trim(),
        userName: selectedName || session?.user?.name
      });
      toast.show('✓ Redeem request posted!');
      await reloadRedeems();
      setShowForm(false);
      resetForm();
    } catch (err) {
      toast.show(err.message || 'Failed to post redeem request', 'error');
    } finally {
      setBusy('');
    }
  };

  // Reopen — admin PIN required
  const reopenItem = async (item) => {
    setBusy(`redeem-${item._id}`);
    try {
      await runWithAuth(
        {
          title: 'Reopen Redeem Request',
          subtitle: `${item.createdBy?.name} • ${formatCurrency(item.amount)}`,
          adminOnly: true,
        },
        (token) => redeemApi.reopenRedeem(token, item._id)
      );
      toast.show('Redeem request reopened');
      await reloadRedeems();
      await reloadExpenses();
    } catch (err) {
      if (err.message !== 'Cancelled') toast.show(err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const confirmRemove = async () => {
    const target = confirmDelete;
    setConfirmDelete(null);
    await run({ busy: `del-${target._id}`, pin: { title: 'Delete Redeem Request', subtitle: `${target.createdBy?.name} • ${formatCurrency(target.amount)}`, adminOnly: true } }, (t) => redeemApi.deleteRedeem(t, target._id), '✓ Removed');
  };

  const open = (redeems || []).filter((r) => !r.closed);
  const closed = (redeems || []).filter((r) => r.closed);

  const waitingItemIds = useMemo(() => {
    return new Set(Object.keys(waitingMap));
  }, [waitingMap]);

  // Split open redeems into regular open vs waiting confirmation
  const regularOpen = useMemo(() => {
    return open.filter((r) => !waitingItemIds.has(r._id));
  }, [open, waitingItemIds]);

  const waitingOpen = useMemo(() => {
    return open.filter((r) => waitingItemIds.has(r._id));
  }, [open, waitingItemIds]);

  // Grouping helper
  const groupRedeemsByPerson = (items) => {
    const map = new Map();
    for (const r of items) {
      const person = r.createdBy?.name || 'Unknown';
      if (!map.has(person)) {
        map.set(person, {
          personName: person,
          upiId: r.upiId || getUpiFor(person),
          items: [],
          totalAmount: 0,
          latestDate: r.createdAt,
          expiresAt: waitingMap[r._id]?.expiresAt || 0
        });
      }
      const group = map.get(person);
      group.items.push(r);
      group.totalAmount += Number(r.amount) || 0;
      if (waitingMap[r._id]?.expiresAt) {
        group.expiresAt = Math.max(group.expiresAt || 0, waitingMap[r._id].expiresAt);
      }
      if (new Date(r.createdAt) > new Date(group.latestDate)) {
        group.latestDate = r.createdAt;
        if (r.upiId) group.upiId = r.upiId;
      }
    }
    for (const group of map.values()) {
      group.items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  };

  // Grouped regular open
  const groupedOpen = useMemo(() => {
    return groupRedeemsByPerson(regularOpen);
  }, [regularOpen, users, waitingMap]);

  // Grouped waiting confirmation
  const groupedWaiting = useMemo(() => {
    return groupRedeemsByPerson(waitingOpen);
  }, [waitingOpen, users, waitingMap]);

  const openTotalPages = Math.ceil(regularOpen.length / pageSize) || 1;
  const paginatedOpen = regularOpen.slice((openPage - 1) * pageSize, openPage * pageSize);

  const groupedTotalPages = Math.ceil(groupedOpen.length / pageSize) || 1;
  const paginatedGroupedOpen = groupedOpen.slice((openPage - 1) * pageSize, openPage * pageSize);

  const filteredClosed = useMemo(() => {
    if (!settledSearch.trim()) return closed;
    const q = settledSearch.toLowerCase();
    return closed.filter(
      (r) =>
        (r.createdBy?.name || '').toLowerCase().includes(q) ||
        (r.note || '').toLowerCase().includes(q) ||
        (r.closedByName || '').toLowerCase().includes(q) ||
        String(r.amount).includes(q)
    );
  }, [closed, settledSearch]);

  const closedTotalPages = Math.ceil(filteredClosed.length / pageSize) || 1;
  const paginatedClosed = filteredClosed.slice((closedPage - 1) * pageSize, closedPage * pageSize);

  const pendingTotal = open.reduce((s, r) => s + r.amount, 0);
  const housemateList = users.length > 0 ? users.map((u) => u.name) : HOUSEMATES;

  return (
    <div className="page" style={{ maxWidth: '820px', margin: '0 auto', paddingBottom: '70px' }}>
      {/* Sleek Compact Header Card */}
      <section className="redeem-compact-header">
        <div className="redeem-compact-header__left">
          <div className="redeem-compact-header__title-lockup">
            <div className="redeem-compact-header__icon">
              <HandCoins size={20} />
            </div>
            <div>
              <div className="redeem-compact-header__title">Redeem Payouts</div>
              <div className="redeem-compact-header__subtitle">Shared house expenses & UPI payouts</div>
            </div>
          </div>
          <div className="redeem-compact-hero-stat">
            <span style={{ color: 'var(--muted)' }}>Pending:</span>
            <span className="redeem-compact-hero-stat__amount">{formatCurrency(pendingTotal)}</span>
            <span style={{ color: 'var(--muted)', fontSize: '11px' }}>
              ({open.length} items • {groupedOpen.length} {groupedOpen.length === 1 ? 'person' : 'people'})
            </span>
          </div>
        </div>

        <button type="button" className="btn btn--primary btn--sm" onClick={handleOpenForm} style={{ gap: '6px', whiteSpace: 'nowrap' }}>
          <Plus size={16} /> Raise Request
        </button>
      </section>

      {/* Segmented Control & View Switcher */}
      <div className="redeem-tab-strip">
        <div className="redeem-segmented-control">
          <button
            type="button"
            className={`redeem-segmented-control__btn ${activeTab === 'open' ? 'redeem-segmented-control__btn--active' : ''}`}
            onClick={() => { setActiveTab('open'); setOpenPage(1); }}
          >
            <HandCoins size={14} /> Pending ({open.length})
            {waitingOpen.length > 0 && (
              <span
                style={{
                  background: 'rgba(245, 158, 11, 0.22)',
                  color: '#fbbf24',
                  borderRadius: '10px',
                  padding: '1px 6px',
                  fontSize: '10px',
                  fontWeight: 700,
                  marginLeft: '4px'
                }}
              >
                {waitingOpen.length} waiting
              </span>
            )}
          </button>
          <button
            type="button"
            className={`redeem-segmented-control__btn ${activeTab === 'settled' ? 'redeem-segmented-control__btn--active' : ''}`}
            onClick={() => { setActiveTab('settled'); setClosedPage(1); }}
          >
            <CheckCircle2 size={14} /> Settled ({closed.length})
          </button>
        </div>

        {activeTab === 'open' && open.length > 0 && (
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              className={`chip ${viewMode === 'grouped' ? 'chip--active' : ''}`}
              style={{ fontSize: '11.5px', padding: '3px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              onClick={() => { setViewMode('grouped'); setOpenPage(1); }}
              title="Group requests by person"
            >
              <Layers size={12} /> Combined ({groupedOpen.length + groupedWaiting.length})
            </button>
            <button
              type="button"
              className={`chip ${viewMode === 'individual' ? 'chip--active' : ''}`}
              style={{ fontSize: '11.5px', padding: '3px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              onClick={() => { setViewMode('individual'); setOpenPage(1); }}
              title="Show flat list"
            >
              <List size={12} /> All ({open.length})
            </button>
          </div>
        )}
      </div>

      {loading.redeems ? (
        <Skeleton height={140} />
      ) : activeTab === 'open' ? (
        open.length === 0 ? (
          <EmptyState
            icon="🎉"
            title="All clear! No pending payouts"
            subtitle="Everyone has been settled up. Spent money for the house? Click '+ Raise Request' above."
          />
        ) : (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 12px',
                borderRadius: '10px',
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.22)',
                marginBottom: '14px',
                fontSize: '11.5px',
                color: '#bae6fd',
                lineHeight: 1.45
              }}
            >
              <Zap size={14} style={{ color: '#38bdf8', flexShrink: 0 }} />
              <span>
                <strong>Auto-Settlement Active:</strong> Click <strong>Copy UPI ID</strong> to move a request to <strong>Waiting for Confirmation</strong>. When the bank sends a debit SMS matching the member name & amount, it auto-settles. If no SMS arrives within 2 mins, it automatically restores to Open. You can also pay directly without copying UPI — matching SMS will settle either way!
              </span>
            </div>

            {/* ─── REGULAR OPEN PAYOUTS (TOP) ─── */}
            {regularOpen.length === 0 && waitingOpen.length > 0 ? (
              <div className="card" style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)', fontSize: '12.5px', marginBottom: '14px' }}>
                All pending requests have been copied and are in <strong>Waiting for Confirmation</strong> below.
                <br />
                They will automatically return here after 2 minutes if no SMS arrives, or you can click <strong>Restore</strong> anytime.
              </div>
            ) : viewMode === 'grouped' ? (
          <>
            <div className="redeem-compact-list">
              {paginatedGroupedOpen.map((group) => (
                <div key={group.personName} className="redeem-compact-card">
                  <div className="redeem-compact-card__top">
                    <div className="redeem-compact-card__left">
                      <div className="redeem-compact-card__avatar">
                        {group.personName.charAt(0).toUpperCase()}
                      </div>
                      <div className="redeem-compact-card__person-meta">
                        <div className="redeem-compact-card__name-row">
                          <span className="redeem-compact-card__name">{group.personName}</span>
                          <span
                            className="redeem-compact-card__upi-pill"
                            onClick={() => {
                              navigator.clipboard.writeText(group.upiId);
                              toast.show(`✓ Copied ${group.upiId}`);
                            }}
                            title="Click to copy UPI ID"
                          >
                            <Copy size={10} /> {group.upiId}
                          </span>
                          {group.items.length > 1 && (
                            <span
                              className="badge"
                              style={{
                                background: 'rgba(96, 165, 250, 0.15)',
                                color: '#60a5fa',
                                fontSize: '10px',
                                padding: '1px 6px',
                                fontWeight: 700
                              }}
                            >
                              {group.items.length} items
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="redeem-compact-card__right">
                      <span className="redeem-compact-card__total">{formatCurrency(group.totalAmount)}</span>
                      <div className="redeem-compact-card__right-actions">
                        <button
                          type="button"
                          className="btn btn--primary btn--xs"
                          onClick={() => handleCopyUpi(group.upiId, group.totalAmount, group.items)}
                          style={{ gap: '5px' }}
                          title={`Copy UPI ID: ${group.upiId} & wait confirmation`}
                        >
                          {copiedUpi === group.upiId ? <CheckCircle2 size={12} style={{ color: '#fff' }} /> : <Copy size={12} />}
                          <span>{copiedUpi === group.upiId ? 'Copied!' : 'Copy UPI ID'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Nested compact products breakdown */}
                  <div className="redeem-compact-products">
                    {group.items.map((item, idx) => (
                      <div key={item._id} className="redeem-compact-item-row">
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="redeem-compact-item-desc">
                            <span style={{ color: 'var(--muted)', marginRight: '6px', fontSize: '11px', fontWeight: 700 }}>
                              {idx + 1}.
                            </span>
                            {item.note || 'Redeem item (no note)'}
                          </div>
                          <div className="redeem-compact-item-meta">
                            {formatDate(item.createdAt)} • {formatTime(item.createdAt)}
                          </div>
                        </div>

                        <div className="redeem-compact-item-right">
                          <span className="redeem-compact-item-amt">{formatCurrency(item.amount)}</span>
                          {group.items.length > 1 && (
                            <button
                              type="button"
                              className="btn btn--ghost btn--xs"
                              onClick={() => handleCopyUpi(item.upiId || group.upiId, item.amount, [item])}
                              style={{ gap: '4px' }}
                              title={`Copy UPI ID: ${item.upiId || group.upiId} & wait confirmation`}
                            >
                              {copiedUpi === (item.upiId || group.upiId) ? <CheckCircle2 size={11} style={{ color: '#34d399' }} /> : <Copy size={11} />}
                              <span>{copiedUpi === (item.upiId || group.upiId) ? 'Copied!' : 'Copy UPI'}</span>
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              type="button"
                              className="icon-btn icon-btn--xs"
                              onClick={() => setConfirmDelete(item)}
                              title="Delete item"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {groupedOpen.length > pageSize && (
              <div className="pagination" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn--ghost btn--xs"
                  disabled={openPage === 1}
                  onClick={() => setOpenPage((p) => Math.max(p - 1, 1))}
                >
                  <ChevronLeft size={14} /> Previous
                </button>
                <span className="muted" style={{ fontSize: '11.5px', fontWeight: 600 }}>
                  Page {openPage} of {groupedTotalPages}
                </span>
                <button
                  type="button"
                  className="btn btn--ghost btn--xs"
                  disabled={openPage >= groupedTotalPages}
                  onClick={() => setOpenPage((p) => Math.min(p + 1, groupedTotalPages))}
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            )}
          </>
        ) : (
          /* Flat list of all open requests */
          <>
            <div className="nb-list card" style={{ padding: '4px 12px' }}>
              {paginatedOpen.map((r) => (
                <div key={r._id} className="nb-row" style={{ padding: '10px 0' }}>
                  <div className="nb-row__icon" style={{ width: '32px', height: '32px' }}>
                    <HandCoins size={16} />
                  </div>
                  <div className="nb-row__body">
                    <div className="nb-row__text" style={{ fontSize: '13.5px' }}>
                      {formatCurrency(r.amount)}
                      <span className="badge badge--today" style={{ fontSize: '10px', padding: '1px 5px' }}>Open</span>
                    </div>
                    <div className="redeem-upi" style={{ fontSize: '11.5px' }}>{r.upiId}</div>
                    {r.note && <div className="nb-row__desc" style={{ fontSize: '12px' }}>{r.note}</div>}
                    <div className="nb-row__meta" style={{ fontSize: '10.5px' }}>
                      Raised by {r.createdBy?.name || '—'} • {formatDate(r.createdAt)} • {formatTime(r.createdAt)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end', flexShrink: 0 }}>
                    <button
                      type="button"
                      className="btn btn--primary btn--xs"
                      onClick={() => handleCopyUpi(r.upiId, r.amount, [r])}
                      style={{ gap: '5px' }}
                      title={`Copy UPI ID: ${r.upiId} & wait confirmation`}
                    >
                      {copiedUpi === r.upiId ? <CheckCircle2 size={11} style={{ color: '#fff' }} /> : <Copy size={11} />}
                      <span>{copiedUpi === r.upiId ? 'Copied!' : 'Copy UPI'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {regularOpen.length > pageSize && (
              <div className="pagination" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn--ghost btn--xs"
                  disabled={openPage === 1}
                  onClick={() => setOpenPage((p) => Math.max(p - 1, 1))}
                >
                  <ChevronLeft size={14} /> Previous
                </button>
                <span className="muted" style={{ fontSize: '11.5px', fontWeight: 600 }}>
                  Page {openPage} of {openTotalPages}
                </span>
                <button
                  type="button"
                  className="btn btn--ghost btn--xs"
                  disabled={openPage >= openTotalPages}
                  onClick={() => setOpenPage((p) => Math.min(p + 1, openTotalPages))}
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            )}
          </>
        )}

            {/* ─── WAITING FOR CONFIRMATION CATEGORY (MOVED TO LAST) ─── */}
            {waitingOpen.length > 0 && (
              <section className="redeem-waiting-section" style={{ marginTop: regularOpen.length > 0 ? '22px' : '0' }}>
                <div className="redeem-waiting-header">
                  <div className="redeem-waiting-title">
                    <span className="waiting-pulse-dot" />
                    <Clock size={16} />
                    <span>Waiting for Confirmation ({waitingOpen.length})</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn btn--restore btn--xs"
                      onClick={() => handleRestore(waitingOpen)}
                      title="Restore all waiting requests back to Open"
                    >
                      <RotateCcw size={12} /> Restore All
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: '11px', color: '#fde68a', opacity: 0.9, marginBottom: '10px' }}>
                  Awaiting debit SMS for matching amount & name within 2 minutes. Auto-restores to Open on timeout.
                </div>

                {viewMode === 'grouped' ? (
                  <div className="redeem-compact-list">
                    {groupedWaiting.map((group) => (
                      <div key={`waiting-${group.personName}`} className="redeem-waiting-card">
                        <div className="redeem-waiting-card__top">
                          <div className="redeem-compact-card__left">
                            <div className="redeem-compact-card__avatar" style={{ background: 'linear-gradient(135deg, #d97706, #b45309)' }}>
                              {group.personName.charAt(0).toUpperCase()}
                            </div>
                            <div className="redeem-compact-card__person-meta">
                              <div className="redeem-compact-card__name-row">
                                <span className="redeem-compact-card__name">{group.personName}</span>
                                <span
                                  className="redeem-compact-card__upi-pill"
                                  onClick={() => {
                                    navigator.clipboard.writeText(group.upiId);
                                    toast.show(`✓ Copied ${group.upiId}`);
                                  }}
                                  title="Click to copy UPI ID"
                                >
                                  <Copy size={10} /> {group.upiId}
                                </span>
                                <span className="redeem-waiting-badge">
                                  <Clock size={11} /> {formatRemainingTime(group.expiresAt, now)}
                                </span>
                                {group.items.length > 1 && (
                                  <span
                                    className="badge"
                                    style={{
                                      background: 'rgba(245, 158, 11, 0.2)',
                                      color: '#fbbf24',
                                      fontSize: '10px',
                                      padding: '1px 6px',
                                      fontWeight: 700
                                    }}
                                  >
                                    {group.items.length} items
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="redeem-waiting-card__actions">
                            <span className="redeem-compact-card__total" style={{ color: '#fbbf24' }}>
                              {formatCurrency(group.totalAmount)}
                            </span>
                            <button
                              type="button"
                              className="btn btn--restore btn--xs"
                              onClick={() => handleRestore(group.items)}
                              title="Restore this group back to Open requests"
                            >
                              <RotateCcw size={12} /> Restore
                            </button>
                          </div>
                        </div>

                        {/* Nested waiting items */}
                        <div className="redeem-compact-products" style={{ background: 'rgba(0,0,0,0.3)', borderColor: 'rgba(245, 158, 11, 0.15)' }}>
                          {group.items.map((item, idx) => (
                            <div key={`wait-it-${item._id}`} className="redeem-compact-item-row" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div className="redeem-compact-item-desc">
                                  <span style={{ color: 'var(--muted)', marginRight: '6px', fontSize: '11px', fontWeight: 700 }}>
                                    {idx + 1}.
                                  </span>
                                  {item.note || 'Redeem item (no note)'}
                                </div>
                                <div className="redeem-compact-item-meta">
                                  {formatDate(item.createdAt)} • {formatTime(item.createdAt)}
                                </div>
                              </div>
                              <div className="redeem-compact-item-right">
                                <span className="redeem-compact-item-amt" style={{ color: '#fbbf24' }}>
                                  {formatCurrency(item.amount)}
                                </span>
                                {group.items.length > 1 && (
                                  <button
                                    type="button"
                                    className="btn btn--ghost btn--xs"
                                    onClick={() => handleRestore([item])}
                                    title="Restore this item back to Open"
                                    style={{ fontSize: '10.5px' }}
                                  >
                                    <RotateCcw size={10} /> Restore
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Flat Waiting list */
                  <div className="nb-list card" style={{ padding: '4px 12px', background: 'rgba(15, 23, 42, 0.6)', borderColor: 'rgba(245, 158, 11, 0.22)' }}>
                    {waitingOpen.map((r) => (
                      <div key={`wait-flat-${r._id}`} className="nb-row" style={{ padding: '10px 0' }}>
                        <div className="nb-row__icon" style={{ width: '32px', height: '32px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
                          <Clock size={16} />
                        </div>
                        <div className="nb-row__body">
                          <div className="nb-row__text" style={{ fontSize: '13.5px', color: '#fbbf24' }}>
                            {formatCurrency(r.amount)}
                            <span className="redeem-waiting-badge" style={{ marginLeft: '6px' }}>
                              <Clock size={10} /> {formatRemainingTime(waitingMap[r._id]?.expiresAt || 0, now)}
                            </span>
                          </div>
                          <div className="redeem-upi" style={{ fontSize: '11.5px' }}>{r.upiId}</div>
                          {r.note && <div className="nb-row__desc" style={{ fontSize: '12px' }}>{r.note}</div>}
                          <div className="nb-row__meta" style={{ fontSize: '10.5px' }}>
                            Raised by {r.createdBy?.name || '—'} • {formatDate(r.createdAt)} • {formatTime(r.createdAt)}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn--restore btn--xs"
                            onClick={() => handleRestore([r])}
                            title="Restore back to Open"
                          >
                            <RotateCcw size={12} /> Restore
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
      </>
    )) : (
        /* Settled History Tab */
        <>
          <div className="redeem-search-input">
            <Search size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search settled payouts by housemate, note, or amount…"
              value={settledSearch}
              onChange={(e) => {
                setSettledSearch(e.target.value);
                setClosedPage(1);
              }}
            />
            {settledSearch && (
              <button
                type="button"
                className="icon-btn icon-btn--xs"
                onClick={() => setSettledSearch('')}
                style={{ border: 'none', background: 'transparent' }}
              >
                ✕
              </button>
            )}
          </div>

          {filteredClosed.length === 0 ? (
            <EmptyState
              icon="🔍"
              title="No matching settled requests"
              subtitle={settledSearch ? 'Try a different search query.' : 'Settled requests will show up here.'}
            />
          ) : (
            <>
              <div className="nb-list card" style={{ padding: '4px 12px' }}>
                {paginatedClosed.map((r) => (
                  <div key={r._id} className="nb-row" style={{ padding: '9px 0' }}>
                    <div className="nb-row__icon" style={{ width: '30px', height: '30px' }}>
                      <CheckCircle2 size={16} />
                    </div>
                    <div className="nb-row__body">
                      <div className="nb-row__text nb-row__text--muted" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontSize: '13px' }}>
                        <span>{formatCurrency(r.amount)}</span>
                        <span className="badge badge--protected" style={{ fontSize: '9.5px', padding: '1px 5px' }}>Settled</span>
                        {(r.source === 'SMS' || r.bankTransactionRef) && (
                          <span
                            className="badge"
                            style={{
                              background: 'rgba(16, 185, 129, 0.15)',
                              color: '#34d399',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                              fontSize: '9.5px',
                              fontWeight: 800,
                              padding: '1px 5px'
                            }}
                          >
                            ⚡ Auto SMS
                          </span>
                        )}
                      </div>
                      <div className="redeem-upi redeem-upi--muted" style={{ fontSize: '11px' }}>{r.upiId}</div>
                      {r.note && <div className="nb-row__desc" style={{ fontSize: '12px' }}>{r.note}</div>}
                      <div className="nb-row__meta" style={{ fontSize: '10px' }}>
                        {r.createdBy?.name || '—'} • settled by {r.closedByName || r.closedBy?.name || (r.source === 'SMS' ? 'Bank SMS (Auto)' : '—')} on {formatDate(r.closedAt)}
                      </div>
                    </div>
                    <div className="nb-row__actions">
                      <button
                        type="button"
                        className="btn btn--ghost btn--xs"
                        disabled={busy === `redeem-${r._id}`}
                        onClick={() => reopenItem(r)}
                        title="Reopen request"
                      >
                        <RotateCcw size={12} /> Reopen
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          className="icon-btn icon-btn--xs"
                          onClick={() => setConfirmDelete(r)}
                          title="Remove"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {filteredClosed.length > pageSize && (
                <div className="pagination" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn--ghost btn--xs"
                    disabled={closedPage === 1}
                    onClick={() => setClosedPage((p) => Math.max(p - 1, 1))}
                  >
                    <ChevronLeft size={14} /> Previous
                  </button>
                  <span className="muted" style={{ fontSize: '11.5px', fontWeight: 600 }}>
                    Page {closedPage} of {closedTotalPages} ({filteredClosed.length} total)
                  </span>
                  <button
                    type="button"
                    className="btn btn--ghost btn--xs"
                    disabled={closedPage >= closedTotalPages}
                    onClick={() => setClosedPage((p) => Math.min(p + 1, closedTotalPages))}
                  >
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      <BottomSheet open={showForm} onClose={() => setShowForm(false)} title="Raise Redeem Request" maxWidth={520}>
        <p className="sheet-subtitle">Money spent for the house, sent to the pre-stored UPI handle after approval.</p>

        <label className="field-label">Housemate Name</label>
        <div className="name-grid" style={{ marginBottom: '16px' }}>
          {housemateList.map((name) => (
            <button
              key={name}
              type="button"
              className={`name-chip ${selectedName === name ? 'name-chip--active' : ''}`}
              onClick={() => handleSelectHousemate(name)}
            >
              {name}
            </button>
          ))}
        </div>

        <label className="field-label">
          UPI ID {selectedName && <span className="muted" style={{ fontWeight: 'normal', fontSize: '12px' }}>(pre-stored for {selectedName})</span>}
        </label>
        <input
          className="text-input"
          placeholder="e.g. name@okbank"
          value={upiInput}
          maxLength={120}
          onChange={(e) => setUpiInput(e.target.value)}
        />

        <label className="field-label">Amount spent</label>
        <div className="amount-input">
          <span className="amount-input__prefix">₹</span>
          <input
            type="number"
            inputMode="decimal"
            min="1"
            step="1"
            placeholder="0"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
          />
        </div>

        <label className="field-label">Note (optional)</label>
        <input
          className="text-input"
          placeholder="e.g. Groceries for the week"
          value={noteInput}
          maxLength={300}
          onChange={(e) => setNoteInput(e.target.value)}
        />

        <div className="notice notice--muted">
          The request stays open until someone handling the account sends the amount and closes it.
        </div>

        <div className="sheet-actions">
          <button type="button" className="btn btn--ghost" onClick={() => setShowForm(false)}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" disabled={busy === 'redeem-add'} onClick={submitRedeem}>
            <Send size={15} /> {busy === 'redeem-add' ? 'Posting…' : 'Post Request'}
          </button>
        </div>
      </BottomSheet>

      <ConfirmModal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={confirmRemove}
        loading={busy === `del-${confirmDelete?._id}`}
        title="Delete Redeem Request"
        message={`Delete the ${formatCurrency(confirmDelete?.amount || 0)} request from ${confirmDelete?.createdBy?.name || 'this housemate'}? This cannot be undone.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
