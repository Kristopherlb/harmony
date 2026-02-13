/**
 * packages/blueprints/src/workflows/deploy/blue-green-deploy.workflow.test.ts
 */
import { describe, it, expect, vi } from 'vitest';
import { BlueGreenDeployWorkflow } from './blue-green-deploy.workflow.js';

describe('BlueGreenDeployWorkflow', () => {
  it('supports runtime-true inline manifests and skipBuild for staging/kind harnesses', async () => {
    const workflow = new BlueGreenDeployWorkflow();
    const calls: Array<{ capId: string; input: any; options: any }> = [];

    (workflow as any).executeById = vi.fn(async (capId: string, input: any, options: any) => {
      calls.push({ capId, input, options });
      if (capId === 'golden.flags.flagd-sync') {
        return { status: 'SYNCED', flagsCount: 1 };
      }
      if (capId === 'golden.k8s.apply') {
        if (input?.operation === 'apply') return { success: true, resourcesAffected: 1, message: 'ok' };
        if (input?.operation === 'rollout-restart') return { success: true, resourcesAffected: 1, message: 'restarted' };
      }
      if (capId === 'golden.temporal.version-manager') return { success: true, message: 'ok' };
      return {};
    });

    const out = await workflow.main(
      {
        version: '1.0.0',
        registry: '',
        contextPath: '.',
        skipBuild: true,
        imageRef: 'nginx:1.25-alpine',
        skipFlags: true,
        manifests: [
          `
apiVersion: v1
kind: ConfigMap
metadata:
  name: smoke
`,
        ],
        kubeconfigSecretRef: '/artifacts/console/public/secrets/kubeconfig',
      } as any,
      {}
    );

    expect(out.success).toBe(true);
    expect(calls.some((c) => c.capId === 'golden.ci.container-builder')).toBe(false);

    const applyCall = calls.find((c) => c.capId === 'golden.k8s.apply' && c.input?.operation === 'apply');
    expect(applyCall?.input?.manifests?.length).toBe(1);
    expect(applyCall?.input?.manifestPath).toBeUndefined();
    expect(applyCall?.options).toMatchObject({
      secretRefs: { kubeconfig: '/artifacts/console/public/secrets/kubeconfig' },
    });
  });

  it('passes kubeconfigSecretRef through secretRefs to k8s and flag sync capabilities', async () => {
    const workflow = new BlueGreenDeployWorkflow();
    const calls: Array<{ capId: string; input: any; options: any }> = [];

    (workflow as any).executeById = vi.fn(async (capId: string, input: any, options: any) => {
      calls.push({ capId, input, options });
      if (capId === 'golden.ci.container-builder') {
        return { imageRef: 'img', digest: 'sha', pushed: true, buildDuration: 1 };
      }
      if (capId === 'golden.flags.auto-feature-flag') {
        if (input?.operation === 'generateReleaseFlags') return { flagdConfigPath: 'p', flagsGenerated: [] };
        if (input?.operation === 'rollbackRelease') return { ok: true };
      }
      if (capId === 'golden.flags.flagd-sync') {
        return { status: 'SYNCED', flagsCount: 1 };
      }
      if (capId === 'golden.k8s.apply') {
        if (input?.operation === 'apply') return { success: false, resourcesAffected: 0, message: 'fail' };
        if (input?.operation === 'rollout-restart') return { success: true, resourcesAffected: 0, message: 'restarted' };
      }
      if (capId === 'golden.temporal.version-manager') return { success: true, message: 'ok' };
      return {};
    });

    await expect(
      workflow.main(
        {
          version: '1.0.0',
          registry: 'ghcr.io/acme',
          contextPath: '.',
          kubeconfigSecretRef: '/artifacts/console/public/secrets/kubeconfig',
        },
        {}
      )
    ).rejects.toThrow(/K8s apply failed/i);

    const secretRefs = { kubeconfig: '/artifacts/console/public/secrets/kubeconfig' };

    const flagSyncCall = calls.find((c) => c.capId === 'golden.flags.flagd-sync');
    expect(flagSyncCall?.options).toMatchObject({ secretRefs });

    const k8sApplyCall = calls.find((c) => c.capId === 'golden.k8s.apply' && c.input?.operation === 'apply');
    expect(k8sApplyCall?.options).toMatchObject({ secretRefs });

    const k8sRollbackCall = calls.find(
      (c) => c.capId === 'golden.k8s.apply' && c.input?.operation === 'rollout-restart'
    );
    expect(k8sRollbackCall?.options).toMatchObject({ secretRefs });
  });

  it('registers compensations for mutating steps (flags rollback + k8s restart)', async () => {
    const workflow = new BlueGreenDeployWorkflow();
    const calls: Array<{ capId: string; input: any; options: any }> = [];

    (workflow as any).executeById = vi.fn(async (capId: string, input: any, options: any) => {
      calls.push({ capId, input, options });
      if (capId === 'golden.ci.container-builder') {
        return { imageRef: 'img', digest: 'sha', pushed: true, buildDuration: 1 };
      }
      if (capId === 'golden.flags.auto-feature-flag') {
        if (input?.operation === 'generateReleaseFlags') return { flagdConfigPath: 'p', flagsGenerated: [] };
        if (input?.operation === 'rollbackRelease') return { ok: true };
      }
      if (capId === 'golden.flags.flagd-sync') {
        return { status: 'SYNCED', flagsCount: 1 };
      }
      if (capId === 'golden.k8s.apply') {
        if (input?.operation === 'apply') return { success: false, resourcesAffected: 0, message: 'fail' };
        if (input?.operation === 'rollout-restart') return { success: true, resourcesAffected: 0, message: 'restarted' };
      }
      if (capId === 'golden.temporal.version-manager') return { success: true, message: 'ok' };
      return {};
    });

    await expect(
      workflow.main(
        {
          version: '1.0.0',
          registry: 'ghcr.io/acme',
          contextPath: '.',
          kubeconfigSecretRef: '/artifacts/console/public/secrets/kubeconfig',
        },
        {}
      )
    ).rejects.toThrow();

    // On failure, BaseBlueprint.main runs compensations LIFO; we should see rollback operations invoked.
    expect(
      calls.some(
        (c) => c.capId === 'golden.flags.auto-feature-flag' && c.input?.operation === 'rollbackRelease'
      )
    ).toBe(true);
    expect(
      calls.some((c) => c.capId === 'golden.k8s.apply' && c.input?.operation === 'rollout-restart')
    ).toBe(true);
  });
});

