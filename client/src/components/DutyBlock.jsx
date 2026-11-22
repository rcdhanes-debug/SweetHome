import { DUTY_META } from '../constants';
import { UtensilsCrossed } from 'lucide-react';

export default function DutyBlock({ role, members, food }) {
  const meta = DUTY_META[role] || DUTY_META.resting;
  const list = members && members.length ? members : [];

  return (
    <div
      className="duty-block"
      style={{
        background: meta.bg || 'var(--surface-2)',
        borderColor: meta.border || 'var(--border)',
        boxShadow: `0 4px 18px ${meta.glow || 'rgba(0,0,0,0.1)'}`,
        borderRadius: '16px',
        padding: '14px',
        borderWidth: '1px',
        borderStyle: 'solid',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%',
        minHeight: '136px',
        boxSizing: 'border-box'
      }}
    >
      <div>
        <div className="duty-block__head" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <span
            className="duty-block__icon"
            style={{
              fontSize: '16px',
              width: '30px',
              height: '30px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '9px',
              background: 'var(--surface-1)',
              boxShadow: `0 2px 6px ${meta.glow}`
            }}
          >
            {meta.icon}
          </span>
          <span
            className="duty-block__label"
            style={{
              fontSize: '12px',
              fontWeight: 800,
              color: meta.color,
              letterSpacing: '0.4px',
              textTransform: 'uppercase',
              lineHeight: 1.2
            }}
          >
            {meta.label}
          </span>
        </div>

        <div className="duty-block__names" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(105px, 1fr))', gap: '8px' }}>
          {list.length ? (
            list.map((m) => (
              <div
                key={m._id || m.name}
                style={{
                  background: 'var(--surface-1)',
                  color: 'var(--text)',
                  border: `1px solid ${meta.border}`,
                  padding: '7px 12px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.04)'
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: meta.color,
                    marginRight: '8px',
                    opacity: 0.9,
                    flexShrink: 0
                  }}
                />
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {m.name || m}
                </span>
              </div>
            ))
          ) : (
            <span
              className="duty-name duty-name--muted"
              style={{ color: 'var(--muted)', fontSize: '13px', fontStyle: 'italic', padding: '4px 0' }}
            >
              —
            </span>
          )}
        </div>
      </div>

      <div style={{ marginTop: '10px' }}>
        {food ? (
          <div
            style={{
              padding: '6px 10px',
              background: 'rgba(255, 255, 255, 0.04)',
              borderRadius: '9px',
              border: `1px solid ${meta.border}`,
              fontSize: '11.5px',
              fontWeight: 700,
              color: meta.color,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <UtensilsCrossed size={13} style={{ flexShrink: 0, opacity: 0.9 }} />
            <span style={{ color: 'var(--text)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {food}
            </span>
          </div>
        ) : (
          <div style={{ height: '0px' }} />
        )}
      </div>
    </div>
  );
}
