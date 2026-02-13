/**
 * packages/blueprints/scripts/run-kind-dogfood-blue-green.ts
 *
 * Purpose:
 * - Local-only runtime smoke for dogfooding (IMP-023).
 * - Provisions a Kind cluster, stores kubeconfig in OpenBao (ISS-001 ref),
 *   deploys flagd, then exercises real capabilities against the cluster:
 *   - golden.flags.flagd-sync (with inline configJson)
 *   - golden.k8s.apply (with inline manifests)
 *
 * Notes:
 * - Requires: docker, kubectl, kind, and OpenBao running (docker-compose).
 * - Uses Temporal TestWorkflowEnvironment + real executeDaggerCapability activity.
 *
 * Run:
 *   pnpm --filter @golden/blueprints run bundle-workflows
 *   ENABLE_DAGGER_E2E=1 pnpm --filter @golden/blueprints exec tsx scripts/run-kind-dogfood-blue-green.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import type { ExecuteCapabilityActivityInput } from '@golden/core/workflow';
import { SECURITY_CONTEXT_MEMO_KEY, GOLDEN_CONTEXT_MEMO_KEY } from '@golden/core/workflow';
import { executeDaggerCapability } from '../src/worker/execute-dagger-capability.js';
import { openBaoKvV2WriteRequest, rewriteKubeconfigServerHost } from '../src/dogfood/kind-utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(packageRoot, '../..');
const bundlePath = path.join(packageRoot, 'dist', 'workflow-bundle.js');

function mustHave(cmd: string, installHint: string): void {
  try {
    execSync(`command -v ${cmd}`, { stdio: 'ignore' });
  } catch {
    throw new Error(`Missing required tool: ${cmd}. ${installHint}`);
  }
}

function sh(cmd: string): string {
  return execSync(cmd, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

async function checkOpenBao(opts: { addr: string; token: string }): Promise<void> {
  const res = await fetch(`${opts.addr.replace(/\/+$/, '')}/v1/sys/health`, {
    headers: { 'X-Vault-Token': opts.token },
  });
  if (!res.ok) {
    const text = (await res.text().catch(() => '')) || res.statusText;
    throw new Error(`OpenBao not reachable: ${res.status} ${text}`);
  }
}

async function writeKubeconfigToOpenBao(opts: {
  baoAddr: string;
  baoToken: string;
  mount: string;
  refPath: string;
  kubeconfigYaml: string;
}): Promise<void> {
  const { url, body } = openBaoKvV2WriteRequest({
    baoAddr: opts.baoAddr,
    mount: opts.mount,
    refPath: opts.refPath,
    value: opts.kubeconfigYaml,
  });
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Vault-Token': opts.baoToken,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body,
  });
  if (!res.ok) {
    const text = (await res.text().catch(() => '')) || res.statusText;
    throw new Error(`OpenBao write failed (${res.status}): ${text}`);
  }
}

function readUtf8(p: string): string {
  return fs.readFileSync(p, 'utf-8');
}

async function main(): Promise<void> {
  mustHave('docker', 'Install Docker Desktop.');
  mustHave('kubectl', 'Install kubectl (e.g., via Homebrew).');
  mustHave('kind', 'Install kind (e.g., `brew install kind`).');

  if (!fs.existsSync(bundlePath)) {
    throw new Error(`Workflow bundle missing at ${bundlePath}. Run: pnpm --filter @golden/blueprints run bundle-workflows`);
  }

  const clusterName = process.env.DOGFOOD_KIND_CLUSTER ?? 'harmony-dogfood';
  const kubectlContext = `kind-${clusterName}`;
  const namespace = process.env.DOGFOOD_NAMESPACE ?? 'default';
  const buildId = process.env.DOGFOOD_BUILD_ID ?? 'dogfood';
  const induceFailure = process.env.DOGFOOD_INDUCE_FAILURE === '1';

  const baoAddr = process.env.BAO_ADDR ?? process.env.VAULT_ADDR ?? 'http://localhost:8200';
  const baoToken = process.env.BAO_TOKEN ?? process.env.VAULT_TOKEN ?? 'root';
  const baoMount = process.env.BAO_KV_MOUNT ?? 'secret';
  const kubeconfigRefPath = process.env.DOGFOOD_KUBECONFIG_REF ?? '/artifacts/dogfood/public/secrets/kubeconfig';

  await checkOpenBao({ addr: baoAddr, token: baoToken });

  const clusters = sh('kind get clusters');
  if (!clusters.split('\n').includes(clusterName)) {
    sh(`kind create cluster --name ${clusterName}`);
  }

  const rawKubeconfig = sh(`kind get kubeconfig --name ${clusterName}`);
  const kubeconfig = rewriteKubeconfigServerHost({ kubeconfigYaml: rawKubeconfig, host: 'host.docker.internal' });

  await writeKubeconfigToOpenBao({
    baoAddr,
    baoToken,
    mount: baoMount,
    refPath: kubeconfigRefPath,
    kubeconfigYaml: kubeconfig,
  });

  // Bootstrap flagd via host kubectl (we will validate ConfigMap creation via capability).
  const flagdDir = path.join(repoRoot, 'deploy/k8s/flagd');
  sh(`kubectl --context ${kubectlContext} -n ${namespace} apply -f ${flagdDir}`);
  sh(`kubectl --context ${kubectlContext} -n ${namespace} rollout status deployment/flagd --timeout=120s`);

  const flagsJson = readUtf8(path.join(repoRoot, 'deploy/flagd/flags.json'));
  const workerYaml = readUtf8(path.join(repoRoot, 'deploy/k8s/workers/worker-deployment.yaml'));

  // Temporal test env + worker that can execute Dagger-backed capabilities.
  const recordedCalls: ExecuteCapabilityActivityInput<unknown>[] = [];
  const testEnv = await TestWorkflowEnvironment.createTimeSkipping();
  let worker: Worker | undefined;
  try {
    worker = await Worker.create({
      connection: testEnv.nativeConnection,
      namespace: testEnv.options.namespace ?? 'default',
      taskQueue: 'dogfood-exec',
      workflowBundle: { codePath: bundlePath },
      reuseV8Context: false,
      activities: {
        async executeDaggerCapability<In, Out>(input: ExecuteCapabilityActivityInput<In>): Promise<Out> {
          recordedCalls.push(input as ExecuteCapabilityActivityInput<unknown>);
          return executeDaggerCapability(input);
        },
        async evaluateFlag(): Promise<boolean> {
          // Keep smoke deterministic and focused on runtime execution of k8s/flagd capabilities.
          return true;
        },
      },
    });

    const memo = {
      [SECURITY_CONTEXT_MEMO_KEY]: {
        initiatorId: 'user:dogfood',
        roles: ['deploy:blue-green'],
        tokenRef: '',
        traceId: 'trace-dogfood',
      },
      [GOLDEN_CONTEXT_MEMO_KEY]: {
        app_id: 'dogfood',
        environment: 'local',
        initiator_id: 'user:dogfood',
        trace_id: 'trace-dogfood',
      },
    };

    // 1) Sync flags into ConfigMap using flagd-sync (inline configJson).
    await worker.runUntil(async () => {
      const handle = await testEnv.client.workflow.start('executeCapabilityWorkflow', {
        taskQueue: 'dogfood-exec',
        workflowId: `dogfood-flagd-sync-${Date.now()}`,
        args: [
          {
            capId: 'golden.flags.flagd-sync',
            args: {
              operation: 'sync',
              namespace,
              configMapName: 'flagd-flags',
              version: buildId,
              configJson: flagsJson,
            },
            secretRefs: { kubeconfig: kubeconfigRefPath },
          },
          {},
        ],
        memo,
      });
      await handle.result();
    });

    // Verify ConfigMap exists (host kubectl).
    sh(`kubectl --context ${kubectlContext} -n ${namespace} get configmap flagd-flags`);

    // 2) Apply worker deployment via k8s.apply (inline manifest) + substitutions.
    await worker.runUntil(async () => {
      const handle = await testEnv.client.workflow.start('executeCapabilityWorkflow', {
        taskQueue: 'dogfood-exec',
        workflowId: `dogfood-k8s-apply-${Date.now()}`,
        args: [
          {
            capId: 'golden.k8s.apply',
            args: {
              operation: 'apply',
              namespace,
              manifests: [workerYaml],
              substitutions: {
                BUILD_ID: buildId,
                IMAGE_REF: process.env.DOGFOOD_IMAGE_REF ?? 'nginx:1.25-alpine',
                IMAGE_TAG: buildId,
              },
              wait: true,
              timeoutSeconds: 300,
            },
            secretRefs: { kubeconfig: kubeconfigRefPath },
          },
          {},
        ],
        memo,
      });
      await handle.result();
    });

    sh(`kubectl --context ${kubectlContext} -n ${namespace} rollout status deployment/harmony-worker-${buildId} --timeout=180s`);

    // 3) Induce a failure and validate compensation behavior using the same operation
    // that `blueprints.deploy.blue-green` registers as a rollback step.
    if (induceFailure) {
      try {
        throw new Error('DOGFOOD_INDUCED_FAILURE (expected)');
      } catch {
        await worker.runUntil(async () => {
          const handle = await testEnv.client.workflow.start('executeCapabilityWorkflow', {
            taskQueue: 'dogfood-exec',
            workflowId: `dogfood-k8s-rollout-restart-${Date.now()}`,
            args: [
              {
                capId: 'golden.k8s.apply',
                args: {
                  operation: 'rollout-restart',
                  namespace,
                  resourceType: 'deployment',
                  resourceName: `harmony-worker-${buildId}`,
                  wait: true,
                  timeoutSeconds: 180,
                },
                secretRefs: { kubeconfig: kubeconfigRefPath },
              },
              {},
            ],
            memo,
          });
          await handle.result();
        });
      }

      sh(
        `kubectl --context ${kubectlContext} -n ${namespace} rollout status deployment/harmony-worker-${buildId} --timeout=180s`
      );
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          cluster: clusterName,
          context: kubectlContext,
          namespace,
          buildId,
          inducedFailure: induceFailure,
          calls: recordedCalls.map((c) => c.capId),
        },
        null,
        2
      )
    );
  } finally {
    if (worker) {
      try {
        await worker.shutdown();
      } catch {
        // ignore
      }
    }
    await testEnv.teardown();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

