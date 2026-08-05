const USER_ORDER = ['Veera', 'Harish', 'Gowtham', 'Ashwin', 'Jegan', 'Dhanesh', 'Bhuvanesh', 'Akash', 'Bala'];
const ADMINS = ['Gowtham', 'Harish'];

const CONTRIBUTION_AMOUNT = 6000;
const TARGET_AMOUNT = 54000;
const PAYMENT_DEADLINE_DAY = 5;

const CATEGORIES = ['Groceries', 'Electricity', 'Cleaning', 'Internet', 'Misc'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Default weekly schedule keyed by day with member NAMES (mapped to ObjectIds at seed time).
const DEFAULT_SCHEDULE = {
  Monday: {
    cooking: ['Veera', 'Harish'],
    cleaning: ['Gowtham', 'Ashwin'],
    homeClean: 'Jegan'
  },
  Tuesday: {
    cooking: ['Dhanesh', 'Bhuvanesh'],
    cleaning: ['Akash', 'Bala'],
    homeClean: 'Veera'
  },
  Wednesday: {
    cooking: ['Harish', 'Gowtham'],
    cleaning: ['Ashwin', 'Jegan'],
    homeClean: 'Dhanesh'
  },
  Thursday: {
    cooking: ['Bhuvanesh', 'Akash'],
    cleaning: ['Bala', 'Veera'],
    homeClean: 'Harish'
  },
  Friday: {
    cooking: ['Gowtham', 'Ashwin'],
    cleaning: ['Jegan', 'Dhanesh'],
    homeClean: 'Bhuvanesh'
  },
  Saturday: {
    cooking: ['Akash', 'Bala'],
    cleaning: ['Veera', 'Harish'],
    homeClean: 'Gowtham'
  },
  Sunday: {
    cooking: ['Ashwin', 'Jegan'],
    cleaning: ['Dhanesh', 'Bhuvanesh'],
    homeClean: 'Akash'
  }
};

const DEFAULT_UPI_IDS = {
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

function sortUsers(users) {
  const rank = Object.fromEntries(USER_ORDER.map((n, i) => [n, i]));
  return [...users].sort((a, b) => (rank[a.name] ?? 99) - (rank[b.name] ?? 99));
}

module.exports = {
  USER_ORDER,
  ADMINS,
  DEFAULT_UPI_IDS,
  CONTRIBUTION_AMOUNT,
  TARGET_AMOUNT,
  PAYMENT_DEADLINE_DAY,
  CATEGORIES,
  DAYS,
  DEFAULT_SCHEDULE,
  sortUsers
};
