export default function EmptyState({ icon = '📭', title, subtitle, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">{icon}</div>
      <h4>{title}</h4>
      {subtitle && <p>{subtitle}</p>}
      {action}
    </div>
  );
}
