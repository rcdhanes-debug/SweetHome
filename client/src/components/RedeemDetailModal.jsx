import { useState } from 'react';
import {
  ShoppingBag,
  Copy,
  Check,
  Building2,
  Calendar,
  Hash,
  ArrowUpRight,
  User,
  CheckCircle2,
  Smartphone
} from 'lucide-react';
import BottomSheet from './BottomSheet';
import { formatCurrency, formatDateTime } from '../utils/format';

const parseProducts = (note) => {
  if (!note || typeof note !== 'string') return [];
  return note
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
};

export default function RedeemDetailModal({ transaction, open, onClose }) {
  const [copied, setCopied] = useState(false);

  if (!transaction) return null;

  const items = Array.isArray(transaction.redeemItems) && transaction.redeemItems.length > 0
    ? transaction.redeemItems
    : transaction.redeemRef && typeof transaction.redeemRef === 'object'
    ? [transaction.redeemRef]
    : [];

  const primaryItem = items[0] || (typeof transaction.redeemRef === 'object' ? transaction.redeemRef : null);
  const housemateName = primaryItem?.createdBy?.name || transaction.recipient || 'Housemate';
  const upiId = primaryItem?.upiId || '';

  const handleCopySummary = async () => {
    try {
      const allNotes = items.map((it) => it.note).filter(Boolean).join(', ');
      const text = `Redeem Payout: ${housemateName} • ${formatCurrency(transaction.amount)}\nUPI: ${upiId || '—'}\nItems: ${allNotes || 'None'}\nRef: ${transaction.reference || '—'}`;
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Settled Redeem Details"
      maxWidth={520}
      footer={
        <div style={{ display: 'flex', gap: '8px', width: '100%', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={handleCopySummary}
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
            <span>{copied ? 'Copied Summary!' : 'Copy Summary'}</span>
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
        {/* Transaction Hero Card */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 14px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.12) 0%, rgba(15, 23, 42, 0.7) 100%)',
            border: '1px solid rgba(168, 85, 247, 0.3)',
            gap: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'rgba(168, 85, 247, 0.2)',
                color: '#c084fc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <ShoppingBag size={20} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: '14.5px',
                  fontWeight: 700,
                  color: 'var(--text)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {housemateName}
              </div>
              <div style={{ fontSize: '11px', color: '#c084fc', fontWeight: 600, marginTop: '2px' }}>
                Redeem Settlement Payout
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: '17px', fontWeight: 800, color: '#ef4444' }}>
              -{formatCurrency(transaction.amount)}
            </div>
            <div style={{ fontSize: '10.5px', color: 'var(--muted)', marginTop: '2px' }}>
              {formatDateTime(transaction.date)}
            </div>
          </div>
        </div>

        {/* Member & Settlement Meta Badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '11px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 8px',
              borderRadius: '6px',
              background: 'rgba(255, 255, 255, 0.05)',
              color: 'var(--text-secondary)'
            }}
          >
            <User size={12} style={{ color: '#38bdf8' }} />
            <span>Reimbursed: <strong>{housemateName}</strong></span>
          </div>

          {upiId && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 8px',
                borderRadius: '6px',
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'var(--text-secondary)'
              }}
            >
              <Smartphone size={12} style={{ color: '#fbbf24' }} />
              <span>UPI: <code>{upiId}</code></span>
            </div>
          )}

          {transaction.reference && transaction.reference !== 'MANUAL' && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
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
              gap: '5px',
              padding: '4px 8px',
              borderRadius: '6px',
              background: 'rgba(16, 185, 129, 0.1)',
              color: '#34d399',
              border: '1px solid rgba(16, 185, 129, 0.25)'
            }}
          >
            <CheckCircle2 size={12} />
            <span>Settled via {primaryItem?.closedByName || 'Bank SMS (Auto)'}</span>
          </div>
        </div>

        {/* Settled Products Section */}
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '8px'
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
                color: '#c084fc'
              }}
            >
              <ShoppingBag size={13} />
              Settled Products / Items
            </div>
            <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>
              {items.length} {items.length === 1 ? 'request' : 'combined requests'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {items.length === 0 ? (
              <div
                style={{
                  padding: '14px',
                  borderRadius: '10px',
                  background: 'rgba(0,0,0,0.25)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  color: 'var(--muted)',
                  fontSize: '12px',
                  textAlign: 'center'
                }}
              >
                Redeem payout (no specific item notes recorded).
              </div>
            ) : (
              items.map((item, idx) => {
                const prods = parseProducts(item.note);
                return (
                  <div
                    key={item._id || idx}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: 'rgba(15, 23, 42, 0.65)',
                      border: '1px solid rgba(168, 85, 247, 0.22)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text)' }}>
                        {items.length > 1 && <span style={{ color: 'var(--muted)', marginRight: '6px' }}>#{idx + 1}</span>}
                        {item.createdBy?.name || housemateName}
                      </span>
                      <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#fbbf24' }}>
                        {formatCurrency(item.amount)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {prods.length > 0 ? (
                        prods.map((p, pIdx) => (
                          <span
                            key={pIdx}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              padding: '3px 9px',
                              borderRadius: '7px',
                              background: 'rgba(168, 85, 247, 0.15)',
                              color: '#d8b4fe',
                              border: '1px solid rgba(168, 85, 247, 0.3)',
                              lineHeight: 1.3
                            }}
                          >
                            {p}
                          </span>
                        ))
                      ) : (
                        <span style={{ color: 'var(--muted)', fontSize: '11.5px', fontStyle: 'italic' }}>
                          {item.note || 'No product note specified'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
