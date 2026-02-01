/**
 * packages/tools/workbench-server/src/security/ssrf.test.ts
 */
import { describe, it, expect } from 'vitest';
import { buildAllowlistedUrl } from './ssrf.js';

describe('buildAllowlistedUrl', () => {
  it('rejects absolute URLs', () => {
    const res = buildAllowlistedUrl({ baseUrl: 'https://api.github.com', path: 'https://evil.com/' });
    expect(res.ok).toBe(false);
  });

  it('rejects protocol-relative and backslash paths', () => {
    expect(buildAllowlistedUrl({ baseUrl: 'https://api.github.com', path: '//evil.com/x' }).ok).toBe(false);
    expect(buildAllowlistedUrl({ baseUrl: 'https://api.github.com', path: '\\\\evil\\x' }).ok).toBe(false);
  });

  it('builds URL on same origin and applies query params', () => {
    const res = buildAllowlistedUrl({
      baseUrl: 'https://api.github.com',
      path: '/repos/octo/repo',
      query: { per_page: '10' },
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.url.origin).toBe('https://api.github.com');
      expect(res.url.searchParams.get('per_page')).toBe('10');
    }
  });
});

