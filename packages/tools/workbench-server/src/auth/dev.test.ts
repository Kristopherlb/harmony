/**
 * packages/tools/workbench-server/src/auth/dev.test.ts
 */
import { describe, it, expect } from 'vitest';
import type http from 'node:http';
import { authenticateDev, readDevAuthConfigFromEnv } from './dev.js';

describe('dev auth', () => {
  it('returns undefined when disabled', () => {
    const cfg = readDevAuthConfigFromEnv({ WORKBENCH_DEV_AUTH: 'false' });
    const p = authenticateDev({ headers: {} } as unknown as http.IncomingMessage, cfg);
    expect(p).toBeUndefined();
  });

  it('uses defaults when enabled', () => {
    const cfg = readDevAuthConfigFromEnv({ WORKBENCH_DEV_AUTH: 'true', WORKBENCH_DEV_USER: 'user:x', WORKBENCH_DEV_ROLES: 'a,b' });
    const p = authenticateDev({ headers: {} } as unknown as http.IncomingMessage, cfg)!;
    expect(p.initiatorId).toBe('user:x');
    expect(p.roles).toEqual(['a', 'b']);
  });
});

