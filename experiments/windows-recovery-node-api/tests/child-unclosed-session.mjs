import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const addonPath = process.argv[2];
assert.ok(addonPath, 'native addon path argument is required');
const addon = require(addonPath);
const session = addon.openSession();
assert.equal(addon.liveResourceCount(), 1);
process.stdout.write('session-opened; exiting without explicit close\n');
// Deliberately bypass JS finalizers. The OS must release process-owned native
// handles when the process exits. This child is isolated and owns no files.
process.exit(0);
