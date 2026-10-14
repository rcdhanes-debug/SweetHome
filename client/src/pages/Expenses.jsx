
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Building2,
  RefreshCw,
  Plus,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Calendar,
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  TrendingDown,
  TrendingUp,
  Receipt,
  Zap,
  Copy,
  Check,
  ShieldCheck,
  Eye,
  EyeOff
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import * as expenseApi from '../services/expenses';
import * as fundingApi from '../services/funding';
import { getBankBalance, getBankTransactions, syncBankBalance } from '../services/bank';
import { useBankEvents } from '../hooks/useBankEvents';
import StatCard from '../components/StatCard';
import ExpenseForm from '../components/ExpenseForm';
import BottomSheet from '../components/BottomSheet';
import ConfirmModal from '../components/ConfirmModal';
import Confetti from '../components/Confetti';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import CountUp from '../components/CountUp';
import { formatCurrency, formatDateTime, formatDate, formatTime, monthKey, monthLabel, todayISTDateString } from '../utils/format';

export default function Expenses() {
  const { history, users, reloadExpenses, reloadFunding } = useApp();
  const { session, runWithAuth } = useAuth();
  const toast = useToast();

  const currentMonthKey = useMemo(() => monthKey(), []);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
  const [transactions, setTransactions] = useState([]);
  const [bankData, setBankData] = useState(null);
  const [loadingLedger, setLoadingLedger] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showBalance, setShowBalance] = useState(true);

  // Filters & Search
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'DEBIT' | 'CREDIT'
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  // Manual Expense modal
  const [sheetOpen, setSheetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  // Webhook Guide Accordion
  const [showWebhookGuide, setShowWebhookGuide] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const backendBase = (import.meta.env.VITE_API_URL || '').startsWith('http')
    ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
    : (window.location.hostname === 'localhost'
      ? 'https://sweet-home-backend-y21s.onrender.com'
      : window.location.origin);
  const webhookUrl = `${backendBase}/api/bank/sms-webhook?secret=sweet_home_secure_2026`;

  const isCurrentMonth = selectedMonth === currentMonthKey;

  // Generate available month options
  const monthOptions = useMemo(() => {
    const set = new Set();
    set.add(currentMonthKey);

    const now = new Date();
    for (let i = 0; i < 12; i += 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      set.add(monthKey(d));
    }

    if (Array.isArray(history)) {
      history.forEach((h) => {
        if (h.month) set.add(h.month);
      });
    }

    return Array.from(set)
      .sort((a, b) => b.localeCompare(a))
      .map((key) => ({
        key,
        label: monthLabel(key),
        isCurrent: key === currentMonthKey
      }));
  }, [currentMonthKey, history]);

  // Load bank ledger and balance for selectedMonth
  const loadLedger = useCallback(async (month) => {
    setLoadingLedger(true);
    try {
      const [txnsRes, balRes] = await Promise.all([
        getBankTransactions(150, month),
        getBankBalance()
      ]);
      setTransactions(txnsRes?.data || txnsRes || []);
      setBankData(balRes);
    } catch (err) {
      console.error('Failed to load transaction ledger:', err);
      toast.show('Failed to fetch transaction ledger', 'error');
    } finally {
      setLoadingLedger(false);
    }
  }, [toast]);

  useEffect(() => {
    loadLedger(selectedMonth);
    setPage(1);
  }, [selectedMonth, loadLedger]);

  // Real-time listener for incoming bank SMS
  useBankEvents((update) => {
    loadLedger(selectedMonth);
    const type = update?.parsed?.type || update?.transaction?.type;
    const amt = update?.parsed?.amount || update?.transaction?.amount;
    const to = update?.parsed?.recipient || update?.transaction?.recipient;
    if (amt) {
      toast.show(`⚡ Bank SMS: ₹${amt.toLocaleString('en-IN')} ${type === 'DEBIT' ? 'Debited' : 'Credited'}${to ? ` (${to})` : ''}`);
    }
  });

  const handleSync = async () => {
    try {
      setSyncing(true);
      const res = await syncBankBalance();
      if (res?.data) setBankData(res.data);
      await loadLedger(selectedMonth);
      toast.show('✓ Bank status and ledger refreshed');
    } catch (err) {
      toast.show(err.message || 'Failed to sync bank balance', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopiedUrl(true);
      toast.show('✓ Webhook URL copied!');
      setTimeout(() => setCopiedUrl(false), 2500);
    } catch (_) {
      toast.show('Could not copy automatically.', 'info');
    }
  };

  // Month navigation
  const handleNavigateMonth = (direction) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const nextDate = new Date(Date.UTC(y, m - 1 + direction, 1));
    const nextKey = monthKey(nextDate);
    if (nextKey <= currentMonthKey) {
      setSelectedMonth(nextKey);
    }
  };

  // Filter & Search logic
  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (filterType !== 'ALL' && t.type !== filterType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const descMatch = (t.description || '').toLowerCase().includes(q);
        const refMatch = (t.reference || '').toLowerCase().includes(q);
        const recipientMatch = (t.recipient || '').toLowerCase().includes(q);
        return descMatch || refMatch || recipientMatch;
      }
      return true;
    });
  }, [transactions, filterType, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedTransactions = filtered.slice((page - 1) * pageSize, page * pageSize);

  // Month totals
  const totalDebits = transactions
    .filter((t) => t.type === 'DEBIT')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const totalCredits = transactions
    .filter((t) => t.type === 'CREDIT')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const handleAddManualExpense = async (data) => {
    setSubmitting(true);
    try {
      await expenseApi.create(data);
      toast.show('✓ Manual expense added to ledger');
      setSheetOpen(false);
      setCelebrate(true);
      await loadLedger(selectedMonth);
      await reloadExpenses();
      await reloadFunding();
    } catch (err) {
      toast.show(err.message || 'Failed to add expense', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      {celebrate && <Confetti onDone={() => setCelebrate(false)} />}

      {/* Primary Bank Hero Card (Compact & Sleek) */}
      <section
        className="card"
        style={{
          background: 'linear-gradient(145deg, rgba(22, 28, 44, 0.85), rgba(15, 19, 32, 0.94))',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '14px',
          padding: '12px 16px',
          marginBottom: '14px',
          color: '#fff',
          boxShadow: '0 4px 18px -2px rgba(0, 0, 0, 0.35)'
        }}
      >
        <div className="expenses-hero-wrap" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          {/* Left: Bank branding + Balance */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(59, 130, 246, 0.15)',
              color: '#60a5fa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Building2 size={16} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#fff', letterSpacing: '-0.2px' }}>
                  {bankData?.bankName || 'IDFC FIRST Bank'}
                </span>
                <span style={{ fontSize: '9.5px', padding: '1px 6px', borderRadius: '999px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', fontWeight: 800, border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  LIVE
                </span>
                <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.55)' }}>
                  •••• {bankData?.accountLast4 || '4202'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '1px' }}>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)', fontWeight: 600 }}>Balance:</span>
                <span style={{ fontSize: '17px', fontWeight: 800, color: '#fff' }}>
                  {showBalance ? (
                    <CountUp value={bankData?.balance || 0} format={formatCurrency} duration={1000} />
                  ) : (
                    <span>••••••••</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Inline month stats & Actions */}
          <div className="expenses-hero-stats-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              padding: '4px 10px',
              borderRadius: '8px',
              fontSize: '11.5px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: 'var(--muted)' }}>Debits:</span>
                <span style={{ fontWeight: 700, color: '#f87171' }}>
                  <CountUp value={totalDebits} format={formatCurrency} duration={1000} />
                </span>
              </div>
              <div style={{ width: '1px', height: '12px', background: 'rgba(255, 255, 255, 0.1)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: 'var(--muted)' }}>Credits:</span>
                <span style={{ fontWeight: 700, color: '#34d399' }}>
                  <CountUp value={totalCredits} format={formatCurrency} duration={1000} />
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setShowBalance(!showBalance)}
                title={showBalance ? 'Hide balance' : 'Show balance'}
                style={{ width: '28px', height: '28px', padding: 0, borderRadius: '7px', background: 'rgba(255, 255, 255, 0.05)', color: 'rgba(255, 255, 255, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)' }}
              >
                {showBalance ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={handleSync}
                disabled={syncing || loadingLedger}
                title="Refresh live bank balance"
                style={{ width: '28px', height: '28px', padding: 0, borderRadius: '7px', background: 'rgba(255, 255, 255, 0.05)', color: 'rgba(255, 255, 255, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)' }}
              >
                <RefreshCw size={13} className={syncing ? 'spin' : ''} />
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setShowWebhookGuide(!showWebhookGuide)}
                title="Auto Forward SMS Webhook Setup"
                style={{ height: '28px', padding: '0 8px', borderRadius: '7px', background: 'rgba(16, 185, 129, 0.12)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.25)', gap: '4px', fontSize: '11px', fontWeight: 700 }}
              >
                <Zap size={12} color="#34d399" />
                <span>SMS Setup</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Auto Forward SMS Setup Guide Accordion */}
      {showWebhookGuide && (
        <section className="card" style={webhookGuideCardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <Zap size={16} color="#34d399" />
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: 'var(--text)' }}>
              Auto Forward SMS App Webhook Configuration
            </h4>
          </div>
          <p style={{ margin: '0 0 10px', fontSize: '12px', color: 'var(--muted)', lineHeight: '1.5' }}>
            Receive real-time bank SMS notifications from your Android phone and post them directly to this ledger.
          </p>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
            <input
              type="text"
              readOnly
              value={webhookUrl}
              className="text-input"
              style={{ fontFamily: 'monospace', fontSize: '11px', height: '34px', background: 'rgba(0,0,0,0.25)', flex: 1 }}
            />
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={handleCopyUrl}
              style={{ gap: '6px', whiteSpace: 'nowrap', height: '34px', padding: '0 12px' }}
            >
              {copiedUrl ? <Check size={14} /> : <Copy size={14} />}
              {copiedUrl ? 'Copied' : 'Copy Webhook URL'}
            </button>
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--muted)', lineHeight: '1.6' }}>
            • <b>Filter:</b> Sender contains <code>IDFC</code><br />
            • <b>Exclude rule:</b> <code>OTP, verification, password</code><br />
            • <b>Method:</b> <code>POST</code> with Webhook URL above
          </div>
        </section>
      )}

      {/* Month Switcher Header */}
      <div className="month-switcher-card">
        <div className="month-switcher__controls">
          <button
            type="button"
            className="icon-btn"
            onClick={() => handleNavigateMonth(-1)}
            title="Previous month"
          >
            <ChevronLeft size={16} />
          </button>

          <div className="month-switcher__select-wrapper">
            <select
              className="month-switcher__select"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              {monthOptions.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label} {m.isCurrent ? '(Current Month)' : ''}
                </option>
              ))}
            </select>
            <div className="month-switcher__label">
              <Calendar size={15} style={{ opacity: 0.7 }} />
              <span className="month-switcher__title">{monthLabel(selectedMonth)}</span>
              {isCurrentMonth ? (
                <span className="badge badge--today">Current</span>
              ) : (
                <span className="badge badge--admin">Past</span>
              )}
            </div>
          </div>

          <button
            type="button"
            className="icon-btn"
            onClick={() => handleNavigateMonth(1)}
            disabled={isCurrentMonth}
            title="Next month"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {!isCurrentMonth && (
          <div className="month-switcher__banner">
            <span>Viewing ledger for <strong>{monthLabel(selectedMonth)}</strong></span>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setSelectedMonth(currentMonthKey)}
            >
              <RotateCcw size={13} /> Current Month
            </button>
          </div>
        )}
      </div>

      {/* Action Bar: Add Manual Expense */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          type="button"
          className="btn btn--primary btn--block btn--lg"
          onClick={() => setSheetOpen(true)}
          style={{ gap: '8px' }}
        >
          <Plus size={18} /> Add Manual Expense
        </button>
      </div>

      {/* Search & Filter Controls */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '180px', position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--muted)' }} />
          <input
            type="text"
            className="text-input"
            placeholder="Search payee, reference or description..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            style={{ paddingLeft: '32px', height: '34px', fontSize: '12px' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '4px', background: 'var(--surface-2)', padding: '2px', borderRadius: '8px' }}>
          {['ALL', 'DEBIT', 'CREDIT'].map((t) => (
            <button
              key={t}
              type="button"
              className={`btn btn--sm ${filterType === t ? 'btn--primary' : 'btn--ghost'}`}
              onClick={() => {
                setFilterType(t);
                setPage(1);
              }}
              style={{ fontSize: '11px', height: '30px', padding: '0 10px' }}
            >
              {t === 'ALL' ? 'All' : t === 'DEBIT' ? 'Debits' : 'Credits'}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction Ledger Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h2 className="section-title" style={{ margin: 0 }}>
          Transaction Ledger ({filtered.length})
        </h2>
        <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
          {monthLabel(selectedMonth)}
        </span>
      </div>

      {/* Ledger Item List */}
      {loadingLedger ? (
        <div className="stack">
          <Skeleton height={68} />
          <Skeleton height={68} />
          <Skeleton height={68} />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="🧾"
          title="No transactions found"
          subtitle={searchQuery ? 'Try adjusting your search query.' : `No transactions recorded for ${monthLabel(selectedMonth)}.`}
        />
      ) : (
        <div className="ledger" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {paginatedTransactions.map((t) => {
            const isDebit = t.type === 'DEBIT';
            return (
              <div
                key={t._id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: 'var(--surface, rgba(255, 255, 255, 0.04))',
                  border: '1px solid var(--border)',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      background: isDebit ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                      color: isDebit ? '#ef4444' : '#10b981',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    {isDebit ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                      <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {t.recipient || t.description || 'Bank Transaction'}
                      </span>
                      <span
                        style={{
                          fontSize: '9px',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          fontWeight: 800,
                          letterSpacing: '0.3px',
                          textTransform: 'uppercase',
                          flexShrink: 0,
                          background: isDebit ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          color: isDebit ? '#ef4444' : '#10b981',
                          border: isDebit ? '1px solid rgba(239, 68, 68, 0.28)' : '1px solid rgba(16, 185, 129, 0.28)'
                        }}
                      >
                        {isDebit ? 'Debit' : 'Credit'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--muted)', marginTop: '2px', flexWrap: 'wrap' }}>
                      <span>{formatDate(t.date)} • {formatTime(t.date)}</span>
                      {t.reference && t.reference !== 'MANUAL' && (
                        <span>• Ref: {t.reference}</span>
                      )}
                      {t.redeemRef && (
                        <span
                          style={{
                            fontSize: '9.5px',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            fontWeight: 700,
                            background: 'rgba(168, 85, 247, 0.2)',
                            color: '#c084fc'
                          }}
                        >
                          Redeem Payout
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: '9.5px',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          fontWeight: 700,
                          background: t.source === 'MANUAL' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(16, 185, 129, 0.15)',
                          color: t.source === 'MANUAL' ? '#818cf8' : '#34d399'
                        }}
                      >
                        {t.source === 'MANUAL' ? 'Manual' : 'SMS Alert'}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: isDebit ? '#ef4444' : '#10b981' }}>
                    {isDebit ? '-' : '+'}{formatCurrency(t.amount)}
                  </div>
                  {t.balanceAfter > 0 && (
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                      Bal: {formatCurrency(t.balanceAfter)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination & Transaction Count */}
      {filtered.length > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '14px',
            padding: '10px 14px',
            borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.025)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            fontSize: '12.5px',
            flexWrap: 'wrap',
            gap: '8px'
          }}
        >
          <div style={{ color: 'var(--muted)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>
              Showing {filtered.length === 0 ? '0' : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filtered.length)}`} of {filtered.length} transactions
            </span>
            {filtered.length > pageSize && (
              <span className="badge" style={{ fontSize: '10px', padding: '1px 6px' }}>
                {pageSize} / page
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              style={{
                padding: '4px 10px',
                height: '28px',
                fontSize: '11.5px',
                opacity: page <= 1 ? 0.35 : 1,
                cursor: page <= 1 ? 'not-allowed' : 'pointer'
              }}
            >
              <ChevronLeft size={13} /> Prev
            </button>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#fff', padding: '0 6px' }}>
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              style={{
                padding: '4px 10px',
                height: '28px',
                fontSize: '11.5px',
                opacity: page >= totalPages ? 0.35 : 1,
                cursor: page >= totalPages ? 'not-allowed' : 'pointer'
              }}
            >
              Next <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Add Manual Expense Bottom Sheet */}
      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Add Manual Expense"
      >
        <ExpenseForm
          users={users}
          defaultDate={todayISTDateString()}
          submitting={submitting}
          onSubmit={handleAddManualExpense}
          onCancel={() => setSheetOpen(false)}
        />
      </BottomSheet>
    </div>
  );
}

const bankHeroCardStyle = {
  background: 'linear-gradient(135deg, #7f1d1d 0%, #450a0a 40%, #1e1b4b 100%)',
  border: '1px solid rgba(239, 68, 68, 0.3)',
  borderRadius: '16px',
  padding: '16px',
  marginBottom: '16px',
  color: '#fff'
};

const crimsonIconBadge = {
  width: '32px',
  height: '32px',
  borderRadius: '8px',
  background: 'rgba(255, 255, 255, 0.2)',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const iconBtnStyle = {
  width: '30px',
  height: '30px',
  padding: 0,
  borderRadius: '8px',
  background: 'rgba(255, 255, 255, 0.15)',
  color: '#fff',
  border: 'none',
  cursor: 'pointer'
};

const miniStatBoxStyle = {
  background: 'rgba(255, 255, 255, 0.08)',
  padding: '8px 10px',
  borderRadius: '10px'
};

const webhookGuideCardStyle = {
  marginBottom: '16px',
  border: '1px solid rgba(16, 185, 129, 0.3)',
  background: 'linear-gradient(145deg, rgba(16, 185, 129, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%)',
  borderRadius: '14px',
  padding: '14px'
};
