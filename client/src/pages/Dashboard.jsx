import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  ArrowDownLeft,
  Users,
  TrendingUp,
  ChevronRight,
  CheckCircle2,
  QrCode,
  Smartphone,
  Pencil,
  Building2,
  RefreshCw,
  Eye,
  EyeOff,
  Copy,
  Sparkles,
  Receipt
} from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import * as fundingApi from '../services/funding';
import { getBankBalance, syncBankBalance, getBankTransactions } from '../services/bank';
import { useBankEvents } from '../hooks/useBankEvents';
import { resolveMediaUrl } from '../services/api';
import ProgressBar from '../components/ProgressBar';
import CountUp from '../components/CountUp';
import Skeleton from '../components/Skeleton';
import DutyBlock from '../components/DutyBlock';
import CategoryIcon from '../components/CategoryIcon';
import EmptyState from '../components/EmptyState';
import BottomSheet from '../components/BottomSheet';
import ConfirmModal from '../components/ConfirmModal';
import PushNotificationBanner from '../components/PushNotificationBanner';
import { formatCurrency, formatDate, todayDayName, deadlineInfo } from '../utils/format';

export default function Dashboard() {
  const { funding, expenses, today, users, loading, reloadFunding } = useApp();
  const { isAdmin, runWithAuth } = useAuth();
  const toast = useToast();
  const reduced = useReducedMotion();

  const [qrModal, setQrModal] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [editAccountOpen, setEditAccountOpen] = useState(false);
  const [editUpiInput, setEditUpiInput] = useState('');
  const [editQrImage, setEditQrImage] = useState(null);
  const [accountBusy, setAccountBusy] = useState(false);

  // Live Bank Account Balance & Transactions State
  const [bankData, setBankData] = useState(null);
  const [bankTransactions, setBankTransactions] = useState([]);
  const [bankSyncing, setBankSyncing] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [loadingTxns, setLoadingTxns] = useState(true);

  const loadBank = async () => {
    try {
      const [data, txsRes] = await Promise.all([
        getBankBalance(),
        getBankTransactions(6)
      ]);
      setBankData(data);
      const list = txsRes?.data || (Array.isArray(txsRes) ? txsRes : []);
      setBankTransactions(list);
    } catch (_) {
    } finally {
      setLoadingTxns(false);
    }
  };

  useEffect(() => {
    loadBank();
  }, []);

  useBankEvents((update) => {
    loadBank();
    const type = update?.parsed?.type || update?.transaction?.type;
    const amt = update?.parsed?.amount || update?.transaction?.amount;
    const to = update?.parsed?.recipient || update?.transaction?.recipient;
    if (amt) {
      toast.show(`⚡ Bank SMS Received: ₹${amt.toLocaleString('en-IN')} ${type === 'DEBIT' ? 'Debited' : 'Credited'}${to ? ` (${to})` : ''}`);
    }
  });

  const handleSyncBank = async () => {
    try {
      setBankSyncing(true);
      const [res, txsRes] = await Promise.all([
        syncBankBalance(),
        getBankTransactions(6)
      ]);
      if (res?.data) setBankData(res.data);
      const list = txsRes?.data || (Array.isArray(txsRes) ? txsRes : []);
      setBankTransactions(list);
      toast.show('✓ Live bank balance and transactions refreshed');
    } catch (err) {
      toast.show(err.message || 'Failed to refresh bank balance', 'error');
    } finally {
      setBankSyncing(false);
    }
  };

  const qrFileRef = useRef(null);

  const commonUpi = funding?.commonAccount?.upiId || 'sweethome@okaxis';
  const commonQr = funding?.commonAccount?.qrImage || '/sweethome_upi_qr.png';

  const copyUpi = () => {
    navigator.clipboard.writeText(commonUpi);
    setCopiedUpi(true);
    toast.show('✓ Common UPI ID copied!');
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const copyAndOpenGPay = () => {
    navigator.clipboard.writeText(commonUpi);
    setCopiedUpi(true);
    toast.show('✓ Copied! Paste this in GPay');
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const openEditAccount = () => {
    setEditUpiInput(commonUpi);
    setEditQrImage(null);
    setEditAccountOpen(true);
  };

  const onPickQrFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.show('Only JPEG, PNG, or WebP images are allowed.', 'error');
      return;
    }
    if (file.size > 1 * 1024 * 1024) {
      toast.show('Image too large — max 1 MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setEditQrImage(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const saveAccountSettings = async () => {
    const cleanUpi = editUpiInput.trim();
    const UPI_PATTERN = /^[^\s@]+@[a-zA-Z]{2,}$/;
    if (!cleanUpi || !UPI_PATTERN.test(cleanUpi)) {
      toast.show('Enter a valid UPI ID (e.g. name@okbank)', 'error');
      return;
    }
    setAccountBusy(true);
    try {
      await runWithAuth(
        { title: 'Update Common Account', subtitle: 'Admin PIN required', adminOnly: true },
        async (token) => {
          const payload = { upiId: cleanUpi };
          if (editQrImage) payload.qrImage = editQrImage;
          await fundingApi.updateCommonAccount(token, payload);
        }
      );
      toast.show('✓ Common account updated');
      setEditAccountOpen(false);
      await reloadFunding();
    } catch (err) {
      if (err.message !== 'Cancelled') toast.show(err.message, 'error');
    } finally {
      setAccountBusy(false);
    }
  };

  const pct = funding ? Math.round((funding.totalCollected / funding.targetAmount) * 100) : 0;
  const recent = bankTransactions.length > 0
    ? bankTransactions.slice(0, 4)
    : expenses.slice(0, 3).map((e) => ({
        _id: e._id,
        type: 'DEBIT',
        amount: e.amount,
        description: e.description || e.category,
        recipient: e.paidBy?.name,
        date: e.expenseDate || e.createdAt,
        source: 'MANUAL',
        category: e.category
      }));
  const deadline = deadlineInfo();

  return (
    <div className="page">
      <PushNotificationBanner />
      {loading.funding ? (
        <div className="stack">
          <Skeleton height={140} />
          <Skeleton height={120} />
          <Skeleton height={120} />
        </div>
      ) : (
        <div className="dashboard-grid">
          {/* Primary Bank Account Hero Card */}
          <section className="dash-hero dash-card-neat">
            <div className="dash-card__header">
              <div className="dash-card__title-lockup">
                <div className="dash-card__icon-box dash-card__icon-box--blue">
                  <Building2 size={16} />
                </div>
                <div>
                  <div className="dash-card__title">
                    <span>{bankData?.bankName || 'IDFC FIRST Bank'}</span>
                    <span className="dash-live-badge">
                      <span className="dash-live-dot" /> LIVE
                    </span>
                  </div>
                  <div className="dash-card__subtitle">
                    A/C •••• {bankData?.accountLast4 || '4202'}
                  </div>
                </div>
              </div>

              <div className="dash-card__actions">
                <button
                  type="button"
                  className="dash-icon-btn"
                  onClick={() => setShowBalance(!showBalance)}
                  title={showBalance ? 'Hide balance' : 'Show balance'}
                >
                  {showBalance ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button
                  type="button"
                  className="dash-icon-btn"
                  onClick={handleSyncBank}
                  disabled={bankSyncing}
                  title="Refresh live bank balance"
                >
                  <RefreshCw size={14} className={bankSyncing ? 'spin' : ''} />
                </button>
                {isAdmin && <span className="badge badge--admin" style={{ marginLeft: '2px', fontSize: '10px', padding: '1px 5px' }}>Admin</span>}
              </div>
            </div>

            <div className="dash-card__body">
              <div className="dash-card__eyebrow">PRIMARY ACCOUNT BALANCE</div>
              <div className="dash-card__balance">
                {showBalance ? (
                  <CountUp value={bankData?.balance ?? funding.balance} format={formatCurrency} duration={1000} />
                ) : (
                  <span>••••••••</span>
                )}
              </div>
            </div>

            <div className={`dash-hero__stats ${funding.rolloverBalance > 0 ? 'dash-hero__stats--3col' : ''}`}>
              <div className="dash-stat">
                <span className="dash-stat__label">Collected</span>
                <span className="dash-stat__val dash-stat__val--green">
                  <CountUp value={funding.totalCollected} format={formatCurrency} duration={1000} />
                </span>
              </div>
              <div className="dash-stat">
                <span className="dash-stat__label">Spent</span>
                <span className="dash-stat__val dash-stat__val--red">
                  <CountUp value={funding.totalSpent} format={formatCurrency} duration={1000} />
                </span>
              </div>
              {funding.rolloverBalance > 0 && (
                <div className="dash-stat">
                  <span className="dash-stat__label">Rollover</span>
                  <span className="dash-stat__val dash-stat__val--amber">
                    <CountUp value={funding.rolloverBalance} format={formatCurrency} duration={1000} />
                  </span>
                </div>
              )}
            </div>
          </section>

          <section className="card dash-fund dash-card-neat">
            <div className="dash-card__header">
              <div className="dash-card__title-lockup">
                <div className="dash-card__icon-box dash-card__icon-box--indigo">
                  <Users size={16} />
                </div>
                <div>
                  <div className="dash-card__title">Monthly Fund</div>
                  <div className="dash-card__subtitle">
                    <CountUp value={pct} format={(n) => `${Math.round(n)}%`} /> Collected
                  </div>
                </div>
              </div>
              <Link to="/collection" className="link-btn">
                Details <ArrowRight size={13} />
              </Link>
            </div>

            <div className="dash-card__body">
              <div className="dash-card__progress-target">
                <span className="dash-card__collected-amt">
                  <CountUp value={funding.totalCollected} format={formatCurrency} />
                </span>
                <span className="dash-card__target-amt">
                  / {formatCurrency(funding.targetAmount)}
                </span>
              </div>
              <ProgressBar value={funding.totalCollected} max={funding.targetAmount} />
            </div>

            <div className="dash-card__footer">
              <span className="dash-stat__label" style={{ fontWeight: 600, color: '#e2e8f0' }}>
                <CountUp value={funding.paidCount} />/{funding.paidCount + funding.pendingCount} paid
              </span>
              <span className={`dash-status-pill ${funding.paidCount === funding.payments.length && funding.pendingCount === 0 && funding.partialCount === 0 ? 'dash-status-pill--success' : (deadline.passed ? 'dash-status-pill--danger' : '')}`}>
                {funding.paidCount === funding.payments.length && funding.pendingCount === 0 && funding.partialCount === 0 ? '🎉 All paid' : deadline.text}
              </span>
            </div>
          </section>

          <section className="card dash-qr dash-card-neat">
            <div className="dash-card__header">
              <div className="dash-card__title-lockup">
                <div className="dash-card__icon-box dash-card__icon-box--purple">
                  <QrCode size={16} />
                </div>
                <div>
                  <div className="dash-card__title">House UPI & QR</div>
                  <div className="dash-card__subtitle">Instant house payments</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="badge badge--today" style={{ fontSize: '10px', padding: '1px 6px' }}>Active</span>
                {isAdmin && (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={openEditAccount}
                    title="Edit Common Account & QR Code"
                    style={{ padding: '2px 7px', fontSize: '11px', height: '24px' }}
                  >
                    <Pencil size={11} /> Edit
                  </button>
                )}
              </div>
            </div>

            <div className="dash-card__body dash-qr__body">
              <div
                onClick={() => setQrModal(true)}
                className="dash-qr__thumb"
                title="Tap to view full QR code"
              >
                <img
                  src={resolveMediaUrl(commonQr)}
                  alt="Sweet Home UPI QR Code"
                />
              </div>
              <div className="dash-qr__info">
                <div className="dash-card__eyebrow">UPI ID</div>
                <div className="dash-upi-copy-row">
                  <span className="dash-upi-text" title={commonUpi}>{commonUpi}</span>
                  <button
                    type="button"
                    onClick={copyUpi}
                    className="dash-upi-copy-btn"
                    title="Copy UPI ID"
                  >
                    {copiedUpi ? <CheckCircle2 size={13} style={{ color: '#34d399' }} /> : <Copy size={13} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="dash-card__footer" style={{ borderTop: 'none', paddingTop: 0 }}>
              <a
                href="intent://pay#Intent;scheme=upi;end"
                onClick={copyAndOpenGPay}
                className="dash-pay-btn"
              >
                <Smartphone size={13} /> Pay via UPI
              </a>
            </div>
          </section>

          <section className="card card--tint floaty floaty--2 dash-expenses dash-card-neat">
            <div className="dash-card__header">
              <div className="dash-card__title-lockup">
                <div className="dash-card__icon-box dash-card__icon-box--amber">
                  <TrendingUp size={16} />
                </div>
                <div>
                  <div className="dash-card__title">Expenses</div>
                  <div className="dash-card__subtitle">Spent this month</div>
                </div>
              </div>
              <Link to="/expenses" className="link-btn">
                Ledger <ChevronRight size={13} />
              </Link>
            </div>

            <div className="dash-card__body">
              <div className="dash-card__balance dash-card__balance--expense">
                <CountUp value={funding.totalSpent} format={formatCurrency} />
              </div>
            </div>

            <div className="dash-card__footer">
              <span className="muted" style={{ fontSize: '11px' }}>Auto bank tracking</span>
              <Link to="/expenses" className="link-btn" style={{ fontSize: '12px' }}>
                View all →
              </Link>
            </div>
          </section>

          <section className="card dash-duties dash-card-neat">
            <div className="dash-card__header">
              <div className="dash-card__title-lockup">
                <div className="dash-card__icon-box dash-card__icon-box--green">
                  <Sparkles size={16} />
                </div>
                <div>
                  <div className="dash-card__title">
                    <span>Today's Duties</span>
                    <span className="badge badge--today" style={{ fontSize: '10px', padding: '1px 6px' }}>{todayDayName()}</span>
                  </div>
                  <div className="dash-card__subtitle">Daily chore assignments</div>
                </div>
              </div>
              <Link to="/chores" className="link-btn">
                Schedule <ArrowRight size={13} />
              </Link>
            </div>

            <div className="dash-card__body" style={{ margin: '6px 0 0' }}>
              {loading.chores || !today ? (
                <Skeleton height={110} />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                  <DutyBlock role="cooking" members={today.cooking} />
                  <DutyBlock role="cleaning" members={today.cleaning} />
                  <DutyBlock role="homeClean" members={today.homeClean ? [today.homeClean] : []} />
                </div>
              )}
            </div>
          </section>

          <section className="card dash-recent dash-card-neat">
            <div className="dash-card__header">
              <div className="dash-card__title-lockup">
                <div className="dash-card__icon-box dash-card__icon-box--amber">
                  <Receipt size={16} />
                </div>
                <div>
                  <div className="dash-card__title">Recent Transactions</div>
                  <div className="dash-card__subtitle">Latest bank & house activity</div>
                </div>
              </div>
              <Link to="/expenses" className="link-btn">
                All Transactions <ArrowRight size={13} />
              </Link>
            </div>

            <div className="dash-card__body" style={{ margin: '4px 0 0' }}>
              {loadingTxns && loading.expenses ? (
                <div className="stack" style={{ gap: '8px' }}>
                  <Skeleton height={46} />
                  <Skeleton height={46} />
                </div>
              ) : recent.length === 0 ? (
                <EmptyState icon="🧾" title="No transactions yet" subtitle="Sync bank SMS or add an expense to see activity." />
              ) : (
                <div className="mini-ledger" style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  {recent.map((t) => (
                    <div
                      key={t._id}
                      className="mini-ledger__row"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 14px',
                        borderRadius: '12px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.06)'
                      }}
                    >
                      {t.type === 'CREDIT' ? (
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#34d399',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          <ArrowDownLeft size={16} />
                        </div>
                      ) : (
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: 'rgba(239, 68, 68, 0.12)',
                            color: '#f87171',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          <ArrowUpRight size={16} />
                        </div>
                      )}
                      <div className="mini-ledger__body">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="mini-ledger__cat" style={{ color: '#fff', fontSize: '13px', fontWeight: 600 }}>
                            {t.description || t.recipient || (t.type === 'CREDIT' ? 'Credit Received' : 'UPI Payment')}
                          </span>
                          <span
                            style={{
                              fontSize: '9px',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              fontWeight: 800,
                              letterSpacing: '0.3px',
                              textTransform: 'uppercase',
                              flexShrink: 0,
                              background: t.type === 'DEBIT' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                              color: t.type === 'DEBIT' ? '#f87171' : '#34d399',
                              border: t.type === 'DEBIT' ? '1px solid rgba(239, 68, 68, 0.28)' : '1px solid rgba(16, 185, 129, 0.28)'
                            }}
                          >
                            {t.type === 'DEBIT' ? 'Debit' : 'Credit'}
                          </span>
                        </div>
                        <div className="mini-ledger__meta">
                          {formatDate(t.date || t.createdAt)} {t.source ? `• ${t.source}` : ''}{t.recipient && t.recipient !== t.description ? ` • ${t.recipient}` : ''}
                        </div>
                      </div>
                      <div
                        className="mini-ledger__amt"
                        style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          color: t.type === 'CREDIT' ? '#34d399' : '#f87171'
                        }}
                      >
                        {t.type === 'CREDIT' ? '+' : '-'} {formatCurrency(t.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      <BottomSheet open={qrModal} onClose={() => setQrModal(false)} title="Sweet Home Common Account QR">
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          <img
            src={resolveMediaUrl(commonQr)}
            alt="Sweet Home Common Account QR"
            style={{ maxWidth: '280px', width: '100%', height: 'auto', borderRadius: '16px', border: '1px solid var(--border)' }}
          />
          <div className="redeem-upi" style={{ fontSize: '18px', fontWeight: 800, margin: '14px 0 8px' }}>
            {commonUpi}
          </div>
          <p className="muted" style={{ fontSize: '13px', margin: '0 0 16px' }}>
            Scan using GPay, PhonePe, Paytm, or any UPI app to transfer funds directly to the house account.
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <a
              href="intent://pay#Intent;scheme=upi;end"
              onClick={copyAndOpenGPay}
              className="btn btn--primary"
              style={{ textDecoration: 'none' }}
            >
              <Smartphone size={15} /> Copy & Pay
            </a>
          </div>
        </div>
      </BottomSheet>

      <BottomSheet open={editAccountOpen} onClose={() => setEditAccountOpen(false)} title="Edit Common Account">
        <p className="sheet-subtitle">Update pre-stored UPI ID & QR Code for the house common account.</p>
        <label className="field-label">UPI ID</label>
        <input
          className="text-input"
          type="text"
          value={editUpiInput}
          onChange={(e) => setEditUpiInput(e.target.value)}
          placeholder="e.g. sweethome@okaxis"
        />

        <label className="field-label" style={{ marginTop: '14px' }}>QR Code Image</label>
        <input
          ref={qrFileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="visually-hidden"
          onChange={onPickQrFile}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '6px' }}>
          <img
            src={resolveMediaUrl(editQrImage || commonQr)}
            alt="QR Code Preview"
            style={{ width: '80px', height: '80px', borderRadius: '12px', border: '1px solid var(--border)', objectFit: 'cover' }}
          />
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => qrFileRef.current?.click()}
          >
            Upload New QR Image
          </button>
        </div>

        <div className="sheet-actions" style={{ marginTop: '20px' }}>
          <button type="button" className="btn btn--ghost" onClick={() => setEditAccountOpen(false)}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" disabled={accountBusy} onClick={saveAccountSettings}>
            {accountBusy ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
