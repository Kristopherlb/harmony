import { Router } from 'express';
import { z } from 'zod';
import { createBlueprintRegistry, getBlueprint } from '@golden/blueprints';
import {
  GOLDEN_CONTEXT_MEMO_KEY,
  SECURITY_CONTEXT_MEMO_KEY,
  type GoldenContext,
  type SecurityContext,
} from '@golden/core/workflow';
import { getTemporalClient } from '../services/temporal/temporal-client.js';

export const workflowsRouter = Router();

const RunBlueprintRequestSchema = z.object({
  blueprintId: z.string().min(1),
  input: z.unknown().optional(),
  workflowId: z.string().optional(),
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

// Start a registered blueprint workflow on the local Temporal dev stack.
// POST /api/workflows/run-blueprint
workflowsRouter.post('/run-blueprint', async (req, res) => {
  const parsed = RunBlueprintRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
  }

  try {
    const client = await getTemporalClient();
    const registry = createBlueprintRegistry();
    const bp = getBlueprint(registry, parsed.data.blueprintId);

    const taskQueue = process.env.TEMPORAL_TASK_QUEUE || 'golden-tools';
    const workflowId =
      parsed.data.workflowId || `${parsed.data.blueprintId}-${Date.now()}`;
    const traceId = `trace-${workflowId}`;

    // Minimal local dev contexts required by BaseBlueprint.executeById()
    const securityContext: SecurityContext = {
      initiatorId: 'local-user',
      roles: ['local'],
      tokenRef: 'local',
      traceId,
    };

    const goldenContext: GoldenContext = {
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
        [SECURITY_CONTEXT_MEMO_KEY]: securityContext,
        [GOLDEN_CONTEXT_MEMO_KEY]: goldenContext,
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
