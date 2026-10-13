import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, 
  RefreshCw, 
  ArrowLeft, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Search, 
  CheckCircle2, 
  TrendingUp, 
  TrendingDown, 
  History,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Smartphone,
  Copy,
  Check,
  Send,
  HelpCircle,
  Zap,
  ShieldCheck
} from 'lucide-react';
import { getBankBalance, getBankTransactions, syncBankBalance, simulateSms } from '../services/bank';
import { formatCurrency, formatDateTime, formatDate, formatTime } from '../utils/format';
import { useToast } from '../context/ToastContext';
import CountUp from '../components/CountUp';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';

export default function BankTracking() {
  const [bankData, setBankData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'DEBIT' | 'CREDIT'
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  
  // SMS Webhook Simulator & Setup State
  const [showWebhookGuide, setShowWebhookGuide] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [smsTestInput, setSmsTestInput] = useState('');
  const [simulating, setSimulating] = useState(false);

  const toast = useToast();

  // Default to live Render backend link or current origin in full-stack deployment
  const backendBase = (import.meta.env.VITE_API_URL || '').startsWith('http')
    ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
    : (window.location.hostname === 'localhost' 
        ? 'https://sweet-home-backend-y21s.onrender.com' 
        : window.location.origin);
  const webhookUrl = `${backendBase}/api/bank/sms-webhook?secret=sweet_home_secure_2026`;

  useEffect(() => {
    setPage(1);
  }, [filterType, searchQuery, pageSize]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [balRes, txnRes] = await Promise.all([
        getBankBalance(),
        getBankTransactions(50)
      ]);
      setBankData(balRes);
      setTransactions(txnRes?.data || []);
    } catch (err) {
      console.error('Failed to load bank tracking data:', err);
      toast.show('Failed to fetch bank details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      const res = await syncBankBalance();
      if (res?.data) {
        setBankData(res.data);
      }
      const updatedTxns = await getBankTransactions(50);
      setTransactions(updatedTxns?.data || []);
      toast.show('✓ Live bank status refreshed');
    } catch (err) {
      toast.show(err.message || 'Sync failed', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopiedUrl(true);
      toast.show('✓ Webhook URL copied to clipboard!');
      setTimeout(() => setCopiedUrl(false), 2500);
    } catch (_) {
      toast.show('Could not copy automatically. Please select and copy.', 'info');
    }
  };

  const handleSimulateSms = async (e) => {
    e?.preventDefault();
    if (!smsTestInput.trim()) {
      toast.show('Please enter an SMS text to test', 'info');
      return;
    }

    try {
      setSimulating(true);
      const res = await simulateSms({
        message: smsTestInput.trim(),
        sender: 'VK-IDFCFB'
      });

      if (res?.success) {
        toast.show(`✓ ${res.message || 'SMS processed successfully!'}`);
        setSmsTestInput('');
        await loadData();
      } else {
        toast.show(res?.message || 'Could not parse SMS format', 'error');
      }
    } catch (err) {
      toast.show(err.message || 'Failed to simulate SMS', 'error');
    } finally {
      setSimulating(false);
    }
  };

  const setSampleSms = (type) => {
    if (type === 'DEBIT') {
      setSmsTestInput(
        'Dear Customer, INR 450.00 debited from A/C ...4321 on 13-OCT-26 at 20:30 towards Swiggy. Avl Bal: INR 48,250.00. UPI Ref: 628391829102 - IDFC FIRST Bank'
      );
    } else if (type === 'CREDIT') {
      setSmsTestInput(
        'Dear Customer, INR 18,000.00 credited to your A/C ...4321 on 13-OCT-26. Total Avl Bal INR 66,250.00. Ref: IMPS/619283910293 - IDFC FIRST Bank'
      );
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  // Filtered transactions
  const filtered = transactions.filter((t) => {
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedTransactions = filtered.slice((page - 1) * pageSize, page * pageSize);

  // Calculate totals
  const totalDebits = transactions
    .filter((t) => t.type === 'DEBIT')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const totalCredits = transactions
    .filter((t) => t.type === 'CREDIT')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const balance = bankData?.balance || 0;

  return (
    <div className="page" style={{ maxWidth: '820px', margin: '0 auto' }}>
      {/* Top Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <Link to="/dashboard" className="btn btn--ghost btn--sm" style={{ gap: '6px' }}>
          <ArrowLeft size={15} /> Dashboard
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setShowWebhookGuide((prev) => !prev)}
            style={{ gap: '5px' }}
          >
            <Smartphone size={14} color="#34d399" />
            {showWebhookGuide ? 'Hide SMS Setup' : 'SMS Setup & Test'}
          </button>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={handleSync}
            disabled={syncing || loading}
            style={{ gap: '6px' }}
          >
            <RefreshCw size={13} className={syncing ? 'spin' : ''} />
            {syncing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* SMS Webhook Setup & Live Tester Accordion */}
      {showWebhookGuide && (
        <section className="card" style={webhookGuideCardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={greenIconBadge}>
                <Zap size={16} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text)' }}>
                  SMS Forwarder Webhook Setup
                </h4>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                  Forward real-time bank SMS alerts from your mobile phone
                </p>
              </div>
            </div>
          </div>

          {/* Webhook URL copy box */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '6px' }}>
              Target Webhook URL
            </label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                readOnly
                value={webhookUrl}
                className="text-input"
                style={{ fontFamily: 'monospace', fontSize: '12px', height: '36px', background: 'rgba(0,0,0,0.25)', flex: 1 }}
              />
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={handleCopyUrl}
                style={{ gap: '6px', whiteSpace: 'nowrap', height: '36px', padding: '0 12px' }}
              >
                {copiedUrl ? <Check size={14} /> : <Copy size={14} />}
                {copiedUrl ? 'Copied' : 'Copy URL'}
              </button>
            </div>
          </div>

          {/* Security & Privacy Banner */}
          <div style={securityBannerStyle}>
            <ShieldCheck size={18} color="#34d399" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: '12.5px', color: '#34d399' }}>
                Bank Security & Privacy Active
              </div>
              <div style={{ fontSize: '11.5px', color: 'rgba(255, 255, 255, 0.75)', marginTop: '2px', lineHeight: '1.5' }}>
                • <b>Secret Token Protected:</b> Webhook requires authentication token (embedded in the URL).<br />
                • <b>Automatic OTP Gatekeeper:</b> All OTPs, login PINs, passwords, and verification codes are automatically dropped.<br />
                • <b>Private:</b> Bank updates remain strictly inside the app. No Telegram alerts are sent.
              </div>
            </div>
          </div>

          {/* Setup Instructions */}
          <div style={guideStepsBoxStyle}>
            <div style={{ fontSize: '12.5px', fontWeight: 700, marginBottom: '6px', color: 'var(--text)' }}>
              📱 Mobile App Configuration (SMS Forwarder / Tasker / MacroDroid):
            </div>
            <ol style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: 'var(--muted)', lineHeight: '1.8' }}>
              <li>Install <b>SMS Forwarder</b> (or any SMS auto-forward webhook app) on your Android device.</li>
              <li><b>Include Rule:</b> Filter where Sender contains <b>"IDFC"</b> (matches <code>IDFCFB</code>, <code>VK-IDFCFB</code>).</li>
              <li><b>Exclude Rule (Recommended):</b> Set exclude keywords: <code>OTP, verification, password, code</code>.</li>
              <li><b>Webhook Action:</b> Method <b>POST</b> with the copied URL above (contains your secret token).</li>
              <li><b>Request Body:</b> JSON with fields <code>content</code> (or <code>message</code>) and <code>from</code>.</li>
            </ol>
          </div>

          {/* Interactive SMS Simulator */}
          <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)' }}>
                🧪 Test SMS Parser Right Now:
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => setSampleSms('DEBIT')}
                  style={{ fontSize: '11px', padding: '2px 8px', height: '24px' }}
                >
                  Insert Sample Debit
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => setSampleSms('CREDIT')}
                  style={{ fontSize: '11px', padding: '2px 8px', height: '24px' }}
                >
                  Insert Sample Credit
                </button>
              </div>
            </div>

            <form onSubmit={handleSimulateSms} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <textarea
                className="text-input"
                rows={2}
                placeholder="Paste an SMS from IDFC FIRST Bank here to test parsing and update the balance..."
                value={smsTestInput}
                onChange={(e) => setSmsTestInput(e.target.value)}
                style={{ fontSize: '12px', resize: 'vertical', minHeight: '54px' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  className="btn btn--primary btn--sm"
                  disabled={simulating || !smsTestInput.trim()}
                  style={{ gap: '6px' }}
                >
                  <Send size={13} />
                  {simulating ? 'Parsing…' : 'Simulate Incoming SMS'}
                </button>
              </div>
            </form>
          </div>
        </section>
      )}

      {/* Main Luxury Bank Account Hero Card */}
      <section className="hero-card" style={heroCardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={crimsonBadgeStyle}>
              <Building2 size={22} />
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'rgba(255,255,255,0.75)' }}>
                PRIMARY HOUSE ACCOUNT
              </div>
              <h2 style={{ margin: '2px 0 0', fontSize: '20px', fontWeight: 800, color: '#ffffff' }}>
                {bankData?.bankName || 'IDFC FIRST Bank'}
              </h2>
            </div>
          </div>

          <span className="badge" style={accountBadgeStyle}>
            <CreditCard size={12} style={{ marginRight: '4px' }} />
            •••• {bankData?.accountLast4 || '****'}
          </span>
        </div>

        <div style={{ margin: '20px 0 16px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Available Live Balance
          </span>
          <div style={{ fontSize: 'clamp(28px, 7vw, 38px)', fontWeight: 900, letterSpacing: '-0.8px', color: '#ffffff', margin: '4px 0', wordBreak: 'break-word' }}>
            {loading ? (
              <Skeleton height={46} width={240} />
            ) : (
              <CountUp value={balance} format={(n) => formatCurrency(n, { decimals: true })} duration={900} />
            )}
          </div>
        </div>

        {/* Inflow vs Outflow Mini Pills */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '16px' }}>
          <div style={statBoxStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#34d399', fontSize: '11px', fontWeight: 700 }}>
              <TrendingUp size={13} /> TOTAL CREDITS
            </div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff', marginTop: '4px' }}>
              +{formatCurrency(totalCredits, { decimals: true })}
            </div>
          </div>

          <div style={statBoxStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f87171', fontSize: '11px', fontWeight: 700 }}>
              <TrendingDown size={13} /> TOTAL DEBITS
            </div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff', marginTop: '4px' }}>
              -{formatCurrency(totalDebits, { decimals: true })}
            </div>
          </div>
        </div>

        {/* Sync Info Footer inside Hero */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.12)' }}>
          <span style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.65)', display: 'flex', alignItems: 'center', gap: '5px' }}>
            {bankData?.lastSyncStatus === 'SUCCESS' ? (
              <>
                <CheckCircle2 size={13} color="#34d399" />
                Last updated: {formatDateTime(bankData.lastSyncedAt)}
              </>
            ) : (
              'Ready for SMS forwarder alerts'
            )}
          </span>

          <span style={{ fontSize: '11.5px', color: '#34d399', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
            <Zap size={12} /> Live SMS Webhook Active
          </span>
        </div>
      </section>

      {/* Transaction History Section */}
      <section className="card" style={{ marginTop: '18px' }}>
        <div className="card__head" style={{ flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={18} color="#ef4444" />
            <h3 style={{ margin: 0 }}>Recent Transaction History</h3>
            <span className="badge">{filtered.length}</span>
            {filtered.length > 5 && (
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                style={pageSizeSelectStyle}
                title="Transactions per page"
              >
                <option value={5}>5 / page</option>
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
              </select>
            )}
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-subtle, rgba(255,255,255,0.05))', padding: '3px', borderRadius: '8px' }}>
            <button
              type="button"
              className={`btn btn--sm ${filterType === 'ALL' ? 'btn--primary' : 'btn--ghost'}`}
              onClick={() => setFilterType('ALL')}
              style={{ fontSize: '11px', padding: '3px 9px', height: '26px' }}
            >
              All
            </button>
            <button
              type="button"
              className={`btn btn--sm ${filterType === 'DEBIT' ? 'btn--primary' : 'btn--ghost'}`}
              onClick={() => setFilterType('DEBIT')}
              style={{ fontSize: '11px', padding: '3px 9px', height: '26px' }}
            >
              Debits
            </button>
            <button
              type="button"
              className={`btn btn--sm ${filterType === 'CREDIT' ? 'btn--primary' : 'btn--ghost'}`}
              onClick={() => setFilterType('CREDIT')}
              style={{ fontSize: '11px', padding: '3px 9px', height: '26px' }}
            >
              Credits
            </button>
          </div>
        </div>

        {/* Search input */}
        <div style={{ position: 'relative', margin: '10px 0 16px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
          <input
            type="text"
            className="text-input"
            placeholder="Search by description or UTR reference…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '34px', fontSize: '12.5px', height: '36px' }}
          />
        </div>

        {/* Transaction Rows */}
        {loading ? (
          <div className="stack">
            <Skeleton height={56} />
            <Skeleton height={56} />
            <Skeleton height={56} />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="🧾"
            title="No transactions found"
            subtitle={searchQuery ? 'Try adjusting your search query.' : 'Transactions will appear here as bank alerts arrive.'}
          />
        ) : (
          <div className="mini-ledger" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {paginatedTransactions.map((txn) => {
              const isDebit = txn.type === 'DEBIT';
              return (
                <div key={txn._id} style={txnRowStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <div style={isDebit ? debitIconWrap : creditIconWrap}>
                      {isDebit ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {txn.description}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                        <span>{formatDate(txn.date)} • {formatTime(txn.date)}</span>
                        {txn.recipient && txn.recipient !== 'Merchant / Payee' && txn.recipient !== 'Sender / Transfer' && (
                          <span style={payeeTagStyle}>
                            {txn.type === 'DEBIT' ? `To: ${txn.recipient}` : `From: ${txn.recipient}`}
                          </span>
                        )}
                        {txn.reference && (
                          <span style={refBadgeStyle}>
                            {txn.reference}
                          </span>
                        )}
                        {txn.source === 'SMS' && (
                          <span style={smsTagStyle}>SMS</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: isDebit ? '#ef4444' : '#10b981' }}>
                      {isDebit ? '-' : '+'}{formatCurrency(txn.amount, { decimals: true })}
                    </div>
                    {txn.balanceAfter > 0 && (
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                        Bal: {formatCurrency(txn.balanceAfter, { decimals: true })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="pagination" style={paginationWrapStyle}>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              style={{ gap: '4px' }}
            >
              <ChevronLeft size={15} /> Prev
            </button>

            <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>
              Page {page} of {totalPages} ({filtered.length} total)
            </span>

            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              style={{ gap: '4px' }}
            >
              Next <ChevronRight size={15} />
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

// Styling Tokens
const heroCardStyle = {
  background: 'linear-gradient(145deg, #7f1d1d 0%, #1e1b4b 60%, #111827 100%)',
  border: '1px solid rgba(239, 68, 68, 0.35)',
  boxShadow: '0 10px 30px -5px rgba(152, 27, 30, 0.35), 0 4px 12px rgba(0, 0, 0, 0.4)',
  padding: 'clamp(16px, 4vw, 24px)',
  borderRadius: '20px'
};

const crimsonBadgeStyle = {
  width: '42px',
  height: '42px',
  borderRadius: '12px',
  background: 'linear-gradient(135deg, #981b1e 0%, #ef4444 100%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#ffffff',
  boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)'
};

const accountBadgeStyle = {
  background: 'rgba(255, 255, 255, 0.12)',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  color: '#ffffff',
  fontSize: '11.5px',
  padding: '4px 10px',
  borderRadius: '999px',
  display: 'inline-flex',
  alignItems: 'center'
};

const statBoxStyle = {
  background: 'rgba(0, 0, 0, 0.28)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: '12px',
  padding: '10px 14px'
};

const txnRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '12px',
  padding: '12px 14px',
  background: 'var(--surface-2, rgba(255,255,255,0.03))',
  border: '1px solid var(--border)',
  borderRadius: '14px',
  transition: 'transform 0.15s ease, border-color 0.15s ease'
};

const debitIconWrap = {
  width: '34px',
  height: '34px',
  borderRadius: '10px',
  background: 'rgba(239, 68, 68, 0.15)',
  color: '#ef4444',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0
};

const creditIconWrap = {
  width: '34px',
  height: '34px',
  borderRadius: '10px',
  background: 'rgba(16, 185, 129, 0.15)',
  color: '#10b981',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0
};

const refBadgeStyle = {
  background: 'rgba(255, 255, 255, 0.06)',
  padding: '1px 6px',
  borderRadius: '4px',
  fontSize: '10px',
  fontFamily: 'monospace'
};

const smsTagStyle = {
  background: 'rgba(16, 185, 129, 0.15)',
  color: '#34d399',
  padding: '1px 5px',
  borderRadius: '4px',
  fontSize: '9.5px',
  fontWeight: 700
};

const payeeTagStyle = {
  background: 'rgba(59, 130, 246, 0.15)',
  color: '#60a5fa',
  padding: '1px 6px',
  borderRadius: '4px',
  fontSize: '10px',
  fontWeight: 700
};

const paginationWrapStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: '16px',
  paddingTop: '12px',
  borderTop: '1px solid var(--border)',
  gap: '8px',
  flexWrap: 'wrap'
};

const pageSizeSelectStyle = {
  background: 'var(--surface-2, rgba(255,255,255,0.06))',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  borderRadius: '6px',
  padding: '2px 6px',
  fontSize: '11px',
  cursor: 'pointer'
};

const webhookGuideCardStyle = {
  marginBottom: '16px',
  border: '1px solid rgba(16, 185, 129, 0.35)',
  background: 'linear-gradient(145deg, rgba(16, 185, 129, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%)',
  borderRadius: '16px',
  padding: '18px'
};

const greenIconBadge = {
  width: '32px',
  height: '32px',
  borderRadius: '8px',
  background: 'rgba(16, 185, 129, 0.2)',
  color: '#34d399',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const guideStepsBoxStyle = {
  background: 'rgba(0, 0, 0, 0.25)',
  padding: '12px 14px',
  borderRadius: '10px',
  border: '1px solid rgba(255, 255, 255, 0.06)'
};

const securityBannerStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '10px',
  padding: '10px 12px',
  borderRadius: '10px',
  background: 'rgba(16, 185, 129, 0.12)',
  border: '1px solid rgba(16, 185, 129, 0.3)',
  marginBottom: '12px'
};
