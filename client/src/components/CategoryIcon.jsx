import { ShoppingBasket, Zap, SprayCan, Wifi, Receipt } from 'lucide-react';
import { CATEGORY_META } from '../constants';

const ICON_MAP = { ShoppingBasket, Zap, SprayCan, Wifi, Receipt };

export default function CategoryIcon({ category, size = 20 }) {
  const meta = CATEGORY_META[category] || CATEGORY_META.Misc;
  const Icon = ICON_MAP[meta.icon] || Receipt;
  return (
    <span className="cat-icon" style={{ background: meta.bg, color: meta.color }}>
      <Icon size={size} />
    </span>
  );
}
