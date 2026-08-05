export default function StatCard({ label, value, sub, accent, icon }) {
  return (
    <div className={`stat-card ${accent ? `stat-card--${accent}` : ''}`}>
      {icon && <div className="stat-card__icon">{icon}</div>}
      <div className="stat-card__label">{label}</div>
      <div className="stat-card__value">{value}</div>
      {sub && <div className="stat-card__sub">{sub}</div>}
    </div>
  );
}
