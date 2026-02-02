/**
 * tools/scripts/dev-bootstrap.test.mjs
 *
 * Purpose: deterministic unit tests for dev-bootstrap helpers.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';

import { __test } from './dev-bootstrap.mjs';

test('parseArgs supports --check/--wait-ms/--timeout-ms', () => {
  assert.deepEqual(__test.parseArgs(['--check']), { _: [], check: true });
  assert.deepEqual(__test.parseArgs(['--check', '--wait-ms', '1500']), { _: [], check: true, waitMs: 1500 });
  assert.deepEqual(__test.parseArgs(['--timeout-ms', '250']), { _: [], timeoutMs: 250 });
});

test('checkTcpPort returns ok=true when a local server is listening', async () => {
  const server = net.createServer(() => {});
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  const addr = server.address();
  assert.ok(addr && typeof addr === 'object');

  const res = await __test.checkTcpPort({
    host: '127.0.0.1',
    port: addr.port,
    timeoutMs: 250,
  });

  await new Promise((resolve) => server.close(resolve));
  assert.equal(res.ok, true);
});

