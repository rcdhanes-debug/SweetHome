const mongoose = require('mongoose');
const { MONGODB_URI } = require('./index');

async function connectDB() {
  mongoose.connection.on('error', (err) => {
    console.error('[db] MongoDB Cloud Atlas connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[db] MongoDB Cloud Atlas disconnected. Attempting reconnect...');
  });

  const conn = await mongoose.connect(MONGODB_URI);
  console.log(`MongoDB Cloud Atlas connected: ${conn.connection.host}/${conn.connection.name}`);
  return conn;
}

module.exports = connectDB;
