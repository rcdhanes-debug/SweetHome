/* Sweet Home launcher.
 * Starts a persistent local MongoDB (uses the embedded mongod binary),
 * then runs the API server and the Vite client in the same window.
 *
 * Usage:  node server/scripts/run.js            (dev mode)
 *         node server/scripts/run.js prod       (production: built client served by Express)
 */
const { spawn, spawnSync, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');

const ROOT = path.join(__dirname, '..', '..');
const SERVER = path.join(ROOT, 'server');
const CLIENT = path.join(ROOT, 'client');
const DATA_DIR = path.join(ROOT, 'data', 'db');
const PIDS_FILE = path.join(ROOT, 'data', 'homehq.pids.json');
const DB_PORT = process.env.HOMEHQ_DB_PORT || '27017';
const DEV_PORT = '5173';
const PROD_PORT = process.env.PORT || '5000';

const prod = process.argv.includes('prod');
const isWin = process.platform === 'win32';
const nodeCmd = process.execPath;
const NPM_CLI = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
const VITE = path.join(CLIENT, 'node_modules', 'vite', 'bin', 'vite.js');

const children = [];
let stopping = false;

function log(msg) {
  console.log(`\n[Sweet Home] ${msg}`);
}

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { stdio: 'inherit', ...opts });
}

async function runAsync(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const c = spawn(cmd, args, { stdio: 'inherit', ...opts });
    c.on('error', reject);
    c.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited with code ${code}`))));
  });
}

function ensure(name, dir) {
  if (!fs.existsSync(path.join(dir, 'node_modules'))) {
    log(`Installing ${name} dependencies (one-time, may take a while)…`);
    run(nodeCmd, [NPM_CLI, 'install', '--no-audit', '--no-fund'], { cwd: dir });
  }
}

function ensureEnv() {
  const env = path.join(SERVER, '.env');
  if (!fs.existsSync(env)) {
    fs.copyFileSync(path.join(ROOT, '.env.example'), env);
    log('Created server/.env from .env.example (default dev settings).');
  }
}

function spawnTrack(name, cmd, args, opts = {}) {
  const child = spawn(cmd, args, { stdio: 'inherit', ...opts });
  children.push(child);
  writePids();
  child.on('exit', (code) => {
    const idx = children.indexOf(child);
    if (idx >= 0) children.splice(idx, 1);
    writePids();
    if (code !== 0 && !stopping) {
      log(`${name} stopped unexpectedly (code ${code}). Shutting down Sweet Home.`);
      shutdown(1);
    }
  });
  return child;
}

function writePids() {
  try {
    fs.mkdirSync(path.dirname(PIDS_FILE), { recursive: true });
    fs.writeFileSync(PIDS_FILE, JSON.stringify([process.pid, ...children.map((c) => c.pid)]));
  } catch (_) {
    /* non-fatal */
  }
}

function waitForMongo(timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const s = net.connect(Number(DB_PORT), '127.0.0.1');
      s.once('connect', () => {
        s.destroy();
        resolve();
      });
      s.once('error', () => {
        s.destroy();
        if (Date.now() > deadline) reject(new Error(`MongoDB did not start within ${timeoutMs / 1000}s on port ${DB_PORT}.`));
        else setTimeout(tryConnect, 700);
      });
    };
    tryConnect();
  });
}

function openBrowser(url) {
  if (process.env.HOMEHQ_NO_BROWSER) return;
  try {
    if (isWin) exec(`start "" "${url}"`);
    else if (process.platform === 'darwin') exec(`open "${url}"`);
    else exec(`xdg-open "${url}"`);
  } catch (_) {
    log(`Open ${url} in your browser.`);
  }
}

function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  log('Stopping all Sweet Home processes…');
  for (const c of children) {
    try {
      c.kill();
    } catch (_) {
      /* ignore */
    }
  }
  try {
    fs.unlinkSync(PIDS_FILE);
  } catch (_) {
    /* ignore */
  }
  setTimeout(() => process.exit(code), 600);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

(async () => {
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  if (nodeMajor < 18) {
    log(`Node.js v${process.versions.node} is too old. Install Node 18+ and re-run.`);
    process.exit(1);
  }

  log(`Sweet Home launcher — ${prod ? 'PRODUCTION' : 'DEVELOPMENT'} mode`);
  writePids();
  ensureEnv();
  ensure('server', SERVER);
  ensure('client', CLIENT);

  const { MongoBinary } = require('mongodb-memory-server-core');

  if (prod) {
    log('Building client…');
    await runAsync(nodeCmd, [VITE, 'build'], { cwd: CLIENT });
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });
  log('Starting MongoDB (first run uses the cached embedded binary)…');
  const mongod = await MongoBinary.getPath();
  spawnTrack('MongoDB', mongod, ['--dbpath', DATA_DIR, '--port', DB_PORT, '--bind_ip', '127.0.0.1', '--quiet']);

  await waitForMongo();
  log(`MongoDB ready on 127.0.0.1:${DB_PORT} (data stored in ${DATA_DIR})`);

  if (prod) {
    spawnTrack('Sweet Home Server', nodeCmd, ['index.js'], { cwd: SERVER });
    await new Promise((r) => setTimeout(r, 2500));
    openBrowser(`http://localhost:${PROD_PORT}/dashboard`);
    log(`Sweet Home running — http://localhost:${PROD_PORT}`);
  } else {
    spawnTrack('Sweet Home Server', nodeCmd, ['--watch', 'index.js'], { cwd: SERVER });
    spawnTrack('Sweet Home Client', nodeCmd, [VITE], { cwd: CLIENT });
    await new Promise((r) => setTimeout(r, 4500));
    openBrowser(`http://localhost:${DEV_PORT}/dashboard`);
    log(`Sweet Home running — http://localhost:${DEV_PORT}  (API: http://localhost:5000)`);
  }

  log('Press Ctrl+C (or close this window) to stop Sweet Home.');

  // Keep the process alive while children run.
  setInterval(() => {}, 1 << 30);
})().catch((err) => {
  log(`Startup failed: ${err.message}`);
  shutdown(1);
});
