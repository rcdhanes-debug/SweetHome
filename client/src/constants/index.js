export const HOUSEMATES = ['Veera', 'Harish', 'Gowtham', 'Ashwin', 'Jegan', 'Dhanesh', 'Bhuvanesh', 'Akash', 'Bala'];

export const DEFAULT_UPI_IDS = {
  Veera: 'veera@okaxis',
  Harish: 'harish@okaxis',
  Gowtham: 'gowtham@okaxis',
  Ashwin: 'ashwin@okaxis',
  Jegan: 'jegan@okaxis',
  Dhanesh: 'dhanesh@okaxis',
  Bhuvanesh: 'bhuvanesh@okaxis',
  Akash: 'akash@okaxis',
  Bala: 'bala@okaxis'
};

export const ADMINS = ['Gowtham', 'Harish'];

export const CONTRIBUTION_AMOUNT = 6000;
export const TARGET_AMOUNT = 54000;
export const DEADLINE_DAY = 5;

export const CATEGORIES = ['Groceries', 'Electricity', 'Cleaning', 'Internet', 'Misc'];

export const CATEGORY_META = {
  Groceries: { icon: 'ShoppingBasket', color: '#16a34a', bg: 'rgba(22,163,74,0.12)' },
  Electricity: { icon: 'Zap', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  Cleaning: { icon: 'SprayCan', color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)' },
  Internet: { icon: 'Wifi', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  Misc: { icon: 'Receipt', color: '#64748b', bg: 'rgba(100,116,139,0.12)' }
};

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const DUTY_META = {
  cooking: {
    label: 'Cooking',
    icon: '🍳',
    color: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.12)',
    border: 'rgba(245, 158, 11, 0.35)',
    glow: 'rgba(245, 158, 11, 0.25)'
  },
  cleaning: {
    label: 'Cleaning',
    icon: '🧹',
    color: '#0ea5e9',
    bg: 'rgba(14, 165, 233, 0.12)',
    border: 'rgba(14, 165, 233, 0.35)',
    glow: 'rgba(14, 165, 233, 0.25)'
  },
  homeClean: {
    label: 'Home Clean',
    icon: '🏠',
    color: '#a855f7',
    bg: 'rgba(168, 85, 247, 0.12)',
    border: 'rgba(168, 85, 247, 0.35)',
    glow: 'rgba(168, 85, 247, 0.25)'
  },
  resting: {
    label: 'Resting',
    icon: '😴',
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.12)',
    border: 'rgba(16, 185, 129, 0.35)',
    glow: 'rgba(16, 185, 129, 0.25)'
  }
};

export const EVENT_TYPES = ['birthday', 'festival', 'outing', 'house', 'other'];

export const EVENT_META = {
  birthday: { label: 'Birthday', icon: '🎂', color: '#ec4899' },
  festival: { label: 'Festival', icon: '🎉', color: '#f59e0b' },
  outing: { label: 'Outing', icon: '🎒', color: '#0ea5e9' },
  house: { label: 'House', icon: '🏠', color: '#8b5cf6' },
  other: { label: 'Other', icon: '📌', color: '#64748b' }
};

export const AUDIT_LABELS = {
  CONTRIBUTION_PAID: 'Contribution marked paid',
  CONTRIBUTION_RESET: 'Contribution reset',
  FUNDING_AMOUNT_SET: 'Monthly contribution changed',
  EXPENSE_CREATED: 'Expense created',
  EXPENSE_EDITED: 'Expense edited',
  EXPENSE_DELETED: 'Expense deleted',
  CHORE_UPDATED: 'Schedule updated',
  CHORE_SWAP: 'Duties swapped',
  CHORE_DEFAULT_RESTORED: 'Default schedule restored',
  PIN_CHANGED: 'PIN changed',
  USER_UPDATED: 'User updated',
  USER_AWAY_SET: 'Leave of absence changed',
  SHOPPING_ADDED: 'Shopping item added',
  SHOPPING_EDITED: 'Shopping item edited',
  SHOPPING_TOGGLED: 'Shopping item checked',
  SHOPPING_DELETED: 'Shopping item removed',
  FIX_OPENED: 'Fix-It issue opened',
  FIX_RESOLVED: 'Fix-It issue resolved',
  FIX_REOPENED: 'Fix-It issue reopened',
  FIX_DELETED: 'Fix-It issue removed',
  GUEST_ADDED: 'Guest visit added',
  GUEST_REMOVED: 'Guest visit removed',
  RESOLUTION_CREATED: 'Resolution created',
  RESOLUTION_VOTED: 'Vote cast',
  RESOLUTION_CLOSED: 'Resolution closed',
  RESOLUTION_REOPENED: 'Resolution reopened',
  RESOLUTION_DELETED: 'Resolution removed',
  PHOTO_ADDED: 'Photo added',
  PHOTO_DELETED: 'Photo removed',
  USER_PROFILE_UPDATED: 'Profile updated',
  EVENT_CREATED: 'Event added',
  EVENT_EDITED: 'Event edited',
  EVENT_DELETED: 'Event removed'
};

export const SESSION_KEY = 'homehq_session';
