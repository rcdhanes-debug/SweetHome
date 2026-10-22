import { useState } from 'react';
import { MessageSquare, Copy, Check, Building2, Calendar, Hash, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import BottomSheet from './BottomSheet';
import { formatCurrency, formatDateTime } from '../utils/format';

export default function SmsDetailModal({ transaction, open, onClose }) {
  const [copied, setCopied] = useState(false);

  if (!transaction) return null;

  const isDebit = transaction.type === 'DEBIT';
  const rawMsg = transaction.rawMessage || transaction.description || 'No raw SMS text available.';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawMsg);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Bank SMS Alert Details"
      maxWidth={520}
      footer={
        <div style={{ display: 'flex', gap: '8px', width: '100%', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={handleCopy}
            style={{
              flex: '1 1 140px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              height: '42px',
              touchAction: 'manipulation'
            }}
          >
            {copied ? <Check size={15} style={{ color: '#10b981' }} /> : <Copy size={15} />}
            <span>{copied ? 'Copied!' : 'Copy SMS'}</span>
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={onClose}
            style={{
              flex: '1 1 120px',
              height: '42px',
              touchAction: 'manipulation'
            }}
          >
            Done
          </button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '100%' }}>
        {/* Mobile-optimized Transaction Summary Card */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 14px',
            borderRadius: '12px',
            background: isDebit ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)',
            border: isDebit ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(16, 185, 129, 0.2)',
            gap: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: isDebit ? 'rgba(239, 68, 68, 0.16)' : 'rgba(16, 185, 129, 0.16)',
                color: isDebit ? '#ef4444' : '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              {isDebit ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: 'var(--text)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
                title={transaction.recipient || transaction.description}
              >
                {transaction.recipient || transaction.description || 'IDFC Bank Alert'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                {formatDateTime(transaction.date)}
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: '16.5px', fontWeight: 800, color: isDebit ? '#ef4444' : '#10b981' }}>
              {isDebit ? '-' : '+'}{formatCurrency(transaction.amount)}
            </div>
            {transaction.balanceAfter > 0 && (
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                Bal: {formatCurrency(transaction.balanceAfter)}
              </div>
            )}
          </div>
        </div>

        {/* Metadata Badges (Wraps cleanly on small phone screens) */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '11px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: '6px',
              background: 'rgba(255, 255, 255, 0.05)',
              color: 'var(--text-secondary)'
            }}
          >
            <Building2 size={12} style={{ color: '#38bdf8' }} />
            <span>{transaction.sender || transaction.bankName || 'IDFC FIRST Bank'}</span>
          </div>

          {transaction.reference && transaction.reference !== 'MANUAL' && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                borderRadius: '6px',
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'var(--text-secondary)'
              }}
            >
              <Hash size={12} style={{ color: '#c084fc' }} />
              <span>Ref: {transaction.reference}</span>
            </div>
          )}

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: '6px',
              background: 'rgba(255, 255, 255, 0.05)',
              color: 'var(--text-secondary)'
            }}
          >
            <Calendar size={12} style={{ color: '#fbbf24' }} />
            <span>A/c •••• {transaction.accountLast4 || '4202'}</span>
          </div>
        </div>

        {/* Verbatim Raw SMS Display */}
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '6px'
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.4px',
                color: '#38bdf8'
              }}
            >
              <MessageSquare size={13} />
              Exact SMS Received
            </div>
            <button
              type="button"
              onClick={handleCopy}
              style={{
                background: 'none',
                border: 'none',
                color: copied ? '#10b981' : 'var(--muted)',
                fontSize: '11px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 6px',
                touchAction: 'manipulation'
              }}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>

          <div
            style={{
              padding: '12px 14px',
              borderRadius: '10px',
              background: '#090d16',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize: '11.5px',
              lineHeight: 1.6,
              color: '#e2e8f0',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              userSelect: 'all',
              boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.4)'
            }}
          >
            {rawMsg}
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
