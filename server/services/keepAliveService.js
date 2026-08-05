function startKeepAlive() {
  const serverUrl = process.env.RENDER_EXTERNAL_URL || process.env.SERVER_URL;
  if (!serverUrl) {
    console.log('[keep-alive] No RENDER_EXTERNAL_URL or SERVER_URL set. Self-ping inactive on localhost.');
    return;
  }

  const pingUrl = `${serverUrl.replace(/\/$/, '')}/api/health`;
  console.log(`[keep-alive] 🚀 Self-ping active! Pinging ${pingUrl} every 10 minutes to prevent Render sleep.`);

  // Initial ping 30s after server boot
  setTimeout(async () => {
    try {
      await fetch(pingUrl);
      console.log('[keep-alive] Initial boot pulse sent.');
    } catch (_) {}
  }, 30000);

  // Periodic ping every 10 minutes (600,000 ms)
  setInterval(async () => {
    try {
      const res = await fetch(pingUrl);
      console.log(`[keep-alive] Pulse sent (status: ${res.status}). Render kept awake!`);
    } catch (err) {
      console.error('[keep-alive] Pulse failed:', err.message);
    }
  }, 10 * 60 * 1000);
}

module.exports = { startKeepAlive };
