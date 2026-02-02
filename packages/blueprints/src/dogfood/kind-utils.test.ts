/**
 * packages/blueprints/src/dogfood/kind-utils.test.ts
 */
import { describe, expect, it } from 'vitest';
import { openBaoKvV2WriteRequest, rewriteKubeconfigServerHost } from './kind-utils.js';

describe('kind-utils', () => {
  it('rewrites localhost API server host to host.docker.internal', () => {
    const input = `
apiVersion: v1
clusters:
- cluster:
    server: https://127.0.0.1:51512
  name: kind-harmony-dogfood
`;
    const out = rewriteKubeconfigServerHost({ kubeconfigYaml: input, host: 'host.docker.internal' });
    expect(out).toContain('server: https://host.docker.internal:51512');
  });

  it('builds OpenBao KV v2 write request from ISS-001 ref path', () => {
    const req = openBaoKvV2WriteRequest({
      baoAddr: 'http://localhost:8200',
      mount: 'secret',
      refPath: '/artifacts/dogfood/public/secrets/kubeconfig',
      value: 'kubeconfig-yaml',
    });
    expect(req.url).toBe('http://localhost:8200/v1/secret/data/artifacts/dogfood/public/secrets/kubeconfig');
    expect(req.body).toContain('"value":"kubeconfig-yaml"');
  });
});

