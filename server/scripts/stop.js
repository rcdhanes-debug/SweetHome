/* Sweet Home stop helper.
 * Kills every Sweet Home process tree recorded by run.js (MongoDB, API server, Vite client).
 * Falls back to command-line matching if the PID file is missing or stale.
 */
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..', '..');
const PIDS_FILE = path.join(ROOT, 'data', 'homehq.pids.json');

function killTree(pid) {
  const r = spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
  return r.status === 0;
}

let stopped = 0;
let found = [];

if (fs.existsSync(PIDS_FILE)) {
  try {
    found = JSON.parse(fs.readFileSync(PIDS_FILE, 'utf8')) || [];
  } catch (_) {
    found = [];
  }
}

// Fallback: match Sweet Home processes by their command line (project paths).
// Runs whenever the PID file is missing OR failed to stop anything (stale PIDs).
if (found.length === 0 || stopped === 0) {
  const psScript =
    "Get-CimInstance Win32_Process | Where-Object { $_.Name -match '^(node|mongod)' -and ($_.CommandLine -match 'Sweet-Home' -or $_.CommandLine -match 'server\\\\scripts\\\\run\\\\.js' -or $_.CommandLine -match '\\\\server\\\\index.js' -or $_.CommandLine -match 'homehq') } | ForEach-Object { $_.ProcessId }";
  const r = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', psScript], { encoding: 'utf8' });
  if (r.status === 0 && r.stdout) {
    const extra = r.stdout
      .split(/[\r\n]+/)
      .map((s) => s.trim())
      .filter((s) => /^\d+$/.test(s))
      .map(Number)
      .filter((pid) => !found.includes(pid));
    found = found.concat(extra);
  }
}

for (const pid of found) {
  if (killTree(pid)) stopped += 1;
}

if (fs.existsSync(PIDS_FILE)) {
  try {
    fs.unlinkSync(PIDS_FILE);
  } catch (_) {
    /* ignore */
  }
}

console.log(`[Sweet Home] Stopped ${stopped} process tree(s). MongoDB data is kept.`);
