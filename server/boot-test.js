/* Full boot test: real index.js boot path with in-memory MongoDB. */
require('dotenv').config();
const { MongoMemoryServer } = require('mongodb-memory-server');
const { spawn } = require('child_process');
const path = require('path');

(async () => {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri('homehq_boot');

  const env = {
    ...process.env,
    MONGODB_URI: uri,
    JWT_SECRET: 'boot-test-secret',
    LOG_LEVEL: 'none',
    AUTO_SEED: 'true',
    PORT: '5099'
  };

  const child = spawn(process.execPath, ['index.js'], {
    cwd: path.join(__dirname),
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let out = '';
  child.stdout.on('data', (d) => (out += d.toString()));
  child.stderr.on('data', (d) => (out += d.toString()));

  const waitFor = async (ms) => new Promise((r) => setTimeout(r, ms));

  let ok = false;
  for (let i = 0; i < 20; i++) {
    await waitFor(500);
    try {
      const res = await fetch('http://127.0.0.1:5099/api/health');
      if (res.status === 200) {
        const u = await fetch('http://127.0.0.1:5099/api/users');
        const body = await u.json();
        if (body.length === 9) {
          console.log(`PASS  Boot + auto-seed + health: ${body.length} users seeded`);
          const v = await fetch('http://127.0.0.1:5099/api/auth/verify-pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Gowtham', pin: '1234' })
          });
          const vj = await v.json();
          console.log(vj.token && vj.user.role === 'admin' ? 'PASS  Default dev PIN works on boot' : `FAIL  PIN: ${JSON.stringify(vj)}`);
          ok = true;
          break;
        }
      }
    } catch (_) {
      /* not up yet */
    }
  }

  child.kill('SIGTERM');
  await waitFor(1500);
  console.log(out.split('\n').filter(Boolean).join('\n'));
  if (!ok) {
    console.log('FAIL  boot test did not succeed');
    process.exitCode = 1;
  }
  await mongod.stop();
})();
