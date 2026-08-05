const { TIMEZONE } = require('../config');

const HOUSEHOLD_TZ = TIMEZONE;
const HOUR_MS = 3600000;
const IST_OFFSET_MS = 5.5 * HOUR_MS;

function istParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: HOUSEHOLD_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  });
  const parts = {};
  for (const p of fmt.formatToParts(date)) parts[p.type] = p.value;
  return parts;
}

function monthKey(date = new Date()) {
  const p = istParts(date);
  return `${p.year}-${p.month}`;
}

function nextMonthKey(month) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

// Calendar-month boundaries expressed in UTC (IST = UTC+5:30).
function istMonthRange(month) {
  const [y, m] = month.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1) - IST_OFFSET_MS);
  const end = new Date(Date.UTC(y, m, 1) - IST_OFFSET_MS);
  return { start, end };
}

function currentWeekday() {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: HOUSEHOLD_TZ }).format(new Date());
}

function deadlineInfo(deadlineDay = 5, now = new Date()) {
  const p = istParts(now);
  const today = Number(p.day);
  if (today > deadlineDay) {
    return { passed: true, daysLeft: null, text: 'Payment deadline passed' };
  }
  const daysLeft = deadlineDay - today;
  let text;
  if (daysLeft === 0) text = 'Due today';
  else if (daysLeft === 1) text = 'Due tomorrow';
  else text = `${daysLeft} days remaining`;
  return { passed: false, daysLeft, text };
}

module.exports = {
  HOUSEHOLD_TZ,
  IST_OFFSET_MS,
  istParts,
  monthKey,
  nextMonthKey,
  monthLabel,
  istMonthRange,
  currentWeekday,
  deadlineInfo
};
