import { Router } from 'express';
import { z } from 'zod';
import * as blueprints from '@golden/blueprints';
import * as coreWorkflow from '@golden/core/workflow';
import { unwrapCjsNamespace } from '../lib/cjs-interop';
import { getTemporalClient } from '../services/temporal/temporal-client.js';
import { deriveWorkflowProgressFromHistory } from './workflow-progress';

export const workflowsRouter = Router();

const blueprintsPkg = unwrapCjsNamespace<typeof blueprints>(blueprints as any);
const coreWorkflowPkg = unwrapCjsNamespace<typeof coreWorkflow>(coreWorkflow as any);

const RunBlueprintRequestSchema = z.object({
  blueprintId: z.string().min(1),
  input: z.unknown().optional(),
  workflowId: z.string().optional(),
});

const WorkflowApprovalRequestSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  approverId: z.string().min(1).optional(),
  approverName: z.string().min(1).optional(),
  approverRoles: z.array(z.string()).optional(),
  reason: z.string().optional(),
});

workflowsRouter.get('/health', async (_req, res) => {
  try {
    await getTemporalClient();
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message ?? String(error) });
  }
});

workflowsRouter.get('/', async (req, res) => {
    try {
        const client = await getTemporalClient();
        // Default to listing open workflows.
        // In a real app, you'd want pagination and filtering params.
        // Default to listing all workflows. 
        // Note: Complex boolean queries like 'OR' require Advanced Visibility (Elasticsearch).
        // Standard Visibility (SQL/Cassandra) has limited support.
        const handle = await client.list();

        const workflows = [];
        for await (const wf of handle) {
            workflows.push({
                workflowId: wf.workflowId,
                runId: wf.runId,
                type: wf.type,
                status: wf.status.name,
                startTime: wf.startTime,
                closeTime: wf.closeTime,
            });
            // Limit to 50 for now to avoid massive payloads
            if (workflows.length >= 50) break;
        }

        res.json(workflows);
    } catch (error: any) {
        console.error('Failed to list workflows:', error);
        res.status(500).json({
            error: 'Failed to fetch workflows',
            details: error.message || String(error)
        });
    }
});

// Phase 2: list workflows that are pending HITL approval.
// NOTE: Uses basic visibility + per-workflow query; intended for small local/staging volumes.
workflowsRouter.get('/pending-approvals', async (req, res) => {
  try {
    const client = await getTemporalClient();
    const typeFilter = typeof (req as any)?.query?.type === 'string' ? String((req as any).query.type) : '';
    const limit = Math.min(Number((req as any)?.query?.limit) || 25, 100);

    const out: any[] = [];
    const handle = await client.list();
    for await (const wf of handle) {
      if (typeFilter && wf.type !== typeFilter) continue;
      if (out.length >= limit) break;

      try {
        const h = client.getHandle(wf.workflowId);
        const state = await (h as any).query((coreWorkflowPkg as any).approvalStateQuery);
        if (state?.status === 'pending') {
          out.push({
            workflowId: wf.workflowId,
            runId: wf.runId,
            type: wf.type,
            status: wf.status.name,
            state,
          });
        }
      } catch {
        // ignore workflows that don't support approval queries
      }
    }

    return res.json({ workflows: out });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to list pending approvals', details: error?.message ?? String(error) });
  }
});

// Start a registered blueprint workflow on the local Temporal dev stack.
// POST /api/workflows/run-blueprint
workflowsRouter.post('/run-blueprint', async (req, res) => {
  const parsed = RunBlueprintRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
  }

  try {
    const client = await getTemporalClient();
    const registry = (blueprintsPkg as any).createBlueprintRegistry();
    const bp = (blueprintsPkg as any).getBlueprint(registry, parsed.data.blueprintId);

    const taskQueue = process.env.TEMPORAL_TASK_QUEUE || 'golden-tools';
    const workflowId =
      parsed.data.workflowId || `${parsed.data.blueprintId}-${Date.now()}`;
    const traceId = `trace-${workflowId}`;

    // Minimal local dev contexts required by BaseBlueprint.executeById()
    const securityContext = {
      initiatorId: 'local-user',
      roles: ['local'],
      tokenRef: 'local',
      traceId,
    };

    const goldenContext = {
      app_id: 'console',
      environment: 'local',
      initiator_id: securityContext.initiatorId,
      trace_id: traceId,
      cost_center: 'local',
      data_classification: 'INTERNAL',
    };

    const handle = await (client as any).start(bp.workflowType as any, {
      taskQueue,
      workflowId,
      args: [parsed.data.input ?? {}],
      memo: {
        [(coreWorkflowPkg as any).SECURITY_CONTEXT_MEMO_KEY]: securityContext,
        [(coreWorkflowPkg as any).GOLDEN_CONTEXT_MEMO_KEY]: goldenContext,
      },
    });

    return res.json({
      workflowId: handle.workflowId,
      runId: handle.firstExecutionRunId,
      taskQueue,
      workflowType: bp.workflowType,
    });
  } catch (error: any) {
    console.error('Failed to start blueprint workflow:', error);
    return res.status(500).json({ error: 'Failed to start workflow', details: error?.message ?? String(error) });
  }
});

