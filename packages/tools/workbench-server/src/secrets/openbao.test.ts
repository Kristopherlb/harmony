/**
 * packages/tools/workbench-server/src/secrets/openbao.test.ts
 */
import { describe, it, expect } from 'vitest';
import { extractOpenBaoSecretValue } from './openbao.js';

describe('extractOpenBaoSecretValue', () => {
  it('extracts KV v1 data.value', () => {
    expect(extractOpenBaoSecretValue({ data: { value: 'x' } })).toBe('x');
  });

  it('extracts KV v1 data.token', () => {
    expect(extractOpenBaoSecretValue({ data: { token: 'x' } })).toBe('x');
  });

  it('extracts KV v2 data.data.value', () => {
    expect(extractOpenBaoSecretValue({ data: { data: { value: 'x' } } })).toBe('x');
  });
});

