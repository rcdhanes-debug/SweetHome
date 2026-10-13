import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Building2, RefreshCw, Eye, EyeOff, CheckCircle2, ArrowUpRight, ArrowDownLeft, ShieldAlert } from 'lucide-react';
import { getBankBalance, syncBankBalance } from '../services/bank';
import { formatCurrency, formatDateTime } from '../utils/format';
import { useToast } from '../context/ToastContext';
import CountUp from './CountUp';

export default function BankBalanceWidget() {
  const [bankData, setBankData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const toast = useToast();

  const toggleVisibility = () => {
    setShowBalance((prev) => !prev);
  };

  const loadBalance = async () => {
    try {
      setLoading(true);
      const data = await getBankBalance();
      setBankData(data);
    } catch (err) {
      console.error('Failed to load bank balance:', err);
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
      toast.show('✓ Live bank balance refreshed');
    } catch (err) {
      toast.show(err.message || 'Failed to refresh bank balance', 'error');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    loadBalance();
  }, []);

  const balance = bankData?.balance || 0;
  const lastSyncStatus = bankData?.lastSyncStatus;

  return (
    <section className="card card--tint floaty floaty--1 dash-contrib" style={bankCardStyle}>
      <div className="card__head" style={{ marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={crimsonIconBadge}>
            <Building2 size={16} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 800, color: '#fff', letterSpacing: '-0.2px' }}>
              {bankData?.bankName || 'IDFC FIRST Bank'}
            </h3>
            <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.65)' }}>
              A/C •••• {bankData?.accountLast4 || '****'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={toggleVisibility}
            title={showBalance ? 'Hide balance' : 'Show balance'}
            style={actionBtnStyle}
          >
            {showBalance ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={handleSync}
            disabled={syncing || loading}
            title="Refresh bank balance"
            style={actionBtnStyle}
          >
            <RefreshCw size={13} className={syncing ? 'spin' : ''} />
          </button>
        </div>
      </div>

      <div className="big-number" style={{ margin: '8px 0 6px', color: '#ffffff' }}>
        {showBalance ? (
          <CountUp value={balance} format={(val) => formatCurrency(val, { decimals: true })} duration={900} />
        ) : (
          <span style={{ letterSpacing: '3px', filter: 'blur(5px)', userSelect: 'none', opacity: 0.85 }}>
            ₹ 68,450.00
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', minHeight: '22px' }}>
        {bankData?.lastTransactionAmount > 0 ? (
          <div style={txnBadgeStyle}>
            {bankData.lastTransactionType === 'DEBIT' ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#f87171', fontWeight: 600, fontSize: '11px' }}>
                <ArrowDownLeft size={12} /> Last Debit: {formatCurrency(bankData.lastTransactionAmount, { decimals: true })}
                {bankData.lastRecipient && ` to ${bankData.lastRecipient}`}
              </span>
            ) : bankData.lastTransactionType === 'CREDIT' ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#34d399', fontWeight: 600, fontSize: '11px' }}>
                <ArrowUpRight size={12} /> Last Credit: {formatCurrency(bankData.lastTransactionAmount, { decimals: true })}
                {bankData.lastRecipient && ` from ${bankData.lastRecipient}`}
              </span>
            ) : (
              <span className="muted" style={{ fontSize: '11.5px' }}>Live Bank Balance</span>
            )}
          </div>
        ) : (
          <p className="muted" style={{ margin: 0, fontSize: '11.5px' }}>
            Live Account Balance
          </p>
        )}

        <span style={smsActivePillStyle} title="Receives SMS alerts directly from mobile forwarder app">
          ⚡ SMS Forwarder
        </span>
      </div>

      <div className="card__foot" style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.55)', display: 'flex', alignItems: 'center', gap: '4px' }}>
          {lastSyncStatus === 'SUCCESS' ? (
            <>
              <CheckCircle2 size={11} color="#34d399" />
              {bankData?.lastSyncedAt ? `SMS synced ${formatDateTime(bankData.lastSyncedAt)}` : 'SMS synced'}
            </>
          ) : (
            'Awaiting SMS forward'
          )}
        </span>
        <Link
          to="/bank"
          className="link-btn"
          style={{ textDecoration: 'none', padding: 0, fontSize: '11.5px', color: '#fca5a5', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}
        >
          View History →
        </Link>
      </div>
    </section>
  );
}

// Premium IDFC FIRST Bank Color Palette (Deep Crimson & Obsidian Glass)
const bankCardStyle = {
  background: 'linear-gradient(145deg, rgba(152, 27, 30, 0.38) 0%, rgba(20, 33, 58, 0.92) 55%, rgba(120, 15, 18, 0.28) 100%)',
  border: '1px solid rgba(239, 68, 68, 0.32)',
  boxShadow: '0 8px 32px -4px rgba(152, 27, 30, 0.22), 0 2px 8px rgba(0, 0, 0, 0.35)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  position: 'relative',
  overflow: 'hidden'
};

const crimsonIconBadge = {
  width: '32px',
  height: '32px',
  borderRadius: '10px',
  background: 'linear-gradient(135deg, #981b1e 0%, #dc2626 100%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#ffffff',
  boxShadow: '0 3px 12px rgba(152, 27, 30, 0.45)',
  flexShrink: 0
};

const actionBtnStyle = {
  padding: '4px 6px',
  height: '28px',
  minWidth: '28px',
  borderRadius: '8px',
  background: 'rgba(255, 255, 255, 0.08)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  color: '#ffffff'
};

const txnBadgeStyle = {
  padding: '2px 8px',
  background: 'rgba(0, 0, 0, 0.25)',
  borderRadius: '6px',
  border: '1px solid rgba(255, 255, 255, 0.06)'
};

const smsActivePillStyle = {
  fontSize: '10.5px',
  fontWeight: 700,
  color: '#34d399',
  background: 'rgba(16, 185, 129, 0.15)',
  border: '1px solid rgba(16, 185, 129, 0.35)',
  padding: '2px 8px',
  borderRadius: '999px',
  display: 'inline-flex',
  alignItems: 'center'
};