workflowsRouter.get('/:id', async (req, res) => {
    try {
        const client = await getTemporalClient();
        const handle = client.getHandle(req.params.id);
        const description = await handle.describe();

        res.json({
            workflowId: description.workflowId,
            runId: description.runId,
            status: description.status.name,
            type: description.type,
            startTime: description.startTime,
            closeTime: description.closeTime,
            historyLength: description.historyLength,
        });
    } catch (error) {
        console.error('Failed to get workflow details:', error);
        res.status(500).json({ error: 'Failed to fetch workflow details' });
    }
});

// Phase 4.3.2 / IMP-045: step-level progress from Temporal history (for per-node execution status).
workflowsRouter.get('/:id/progress', async (req, res) => {
  try {
    const client = await getTemporalClient();
    const handle = client.getHandle(req.params.id);
    const description = await handle.describe();

    const workflowId = description.workflowId;
    const runId = description.runId;

    const namespace = (client as any)?.options?.namespace ?? 'default';
    const workflowService = (client as any)?.connection?.workflowService;
    if (!workflowService) {
      return res.status(500).json({ error: 'TEMPORAL_CLIENT_UNAVAILABLE' });
    }

    const historyResponse = await workflowService.getWorkflowExecutionHistory({
      namespace,
      execution: { workflowId, runId },
    });

    const events = historyResponse?.history?.events ?? [];
    const progress = deriveWorkflowProgressFromHistory(events);

    return res.json({
      workflowId,
      runId,
      status: description.status.name,
      steps: progress.steps,
    });
  } catch (error: any) {
    console.error('Failed to get workflow progress:', error);
    return res.status(500).json({ error: 'Failed to fetch workflow progress', details: error?.message ?? String(error) });
  }
});

// Phase 2: approvals for HITL workflows (query + signal)
workflowsRouter.get('/:id/approval', async (req, res) => {
  try {
    const client = await getTemporalClient();
    const handle = client.getHandle(req.params.id);
    const state = await (handle as any).query((coreWorkflowPkg as any).approvalStateQuery);
    return res.json({ workflowId: req.params.id, state });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch approval state', details: error?.message ?? String(error) });
  }
});

workflowsRouter.post('/:id/approval', async (req, res) => {
  const parsed = WorkflowApprovalRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
  }

  try {
    const client = await getTemporalClient();
    const handle = client.getHandle(req.params.id);
    await (handle as any).signal((coreWorkflowPkg as any).approvalSignal, {
      decision: parsed.data.decision,
      approverId: parsed.data.approverId ?? 'console-user',
      approverName: parsed.data.approverName,
      approverRoles: parsed.data.approverRoles ?? [],
      reason: parsed.data.reason,
      timestamp: new Date().toISOString(),
      source: 'console',
    });
    return res.json({ ok: true, workflowId: req.params.id, decision: parsed.data.decision });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to signal approval', details: error?.message ?? String(error) });
  }
});

// Cancel (terminate) a running workflow. Phase 4.3.3 chat-driven monitoring.
workflowsRouter.post('/:id/cancel', async (req, res) => {
  try {
    const client = await getTemporalClient();
    const handle = client.getHandle(req.params.id);
    await handle.terminate();
    return res.json({ ok: true, workflowId: req.params.id });
  } catch (error: any) {
    console.error('Failed to cancel workflow:', error);
    return res.status(500).json({
      error: 'Failed to cancel workflow',
      details: error?.message ?? String(error),
    });
  }
});

workflowsRouter.get('/:id/result', async (req, res) => {
  try {
    const client = await getTemporalClient();
    const handle = client.getHandle(req.params.id);
    const description = await handle.describe();
    const status = description.status.name;

    if (status !== 'COMPLETED') {
      // For FAILED workflows, `result()` will throw; return the error for display.
      if (status === 'FAILED') {
        try {
          await handle.result();
          // If it unexpectedly didn't throw, still treat as not completed.
        } catch (error: any) {
          return res.status(200).json({
            workflowId: description.workflowId,
            runId: description.runId,
            error: error?.message ?? String(error),
            status,
          });
        }
      }
      return res.status(409).json({ error: 'NOT_COMPLETED', status });
    }

    const result = await handle.result();
    return res.json({ workflowId: description.workflowId, runId: description.runId, result });
  } catch (error: any) {
    console.error('Failed to fetch workflow result:', error);
    return res.status(500).json({ error: 'Failed to fetch workflow result', details: error?.message ?? String(error) });
  }
});
