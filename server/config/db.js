const dns = require('dns');
const mongoose = require('mongoose');
const { MONGODB_URI } = require('./index');

// Ensure MongoDB Atlas SRV records resolve properly on Windows/ISP DNS
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (_) {}

async function connectDB() {
  mongoose.connection.on('error', (err) => {
    console.error('[db] MongoDB Cloud Atlas connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[db] MongoDB Cloud Atlas disconnected. Attempting reconnect...');
  });

  try {
    const conn = await mongoose.connect(MONGODB_URI);
    console.log(`MongoDB Cloud Atlas connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || (err.message && err.message.includes('querySrv'))) {
      console.warn('[db] SRV query failed with default DNS, retrying with Google DNS...');
      dns.setServers(['8.8.8.8', '1.1.1.1']);
      const conn = await mongoose.connect(MONGODB_URI);
      console.log(`MongoDB Cloud Atlas connected: ${conn.connection.host}/${conn.connection.name}`);
      return conn;
    }
    throw err;
  }
}

module.exports = connectDB;
