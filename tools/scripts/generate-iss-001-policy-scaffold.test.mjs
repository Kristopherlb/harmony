/**
 * tools/scripts/generate-iss-001-policy-scaffold.test.mjs
 * Unit tests for ISS-001 policy scaffold generator.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { __test } from './generate-iss-001-policy-scaffold.mjs';

test('extractSecretRefs finds artifact refs from text', () => {
  const refs = __test.extractSecretRefs(`
    token=/artifacts/console/public/secrets/github.token
    webhook=/artifacts/console/public/secrets/github.webhook_secret)
  `);
  assert.deepEqual(refs, [
    '/artifacts/console/public/secrets/github.token',
    '/artifacts/console/public/secrets/github.webhook_secret',
  ]);
});

test('toKvV2DataPath maps ref to mount/data path', () => {
  const p = __test.toKvV2DataPath('secret', '/artifacts/console/public/secrets/github.token');
  assert.equal(p, 'secret/data/artifacts/console/public/secrets/github.token');
});

test('renderHclPolicy emits deterministic read-only entries', () => {
  const hcl = __test.renderHclPolicy('secret', [
    '/artifacts/console/public/secrets/a',
    '/artifacts/console/public/secrets/b',
  ]);
  assert.equal(
    hcl,
    `path "secret/data/artifacts/console/public/secrets/a" {\n  capabilities = ["read"]\n}\n\npath "secret/data/artifacts/console/public/secrets/b" {\n  capabilities = ["read"]\n}`
  );
});

