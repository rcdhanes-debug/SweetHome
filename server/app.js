require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const { LOG_LEVEL } = require('./config');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '16mb' }));
if (LOG_LEVEL !== 'none') app.use(morgan(LOG_LEVEL));

app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/funding', require('./routes/fundingRoutes'));
app.use('/api/expenses', require('./routes/expenseRoutes'));
app.use('/api/redeem', require('./routes/redeemRoutes'));
app.use('/api/chores', require('./routes/choreRoutes'));
app.use('/api/noticeboard', require('./routes/noticeRoutes'));
app.use('/api/events', require('./routes/eventRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/photos', express.json({ limit: '16mb' }), require('./routes/photoRoutes'));
app.use('/api/photo', require('./routes/photoRoutes'));
app.use('/api/push', require('./routes/pushRoutes'));

// Serve the built client in production.
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use(errorHandler);

module.exports = app;
