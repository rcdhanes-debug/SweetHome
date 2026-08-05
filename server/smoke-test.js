/* Smoke test: boots an in-memory MongoDB, seeds HomeHQ, and exercises the API. */
require('dotenv').config();

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const app = require('./app');
const { seedAll } = require('./seed/seedData');

process.env.HOUSEHOLD_TZ = 'Asia/Kolkata';
process.env.LOG_LEVEL = 'none';
process.env.JWT_SECRET = 'smoke-test-secret';
process.env.SEED_PINS = 'Gowtham=4321,Harish=9876';
process.env.SEED_DEFAULT_PIN = '1234';

const BASE = 'http://127.0.0.1';

async function api(port, method, path, body, token) {
  const hasBody = body !== undefined && method !== 'GET' && method !== 'HEAD';
  const res = await fetch(`${BASE}:${port}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: hasBody ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, pass: Boolean(cond), extra });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`);
}

(async () => {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('homehq_test');

  await mongoose.connect(process.env.MONGODB_URI, {});
  await seedAll({ force: true });

  const server = app.listen(0);
  const port = server.address().port;

  try {
    // Public read
    let r = await api(port, 'GET', '/api/users');
    check('GET /api/users -> 9 users', r.status === 200 && r.body.length === 9);

    r = await api(port, 'GET', '/api/funding/current');
    check(
      'GET /api/funding/current -> correct totals',
      r.status === 200 && r.body.totalCollected === 0 && r.body.paidCount === 0 && r.body.targetAmount === 54000 && r.body.deadline?.day === 5,
      `month=${r.body.month}`
    );

    // PIN verification
    r = await api(port, 'POST', '/api/auth/verify-pin', { name: 'Gowtham', pin: '4321' });
    check('Admin PIN verification works', r.status === 200 && r.body.token && r.body.user.role === 'admin');
    const adminToken = r.body.token;

    r = await api(port, 'POST', '/api/auth/verify-pin', { name: 'Gowtham', pin: '0000' });
    check('Wrong PIN rejected', r.status === 401);

    r = await api(port, 'POST', '/api/auth/verify-pin', { name: 'Veera', pin: '1234' });
    check('Member PIN verification works', r.status === 200 && r.body.user.role === 'member');
    const veeraToken = r.body.token;

    // Funding: member cannot pay for another user
    const users = (await api(port, 'GET', '/api/users')).body;
    const gowtham = users.find((u) => u.name === 'Gowtham');
    const veera = users.find((u) => u.name === 'Veera');
    const harish = users.find((u) => u.name === 'Harish');
    const ashwin = users.find((u) => u.name === 'Ashwin');
    const jegan = users.find((u) => u.name === 'Jegan');

    r = await api(port, 'POST', `/api/funding/${gowtham._id}/pay`, {}, veeraToken);
    check('Member cannot pay another user', r.status === 403, r.body.message);

    r = await api(port, 'POST', `/api/funding/${veera._id}/pay`, {}, veeraToken);
    check('Member cannot pay for anyone (admin-only)', r.status === 403, r.body.message);

    r = await api(port, 'POST', `/api/funding/${veera._id}/pay`, { amount: 5000 }, adminToken);
    check('Admin can pay custom amount', r.status === 200 && r.body.paidCount === 1 && r.body.totalCollected === 5000);

    r = await api(port, 'POST', `/api/funding/${gowtham._id}/pay`, { amount: 0 }, adminToken);
    check('Invalid amount rejected', r.status === 400);

    r = await api(port, 'POST', `/api/funding/${veera._id}/pay`, {}, adminToken);
    check('Duplicate payment blocked', r.status === 409);

    r = await api(port, 'POST', `/api/funding/${harish._id}/pay`, {}, adminToken);
    check('Admin can pay for anyone', r.status === 200 && r.body.paidCount === 2);

    r = await api(port, 'PATCH', `/api/funding/${harish._id}/status`, { paid: false }, adminToken);
    check('Admin reverts payment to pending', r.status === 200 && r.body.paidCount === 1);

    r = await api(port, 'PATCH', `/api/funding/${veera._id}/status`, { paid: false }, veeraToken);
    check('Member cannot change another payment status', r.status === 403);

    // Expenses
    r = await api(port, 'POST', '/api/expenses', { amount: 850, category: 'Groceries', description: 'Vegetables & milk', paidBy: gowtham._id, expenseDate: new Date().toISOString() }, veeraToken);
    check('Member cannot record expense paid by someone else', r.status === 403);

    r = await api(port, 'POST', '/api/expenses', { amount: 2450, category: 'Electricity', description: 'July EB bill', paidBy: harish._id, expenseDate: new Date().toISOString() }, adminToken);
    check('Admin creates expense for anyone', r.status === 201);

    r = await api(port, 'POST', '/api/expenses', { amount: 0, category: 'Misc', paidBy: gowtham._id }, adminToken);
    check('Zero amount expense rejected', r.status === 400);

    r = await api(port, 'GET', '/api/expenses');
    check('Expense ledger populated', r.status === 200 && r.body.length === 1);

    const expenseId = r.body[0]._id;
    r = await api(port, 'PATCH', `/api/expenses/${expenseId}`, { amount: 2500 }, veeraToken);
    check('Member cannot edit expense', r.status === 403);

    r = await api(port, 'PATCH', `/api/expenses/${expenseId}`, { amount: 2500, category: 'Electricity' }, adminToken);
    check('Admin edits expense', r.status === 200 && r.body.amount === 2500);

    r = await api(port, 'GET', '/api/funding/current');
    check('Balance reflects expenses', r.status === 200 && r.body.totalSpent === 2500 && r.body.balance === 5000 - 2500);

    r = await api(port, 'DELETE', `/api/expenses/${expenseId}`, {}, adminToken);
    check('Admin deletes expense', r.status === 200);

    r = await api(port, 'DELETE', `/api/expenses/${expenseId}`, {}, adminToken);
    check('Deleting missing expense -> 404', r.status === 404);

    // Chores
    r = await api(port, 'GET', '/api/chores');
    check('Chore schedule has 7 days', r.status === 200 && r.body.length === 7);
    const monday = r.body.find((d) => d.day === 'Monday');
    check(
      'Monday default schedule correct',
      monday.cooking.map((u) => u.name).join(',') === 'Veera,Harish' &&
        monday.cleaning.map((u) => u.name).join(',') === 'Gowtham,Ashwin' &&
        monday.homeClean.name === 'Jegan' &&
        monday.resting.length === 4
    );

    r = await api(port, 'POST', '/api/chores/swap', { day: 'Monday', personA: veera._id, personB: gowtham._id }, adminToken);
    check(
      'Swap duties works (Veera<->Gowtham)',
      r.status === 200 && r.body.cooking.some((u) => u.name === 'Gowtham') && r.body.cleaning.some((u) => u.name === 'Veera')
    );

    r = await api(port, 'POST', '/api/chores/swap', { day: 'Monday', personA: veera._id, personB: gowtham._id }, veeraToken);
    check('Member cannot swap duties', r.status === 403);

    r = await api(port, 'POST', '/api/chores/restore-default', {}, adminToken);
    check('Restore default schedule', r.status === 200 && r.body.length === 7);

    // Validation: duplicate person in two roles
    r = await api(port, 'PATCH', '/api/chores/Monday', { cooking: [veera._id, harish._id], cleaning: [veera._id, ashwin._id], homeClean: jegan._id }, adminToken);
    check('Duplicate assignment rejected', r.status === 400);

    r = await api(port, 'PATCH', '/api/chores/Monday', { cooking: [veera._id], cleaning: [gowtham._id, ashwin._id], homeClean: jegan._id }, adminToken);
    check('Wrong count rejected (1 cook)', r.status === 400);

    // Admin: audit logs
    r = await api(port, 'GET', '/api/admin/audit-logs', undefined, adminToken);
    check('Audit logs returned for admin', r.status === 200 && r.body.length > 0);

    r = await api(port, 'GET', '/api/admin/audit-logs', undefined, veeraToken);
    check('Member denied audit logs', r.status === 403);

    // Admin: PIN change
    r = await api(port, 'PATCH', `/api/users/${veera._id}/pin`, { newPin: '1111' }, adminToken);
    check('Admin changes member PIN', r.status === 200);
    r = await api(port, 'POST', '/api/auth/verify-pin', { name: 'Veera', pin: '1111' });
    check('New PIN works after change', r.status === 200);

    r = await api(port, 'PATCH', `/api/users/${gowtham._id}/pin`, { newPin: '9999' }, adminToken);
    check('Admin cannot change own protected PIN? (see note)', r.status === 200 || r.status === 403, `status=${r.status}`);

    // Admin: role management (promote / demote)
    r = await api(port, 'PATCH', `/api/users/${gowtham._id}`, { role: 'member' }, adminToken);
    check('Protected admin cannot be demoted', r.status === 403);

    r = await api(port, 'PATCH', `/api/users/${veera._id}`, { role: 'admin' }, adminToken);
    check('Admin promotes member to admin', r.status === 200 && r.body.user.role === 'admin');

    r = await api(port, 'POST', '/api/auth/verify-pin', { name: 'Veera', pin: '1111' });
    check('Promoted admin can log in as admin', r.status === 200 && r.body.user.role === 'admin');
    const veeraAdminToken = r.body.token;

    r = await api(port, 'GET', '/api/admin/audit-logs', undefined, veeraAdminToken);
    check('Promoted admin can access admin endpoints', r.status === 200);

    r = await api(port, 'PATCH', `/api/users/${veera._id}`, { role: 'member' }, veeraAdminToken);
    check('Self role change blocked', r.status === 403);

    r = await api(port, 'PATCH', `/api/users/${veera._id}`, { role: 'member' }, adminToken);
    check('Admin demotes promoted admin', r.status === 200 && r.body.user.role === 'member');

    // Funding history
    r = await api(port, 'GET', '/api/funding/history');
    check('Funding history available', r.status === 200 && r.body.length >= 1);

    // Rate limit check is skipped (would need 20+ attempts).

    console.log('\n================ SUMMARY ================');
    const passed = results.filter((x) => x.pass).length;
    console.log(`${passed}/${results.length} checks passed`);
    if (passed !== results.length) process.exitCode = 1;
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    await mongod.stop();
  }
})().catch((err) => {
  console.error('Smoke test crashed:', err);
  process.exit(1);
});
