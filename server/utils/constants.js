const USER_ORDER = ['Veera', 'Harish', 'Gowtham', 'Ashwin', 'Jegan', 'Dhanesh', 'Bhuvi🦁', 'Akash', 'Bala', 'Robert'];
const ADMINS = ['Gowtham', 'Harish'];

const CONTRIBUTION_AMOUNT = 6000;
const TARGET_AMOUNT = CONTRIBUTION_AMOUNT * USER_ORDER.length;
const PAYMENT_DEADLINE_DAY = 5;

const CATEGORIES = ['Groceries', 'Electricity', 'Cleaning', 'Internet', 'Misc'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Default weekly schedule keyed by day with member NAMES (mapped to ObjectIds at seed time).
// Weekdays: morningCooking (2) + nightCooking (2) + cleaning (2).
// Weekends: morningCooking (2) only (one cooking team) + cleaning (2). nightCooking is empty.
const DEFAULT_SCHEDULE = {
  Monday: {
    morningCooking: ['Gowtham', 'Veera'],
    nightCooking:   ['Harish', 'Jegan'],
    cleaning:       ['Harish', 'Jegan'],
    nightFood:      'Dosa'
  },
  Tuesday: {
    morningCooking: ['Ashwin', 'Bala'],
    nightCooking:   ['Dhanesh', 'Bhuvi🦁'],
    cleaning:       ['Ashwin', 'Akash'],
    nightFood:      'Godhumai Dosa'
  },
  Wednesday: {
    morningCooking: ['Veera', 'Robert'],
    nightCooking:   ['Jegan', 'Harish'],
    cleaning:       ['Veera', 'Bala'],
    nightFood:      'Pongal, Sambar'
  },
  Thursday: {
    morningCooking: ['Bala', 'Gowtham'],
    nightCooking:   ['Bhuvi🦁', 'Dhanesh'],
    cleaning:       ['Bhuvi🦁', 'Dhanesh'],
    nightFood:      ''
  },
  Friday: {
    morningCooking: ['Ashwin', 'Robert'],
    nightCooking:   ['Harish', 'Jegan'],
    cleaning:       ['Robert', 'Akash'],
    nightFood:      'Chappathi'
  },
  Saturday: {
    morningCooking: ['Gowtham', 'Robert'],
    nightCooking:   [],
    cleaning:       ['Akash', 'Veera'],
    nightFood:      ''
  },
  Sunday: {
    morningCooking: ['Robert', 'Jegan'],
    nightCooking:   [],
    cleaning:       ['Bhuvi🦁', 'Dhanesh'],
    nightFood:      ''
  }
};

const DEFAULT_UPI_IDS = {
  Veera: 'veera@okaxis',
  Harish: 'harish@okaxis',
  Gowtham: 'gowtham@okaxis',
  Ashwin: 'ashwin@okaxis',
  Jegan: 'jegan@okaxis',
  Dhanesh: 'dhanesh@okaxis',
  'Bhuvi🦁': 'p.s.bhuvi12@oksbi',
  Bhuvanesh: 'p.s.bhuvi12@oksbi',
  Akash: 'akash@okaxis',
  Bala: 'bala@okaxis',
  Robert: 'robert@okaxis'
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
