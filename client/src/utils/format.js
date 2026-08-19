export const TZ = 'Asia/Kolkata';

const partsOf = (date = new Date()) => {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  });
  return Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
};

export function monthKey(date = new Date()) {
  const p = partsOf(date);
  return `${p.year}-${p.month}`;
}

export function monthLabel(key) {
  if (!key) return '';
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function formatCurrency(n, opts = {}) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: opts.decimals ? 2 : 0
  }).format(Number(n) || 0);
}

export function formatDate(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ }).format(new Date(iso));
}

export function formatTime(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: TZ }).format(new Date(iso));
}

export function formatDateTime(iso) {
  if (!iso) return '—';
  return `${formatDate(iso)} • ${formatTime(iso)}`;
}

export function todayDayName() {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: TZ }).format(new Date());
}

export function todayISTDateString() {
  const p = partsOf(new Date());
  return `${p.year}-${p.month}-${p.day}`;
}

export function deadlineInfo(day = 5, now = new Date(), allPaid = false) {
  if (allPaid) {
    return { passed: false, allPaid: true, daysLeft: null, text: '🎉 All housemates paid!' };
  }
  const p = partsOf(now);
  const today = Number(p.day);
  if (today > day) return { passed: true, allPaid: false, daysLeft: null, text: 'Payment deadline passed' };
  const daysLeft = day - today;
  let text;
  if (daysLeft === 0) text = 'Due today';
  else if (daysLeft === 1) text = 'Due tomorrow';
  else text = `${daysLeft} days remaining`;
  return { passed: false, allPaid: false, daysLeft, text };
}

export function greeting() {
  const h = Number(partsOf(new Date()).hour);
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function initials(name = '') {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
