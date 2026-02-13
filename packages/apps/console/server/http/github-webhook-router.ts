import { Router } from "express";
import { createHash } from "crypto";
import * as blueprints from "@golden/blueprints";
import * as core from "@golden/core";
import type { OpenBaoKvConfig } from "@golden/core";
import * as coreWorkflow from "@golden/core/workflow";
import type { GoldenContext, SecurityContext } from "@golden/core/workflow";
import { getTemporalClient } from "../services/temporal/temporal-client.js";
import { verifyHmacSignature } from "../webhook-verification";

export const githubWebhookRouter = Router();

function readEnv(name: string): string | undefined {
  const v = (process.env[name] ?? "").trim();
  return v.length > 0 ? v : undefined;
}

function isAlreadyStartedError(err: unknown): boolean {
  const e = err as any;
  const name = String(e?.name ?? "");
  const msg = String(e?.message ?? "");
  return name.includes("WorkflowExecutionAlreadyStarted") || msg.includes("WorkflowExecutionAlreadyStarted");
}

function computeRawBody(req: any): string {
  const rawBodyBuffer = req.rawBody;
  if (rawBodyBuffer instanceof Buffer) return rawBodyBuffer.toString("utf8");
  return JSON.stringify(req.body ?? {});
}

function nowIso(): string {
  return new Date().toISOString();
}

githubWebhookRouter.post("/", async (req, res) => {
  const deliveryId = String(req.headers["x-github-delivery"] ?? "");
  const eventType = String(req.headers["x-github-event"] ?? "");
  const signature = String(req.headers["x-hub-signature-256"] ?? "");

  if (!deliveryId || !eventType) {
    return res.status(400).json({ error: "MISSING_GITHUB_HEADERS" });
  }
  if (!signature) {
    return res.status(401).json({ error: "MISSING_SIGNATURE" });
  }

  const webhookSecretRef = readEnv("GITHUB_WEBHOOK_SECRET_REF");
  const tokenSecretRef = readEnv("GITHUB_TOKEN_SECRET_REF");
  if (!webhookSecretRef) return res.status(500).json({ error: "GITHUB_WEBHOOK_SECRET_REF_REQUIRED" });
  if (!tokenSecretRef) return res.status(500).json({ error: "GITHUB_TOKEN_SECRET_REF_REQUIRED" });

  const baoToken = readEnv("BAO_TOKEN") ?? readEnv("VAULT_TOKEN");
  const baoRoleId = readEnv("BAO_ROLE_ID");
  const baoSecretId = readEnv("BAO_SECRET_ID");

  const openBao: OpenBaoKvConfig = {
    address: readEnv("BAO_ADDR") ?? readEnv("VAULT_ADDR") ?? "http://localhost:8200",
    mount: readEnv("BAO_KV_MOUNT") ?? "secret",
    auth: baoToken
      ? { token: baoToken }
      : baoRoleId && baoSecretId
        ? { approle: { mount: readEnv("BAO_AUTH_MOUNT") ?? "approle", roleId: baoRoleId, secretId: baoSecretId } }
        : { token: "root" }, // local dev default
  };

  const rawBody = computeRawBody(req);

  let signingSecret: string;
  try {
    signingSecret = await core.readOpenBaoKvV2SecretValue({
      openBao,
      secretRef: webhookSecretRef,
    });
  } catch (err: any) {
    return res.status(500).json({ error: "GITHUB_WEBHOOK_SECRET_UNAVAILABLE", details: String(err?.message ?? err) });
  }

  if (!verifyHmacSignature(signingSecret, signature, rawBody, "sha256")) {
    return res.status(401).json({ error: "INVALID_SIGNATURE" });
  }

  const body = (req.body ?? {}) as any;
  const repoFullName = String(body?.repository?.full_name ?? "");
  if (!repoFullName) return res.status(400).json({ error: "MISSING_REPO_FULL_NAME" });

  const receivedAt = nowIso();
  const envelope = {
    deliveryId,
    eventType,
    action: typeof body?.action === "string" ? body.action : undefined,
    repoFullName,
    ref: typeof body?.ref === "string" ? body.ref : undefined,
    sha:
      typeof body?.after === "string"
        ? body.after
        : typeof body?.head_commit?.id === "string"
          ? body.head_commit.id
          : undefined,
    actor: typeof body?.sender?.login === "string" ? body.sender.login : undefined,
    receivedAt,
    githubTokenSecretRef: tokenSecretRef,
  };

  const workflowId = `release-${deliveryId}`;
  const blueprintId = readEnv("GITHUB_RELEASE_BLUEPRINT_ID") ?? "blueprints.ci.github-release";

  try {
    const client = await getTemporalClient();
    const registry = blueprints.createBlueprintRegistry();
    const bp = blueprints.getBlueprint(registry, blueprintId);
    const taskQueue = process.env.TEMPORAL_TASK_QUEUE || "golden-tools";
    const traceId = `trace-${workflowId}`;

    const securityContext: SecurityContext = {
      initiatorId: envelope.actor ?? "github-webhook",
      roles: ["ci:release"],
      tokenRef: "github",
      traceId,
    };

    const goldenContext: GoldenContext = {
      app_id: "console",
      environment: "local",
      initiator_id: securityContext.initiatorId,
      trace_id: traceId,
      cost_center: "local",
      data_classification: "INTERNAL",
    };

    const handle = await (client as any).start(bp.workflowType as any, {
      taskQueue,
      workflowId,
      args: [envelope],
      memo: {
        [coreWorkflow.SECURITY_CONTEXT_MEMO_KEY]: securityContext,
        [coreWorkflow.GOLDEN_CONTEXT_MEMO_KEY]: goldenContext,
      },
    });

    return res.json({
      workflowId: handle.workflowId,
      runId: handle.firstExecutionRunId,
      started: true,
      blueprintId,
      workflowType: bp.workflowType,
    });
  } catch (err: any) {
    if (isAlreadyStartedError(err)) {
      try {
        const client = await getTemporalClient();
        const desc = await client.getHandle(workflowId).describe();
        return res.json({ workflowId, runId: desc.runId, started: false });
      } catch {
        return res.json({ workflowId, started: false });
      }
    }

    // Avoid logging rawBody/signatures. Keep error surface small.
    const msg = String(err?.message ?? err);
    const hash = createHash("sha256").update(msg).digest("hex").slice(0, 12);
    return res.status(500).json({ error: "FAILED_TO_START_WORKFLOW", errorId: hash, details: msg });
  }
});

