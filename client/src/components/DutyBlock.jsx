import { DUTY_META } from '../constants';

export default function DutyBlock({ role, members }) {
  const meta = DUTY_META[role] || DUTY_META.resting;
  const list = members && members.length ? members : [];

  return (
    <div
      className="duty-block"
      style={{
        background: meta.bg || 'var(--surface-2)',
        borderColor: meta.border || 'var(--border)',
        boxShadow: `0 4px 16px ${meta.glow || 'rgba(0,0,0,0.1)'}`,
        borderRadius: '16px',
        padding: '14px',
        borderWidth: '1px',
        borderStyle: 'solid',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease'
      }}
    >
      <div className="duty-block__head" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <span
          className="duty-block__icon"
          style={{
            fontSize: '18px',
            width: '32px',
            height: '32px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '10px',
            background: 'var(--surface-1)',
            boxShadow: `0 2px 8px ${meta.glow}`
          }}
        >
          {meta.icon}
        </span>
        <span
          className="duty-block__label"
          style={{
            fontSize: '13px',
            fontWeight: 800,
            color: meta.color,
            letterSpacing: '0.3px',
            textTransform: 'uppercase'
          }}
        >
          {meta.label}
        </span>
      </div>
      <div className="duty-block__names" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {list.length ? (
          list.map((m) => (
            <span
              key={m._id || m.name}
              className="duty-name"
              style={{
                background: 'var(--surface-1)',
                color: 'var(--text)',
                border: `1px solid ${meta.border}`,
                padding: '5px 12px',
                borderRadius: '999px',
                fontSize: '13px',
                fontWeight: 700,
                boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
              }}
            >
              {m.name || m}
            </span>
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
  );
}
