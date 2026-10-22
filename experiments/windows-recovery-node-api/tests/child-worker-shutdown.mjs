import { createRequire } from 'node:module';
import { parentPort, workerData } from 'node:worker_threads';

const require = createRequire(import.meta.url);
const addon = require(workerData);
const session = addon.openSession();
const operation = session.probe(900);
const deadline = Date.now() + 3000;

while (session.snapshot().activeOperations === 0 && Date.now() < deadline) {
  await new Promise(resolve => setTimeout(resolve, 5));
}
if (session.snapshot().activeOperations !== 1) {
  throw new Error('native probe did not become active before the deadline');
}

parentPort.postMessage('probe-active');
await operation;
session.close();
