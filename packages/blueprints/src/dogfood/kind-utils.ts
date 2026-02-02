/**
 * packages/blueprints/src/dogfood/kind-utils.ts
 *
 * Purpose: Pure helpers for Kind-based local dogfooding (IMP-023).
 * These helpers are unit-tested (no shell / no network).
 */
export function rewriteKubeconfigServerHost(opts: {
  kubeconfigYaml: string;
  /** e.g. host.docker.internal */
  host: string;
}): string {
  const { kubeconfigYaml, host } = opts;
  // Replace common Kind local endpoints so containers can reach the API server on macOS.
  // Keep it conservative: only rewrite localhost/127.0.0.1 endpoints.
  return kubeconfigYaml
    .replace(/server:\s+https:\/\/127\.0\.0\.1:(\d+)/g, `server: https://${host}:$1`)
    .replace(/server:\s+https:\/\/localhost:(\d+)/g, `server: https://${host}:$1`);
}

export function openBaoKvV2WriteRequest(opts: {
  baoAddr: string;
  mount: string;
  /** ISS-001 absolute ref path, e.g. /artifacts/dogfood/public/secrets/kubeconfig */
  refPath: string;
  value: string;
}): { url: string; body: string } {
  const addr = opts.baoAddr.replace(/\/+$/, '');
  const mount = opts.mount.replace(/^\/+|\/+$/g, '');
  const rel = opts.refPath.replace(/^\/+/, '');
  const url = `${addr}/v1/${mount}/data/${rel}`;
  const body = JSON.stringify({ data: { value: opts.value } });
  return { url, body };
}

