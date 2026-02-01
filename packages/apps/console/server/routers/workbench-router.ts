import { Router } from "express";

type CreateSessionRequest = {
  provider: string;
  kind: string;
  mode: string;
};

type CreateSessionResponse = {
  sessionId: string;
  expiresAt: string;
  launchUrl?: string;
};

function safeUrlJoin(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

function readWorkbenchBaseUrl(): string {
  const v = (process.env.WORKBENCH_SERVER_URL ?? "").trim();
  if (v.length > 0) return v.replace(/\/+$/, "");
  return "http://127.0.0.1:8787";
}

export function createWorkbenchRouter() {
  const router = Router();

  router.get("/health", async (_req: any, res: any) => {
    const baseUrl = readWorkbenchBaseUrl();
    try {
      const url = `${baseUrl}/workbench/health`;
      const wbRes = await fetch(url, { method: "GET" });
      const text = await wbRes.text();
      return res.status(wbRes.status).send(text);
    } catch (error: any) {
      return res.status(502).json({
        error: "WORKBENCH_UNREACHABLE",
        target: baseUrl,
        details: String(error?.message ?? error),
      });
    }
  });

  router.post("/sessions", async (req: any, res: any) => {
    try {
      const input = (req.body ?? {}) as Partial<CreateSessionRequest>;
      if (!input.provider || !input.kind || !input.mode) {
        return res.status(400).json({ error: "INPUT_VALIDATION_FAILED" });
      }

      const origin = typeof req.headers.origin === "string" ? req.headers.origin : "";
      if (!origin) return res.status(400).json({ error: "MISSING_ORIGIN" });

      const baseUrl = readWorkbenchBaseUrl();
      const url = `${baseUrl}/workbench/sessions`;

      let wbRes: Response;
      try {
        wbRes = await fetch(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin,
            ...(typeof req.headers["x-dev-user"] === "string" ? { "x-dev-user": req.headers["x-dev-user"] } : {}),
            ...(typeof req.headers["x-dev-roles"] === "string" ? { "x-dev-roles": req.headers["x-dev-roles"] } : {}),
          },
          body: JSON.stringify({
            provider: input.provider,
            kind: input.kind,
            mode: input.mode,
          }),
        });
      } catch (error: any) {
        return res.status(502).json({
          error: "WORKBENCH_UNREACHABLE",
          target: url,
          details: String(error?.message ?? error),
          hint: "Start workbench-server (pnpm nx serve workbench-server) or set WORKBENCH_SERVER_URL.",
        });
      }

      const text = await wbRes.text();
      if (!wbRes.ok) {
        return res.status(wbRes.status).json({
          error: "WORKBENCH_ERROR",
          target: url,
          details: text || wbRes.statusText,
        });
      }

      const parsed = JSON.parse(text) as CreateSessionResponse;
      // workbench-server only includes launchUrl when configured with WORKBENCH_PUBLIC_BASE_URL.
      // For local/dev UX, we derive a launch URL from the configured server URL so the Console can
      // reliably open the playground in a new tab.
      if (!parsed.launchUrl && input.mode === "launch") {
        parsed.launchUrl = safeUrlJoin(
          baseUrl,
          `/workbench/launch/${encodeURIComponent(String(input.kind))}?sessionId=${encodeURIComponent(
            parsed.sessionId
          )}&provider=${encodeURIComponent(String(input.provider))}`
        );
      }
      return res.status(200).json(parsed);
    } catch (error: any) {
      return res.status(500).json({ error: "INTERNAL_ERROR", details: String(error?.message ?? error) });
    }
  });

  return router;
}

