/**
 * packages/tools/mcp-server/src/manifest/infrastructure-manifests.test.ts
 *
 * Purpose:
 * - Guardrail for Phase 7 infrastructure artifacts (K8s + Istio).
 * - Keeps "everything is a capability" dogfooding deploy assets present in repo.
 *
 * Notes:
 * - We intentionally do lightweight text checks to avoid extra YAML deps.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readFileOrThrow(p: string): string {
  if (!fs.existsSync(p)) throw new Error(`Missing required file: ${p}`);
  return fs.readFileSync(p, 'utf-8');
}

describe('infrastructure manifests', () => {
  it('includes K8s worker deploy manifests with expected substitutions', () => {
    const root = path.resolve(__dirname, '../../../../..');
    const workerDeployment = path.join(root, 'deploy/k8s/workers/worker-deployment.yaml');

    const content = readFileOrThrow(workerDeployment);
    expect(content).toContain('kind: Deployment');
    expect(content).toContain('name: harmony-worker-${BUILD_ID}');
    expect(content).toContain('image: ${IMAGE_REF}');
    expect(content).toContain('name: WORKER_BUILD_ID');
    expect(content).toContain('value: "${BUILD_ID}"');
    expect(content).toContain('name: WORKER_VERSIONING');
    expect(content).toContain('value: "true"');
  });

  it('includes K8s flagd manifests expecting ConfigMap flagd-flags', () => {
    const root = path.resolve(__dirname, '../../../../..');
    const flagdDeployment = path.join(root, 'deploy/k8s/flagd/deployment.yaml');
    const flagdService = path.join(root, 'deploy/k8s/flagd/service.yaml');

    const d = readFileOrThrow(flagdDeployment);
    expect(d).toContain('kind: Deployment');
    expect(d).toContain('name: flagd');
    expect(d).toContain('name: flags-config');
    expect(d).toContain('name: flagd-flags');
    expect(d).toContain('mountPath: /etc/flagd');

    const s = readFileOrThrow(flagdService);
    expect(s).toContain('kind: Service');
    expect(s).toContain('name: flagd');
    expect(s).toContain('port: 8013');
  });

  it('includes Istio traffic routing config for stable/canary subsets', () => {
    const root = path.resolve(__dirname, '../../../../..');
    const vs = path.join(root, 'deploy/istio/virtual-service.yaml');
    const dr = path.join(root, 'deploy/istio/destination-rule.yaml');

    const virtualService = readFileOrThrow(vs);
    expect(virtualService).toContain('kind: VirtualService');
    expect(virtualService).toContain('name: harmony-mcp');
    expect(virtualService).toContain('subset: canary');
    expect(virtualService).toContain('subset: stable');

    const destinationRule = readFileOrThrow(dr);
    expect(destinationRule).toContain('kind: DestinationRule');
    expect(destinationRule).toContain('name: harmony-mcp');
    expect(destinationRule).toContain('name: stable');
    expect(destinationRule).toContain('name: canary');
    expect(destinationRule).toContain('version: stable');
    expect(destinationRule).toContain('version: canary');
  });
});

