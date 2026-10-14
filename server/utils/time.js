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

function deadlineInfo(deadlineDay = 5, now = new Date(), allPaid = false) {
  if (allPaid) {
    return { passed: false, allPaid: true, daysLeft: null, text: '🎉 All housemates paid!' };
  }
  const p = istParts(now);
  const today = Number(p.day);
  if (today > deadlineDay) {
    return { passed: true, allPaid: false, daysLeft: null, text: 'Payment deadline passed' };
  }
  const daysLeft = deadlineDay - today;
  let text;
  if (daysLeft === 0) text = 'Due today';
  else if (daysLeft === 1) text = 'Due tomorrow';
  else text = `${daysLeft} days remaining`;
  return { passed: false, allPaid: false, daysLeft, text };
}

/**
 * Safely parses any arbitrary timestamp format (milliseconds, seconds, numeric string,
 * ISO date string, standard date strings, Date objects) into a guaranteed valid Date.
 * Falls back to now if parsing fails, never returns an Invalid Date.
 */
function safeParseDate(input) {
  if (!input) return new Date();

  if (input instanceof Date) {
    return isNaN(input.getTime()) ? new Date() : input;
  }

  if (typeof input === 'number') {
    if (isNaN(input) || !isFinite(input)) return new Date();
    const ms = input < 1e11 ? input * 1000 : input;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? new Date() : d;
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return new Date();

    if (/^\d{9,15}$/.test(trimmed)) {
      const num = parseInt(trimmed, 10);
      const ms = num < 1e11 ? num * 1000 : num;
      const d = new Date(ms);
      if (!isNaN(d.getTime())) return d;
    }

    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d;

    const slash = trimmed.replace(/\//g, '-');
    const d2 = new Date(slash);
    if (!isNaN(d2.getTime())) return d2;

    const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (dmyMatch) {
      const [, day, month, year, h = '0', m = '0', s = '0'] = dmyMatch;
      const parsed = new Date(Number(year), Number(month) - 1, Number(day), Number(h), Number(m), Number(s));
      if (!isNaN(parsed.getTime())) return parsed;
    }
  }

  return new Date();
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
  deadlineInfo,
  safeParseDate
};

