import { useState, useMemo } from 'react';
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
  Copy
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
  const [confirmPay, setConfirmPay] = useState(null); // redeem being closed
  const [payerName, setPayerName] = useState('');     // who is marking it paid
  const [viewMode, setViewMode] = useState('grouped'); // 'grouped' (combined per person) | 'individual'
  const [openPage, setOpenPage] = useState(1);
  const [closedPage, setClosedPage] = useState(1);
  const pageSize = 8;

  const getUpiFor = (name) => {
    const u = users.find((x) => x.name === name);
    return u?.upiId || DEFAULT_UPI_IDS[name] || (name ? `${name.toLowerCase()}@okaxis` : '');
  };

  const handleCopyAndPay = (upiId, amount) => {
    navigator.clipboard.writeText(upiId);
    toast.show(`✓ UPI Copied! Amount: ₹${amount}`);
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

  // Close — no PIN, just name selection (supports single item or grouped items)
  const handleConfirmPay = async () => {
    if (!payerName) { toast.show('Please select your name', 'error'); return; }
    const target = confirmPay;
    setConfirmPay(null);

    if (target?.type === 'group') {
      setBusy(`group-${target.name}`);
      try {
        for (const it of target.items) {
          await redeemApi.closeRedeem(payerName, it._id);
        }
        toast.show(`✓ Marked all ${target.items.length} requests for ${target.name} as paid (${formatCurrency(target.amount)})`);
        await reloadRedeems();
        await reloadExpenses();
      } catch (err) {
        toast.show(err?.response?.data?.message || err.message, 'error');
      } finally {
        setBusy('');
        setPayerName('');
      }
    } else {
      const r = target?.item || target;
      if (!r?._id) return;
      setBusy(`redeem-${r._id}`);
      try {
        await redeemApi.closeRedeem(payerName, r._id);
        toast.show('✓ Marked paid — expense added & balance updated');
        await reloadRedeems();
        await reloadExpenses();
      } catch (err) {
        toast.show(err?.response?.data?.message || err.message, 'error');
      } finally {
        setBusy('');
        setPayerName('');
      }
    }
  };

  const confirmRemove = async () => {
    const target = confirmDelete;
    setConfirmDelete(null);
    await run({ busy: `del-${target._id}`, pin: { title: 'Delete Redeem Request', subtitle: `${target.createdBy?.name} • ${formatCurrency(target.amount)}`, adminOnly: true } }, (t) => redeemApi.deleteRedeem(t, target._id), '✓ Removed');
  };

  const open = (redeems || []).filter((r) => !r.closed);
  const closed = (redeems || []).filter((r) => r.closed);

  // Group open redeems by housemate
  const groupedOpen = useMemo(() => {
    const map = new Map();
    for (const r of open) {
      const person = r.createdBy?.name || 'Unknown';
      if (!map.has(person)) {
        map.set(person, {
          personName: person,
          upiId: r.upiId || getUpiFor(person),
          items: [],
          totalAmount: 0,
          latestDate: r.createdAt
        });
      }
      const group = map.get(person);
      group.items.push(r);
      group.totalAmount += Number(r.amount) || 0;
      if (new Date(r.createdAt) > new Date(group.latestDate)) {
        group.latestDate = r.createdAt;
        if (r.upiId) group.upiId = r.upiId;
      }
    }
    // Sort items inside each group: latest first
    for (const group of map.values()) {
      group.items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    // Sort groups: highest total sum first
    return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [open, users]);

  const openTotalPages = Math.ceil(open.length / pageSize) || 1;
  const paginatedOpen = open.slice((openPage - 1) * pageSize, openPage * pageSize);

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
              <Layers size={12} /> Combined ({groupedOpen.length})
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
                        <a
                          href="intent://pay#Intent;scheme=upi;end"
                          onClick={() => handleCopyAndPay(group.upiId, group.totalAmount)}
                          className="btn btn--primary btn--xs"
                          style={{ textDecoration: 'none', gap: '4px' }}
                          title={`Copy & pay ₹${group.totalAmount} to ${group.upiId}`}
                        >
                          <Smartphone size={12} /> Pay
                        </a>
                        <button
                          type="button"
                          className="btn btn--ghost btn--xs"
                          disabled={busy === `group-${group.personName}`}
                          onClick={() =>
                            setConfirmPay({
                              type: 'group',
                              items: group.items,
                              amount: group.totalAmount,
                              name: group.personName,
                              upiId: group.upiId
                            })
                          }
                          title={`Close all ${group.items.length} requests for ${group.personName}`}
                        >
                          <CheckCircle2 size={12} /> {group.items.length > 1 ? 'Settle All' : 'Close'}
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
                              disabled={busy === `redeem-${item._id}`}
                              onClick={() =>
                                setConfirmPay({
                                  type: 'single',
                                  item: item,
                                  amount: item.amount,
                                  name: group.personName,
                                  upiId: item.upiId || group.upiId
                                })
                              }
                              title="Settle this specific item"
                            >
                              <CheckCircle2 size={11} /> Settle
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
                    <a
                      href="intent://pay#Intent;scheme=upi;end"
                      onClick={() => handleCopyAndPay(r.upiId, r.amount)}
                      className="btn btn--primary btn--xs"
                      style={{ textDecoration: 'none', gap: '4px' }}
                      title={`Pay ₹${r.amount} to ${r.upiId}`}
                    >
                      <Smartphone size={11} /> Pay
                    </a>
                    <button
                      type="button"
                      className="btn btn--ghost btn--xs"
                      disabled={busy === `redeem-${r._id}`}
                      onClick={() =>
                        setConfirmPay({
                          type: 'single',
                          item: r,
                          amount: r.amount,
                          name: r.createdBy?.name,
                          upiId: r.upiId
                        })
                      }
                      title="Mark as settled"
                    >
                      <CheckCircle2 size={11} /> Close
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {open.length > pageSize && (
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
        )
      ) : (
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

      {/* "Mark as Paid" — name picker only, no PIN */}
      <BottomSheet
        open={Boolean(confirmPay)}
        onClose={() => { setConfirmPay(null); setPayerName(''); }}
        title="Who paid this? 💸"
      >
        <p className="sheet-subtitle">
          {formatCurrency(confirmPay?.amount || 0)} to {confirmPay?.name || confirmPay?.createdBy?.name || 'housemate'} ({confirmPay?.upiId || '—'})
          {confirmPay?.type === 'group' && confirmPay?.items?.length > 1 && (
            <span style={{ display: 'block', marginTop: '4px', color: '#60a5fa', fontWeight: 600 }}>
              • Settle all {confirmPay.items.length} requests at once
            </span>
          )}
        </p>
        <p className="muted" style={{ fontSize: '13px', margin: '4px 0 12px' }}>
          Select your name — this will close the request{confirmPay?.type === 'group' && confirmPay?.items?.length > 1 ? 's' : ''} and add {confirmPay?.type === 'group' && confirmPay?.items?.length > 1 ? 'them' : 'it'} as expense{confirmPay?.type === 'group' && confirmPay?.items?.length > 1 ? 's' : ''}.
        </p>
        <div className="field-label">Select your name</div>
        <div className="name-grid" style={{ marginBottom: '16px' }}>
          {housemateList.map((name) => (
            <button
              key={name}
              type="button"
              className={`name-chip ${payerName === name ? 'name-chip--active' : ''}`}
              onClick={() => setPayerName(name)}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="sheet-actions">
          <button type="button" className="btn btn--ghost" onClick={() => { setConfirmPay(null); setPayerName(''); }}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!payerName || (confirmPay?.type === 'group' ? busy === `group-${confirmPay?.name}` : busy === `redeem-${(confirmPay?.item || confirmPay)?._id}`)}
            onClick={handleConfirmPay}
          >
            {(confirmPay?.type === 'group' ? busy === `group-${confirmPay?.name}` : busy === `redeem-${(confirmPay?.item || confirmPay)?._id}`) ? (
              <><span className="spinner" /> Saving…</>
            ) : confirmPay?.type === 'group' && confirmPay?.items?.length > 1 ? (
              `✓ Mark All ${confirmPay.items.length} Paid`
            ) : (
              '✓ Mark as Paid'
            )}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
