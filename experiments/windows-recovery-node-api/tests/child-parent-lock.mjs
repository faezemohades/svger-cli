import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';

const [addonPath, parentPath, mode] = process.argv.slice(2);
if (!addonPath || !parentPath || !mode) throw new Error('addon path, parent path, and mode are required');
const require = createRequire(import.meta.url);
const addon = require(addonPath);

if (mode === 'exit-holding') {
  addon.openLockedSession(parentPath);
  process.stdout.write('lock-acquired; exiting without close\n');
  process.exit(0);
}

if (mode === 'poll') {
  process.stdout.write('polling\n');
  let busyAttempts = 0;
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      const session = addon.openLockedSession(parentPath);
      session.close();
      process.stdout.write(JSON.stringify({ acquired: true, busyAttempts }) + '\n');
      process.exit(0);
    } catch (error) {
      if (error.code !== 'E_PARENT_LOCK_BUSY' || error.category !== 'busy') throw error;
      busyAttempts += 1;
    }
    await delay(10);
  }
  process.stderr.write(JSON.stringify({ acquired: false, busyAttempts }) + '\n');
  process.exit(2);
}

if (mode !== 'acquire') throw new Error(`unknown child mode: ${mode}`);
try {
  const session = addon.openLockedSession(parentPath);
  session.close();
  process.stdout.write(JSON.stringify({ status: 'acquired' }) + '\n');
} catch (error) {
  if (error.code === 'E_PARENT_LOCK_BUSY') {
    process.stdout.write(JSON.stringify({
      status: 'busy',
      code: error.code,
      category: error.category,
      retryable: error.retryable,
      win32: error.win32,
    }) + '\n');
  } else {
    process.stderr.write(`${error.code ?? error.name}: ${error.message}\n`);
    process.exitCode = 1;
  }
}
