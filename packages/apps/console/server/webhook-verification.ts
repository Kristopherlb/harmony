import { createHmac, timingSafeEqual } from "crypto";
import type { Request, Response, NextFunction } from "express";

export interface WebhookVerificationConfig {
  slack?: string;
  gitlab?: string;
  bitbucket?: string;
  jira?: string;
  pagerduty?: string;
  circleci?: string;
}

function loadConfig(): WebhookVerificationConfig {
  return {
    slack: process.env.SLACK_SIGNING_SECRET,
    gitlab: process.env.GITLAB_WEBHOOK_SECRET,
    bitbucket: process.env.BITBUCKET_WEBHOOK_SECRET,
    jira: process.env.JIRA_WEBHOOK_SECRET,
    pagerduty: process.env.PAGERDUTY_WEBHOOK_SECRET,
    circleci: process.env.CIRCLECI_WEBHOOK_SECRET,
  };
}

export function verifySlackSignature(
  signingSecret: string,
  signature: string,
  timestamp: string,
  body: string
): boolean {
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
  if (parseInt(timestamp) < fiveMinutesAgo) {
    return false;
  }

  const sigBasestring = `v0:${timestamp}:${body}`;
  const mySignature = "v0=" + createHmac("sha256", signingSecret)
    .update(sigBasestring)
    .digest("hex");

  try {
    return timingSafeEqual(Buffer.from(mySignature), Buffer.from(signature));
  } catch {
    return false;
  }
}

export function verifyGitLabSignature(
  secret: string,
  token: string
): boolean {
  try {
    return timingSafeEqual(Buffer.from(secret), Buffer.from(token));
  } catch {
    return false;
  }
}

export function verifyHmacSignature(
  secret: string,
  signature: string,
  body: string,
  algorithm: "sha256" | "sha1" = "sha256"
): boolean {
  const expectedSignature = createHmac(algorithm, secret)
    .update(body)
    .digest("hex");

  const providedSig = signature.replace(/^sha256=|^sha1=/, "");

  try {
    return timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(providedSig));
  } catch {
    return false;
  }
}

export function createWebhookVerificationMiddleware(source: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const config = loadConfig();
    // Use raw body if available (set by express.json verify option), otherwise stringify
    const rawBodyBuffer = (req as any).rawBody;
    const rawBody = rawBodyBuffer instanceof Buffer ? rawBodyBuffer.toString("utf8") : JSON.stringify(req.body);

    switch (source) {
      case "slack": {
        const secret = config.slack;
        if (!secret) {
          console.warn("SLACK_SIGNING_SECRET not configured, skipping verification");
          return next();
        }

        const signature = req.headers["x-slack-signature"] as string;
        const timestamp = req.headers["x-slack-request-timestamp"] as string;

        if (!signature || !timestamp) {
          return res.status(401).json({ error: "Missing Slack signature headers" });
        }

        if (!verifySlackSignature(secret, signature, timestamp, rawBody)) {
          return res.status(401).json({ error: "Invalid Slack signature" });
        }
        break;
      }

      case "gitlab": {
        const secret = config.gitlab;
        if (!secret) {
          console.warn("GITLAB_WEBHOOK_SECRET not configured, skipping verification");
          return next();
        }

        const token = req.headers["x-gitlab-token"] as string;
        if (!token) {
          return res.status(401).json({ error: "Missing GitLab token header" });
        }

        if (!verifyGitLabSignature(secret, token)) {
          return res.status(401).json({ error: "Invalid GitLab token" });
        }
        break;
      }

      case "bitbucket": {
        const secret = config.bitbucket;
        if (!secret) {
          console.warn("BITBUCKET_WEBHOOK_SECRET not configured, skipping verification");
          return next();
        }

        const signature = req.headers["x-hub-signature"] as string;
        if (!signature) {
          return res.status(401).json({ error: "Missing Bitbucket signature header" });
        }

        if (!verifyHmacSignature(secret, signature, rawBody, "sha256")) {
          return res.status(401).json({ error: "Invalid Bitbucket signature" });
        }
        break;
      }

      case "jira": {
        const secret = config.jira;
        if (!secret) {
          console.warn("JIRA_WEBHOOK_SECRET not configured, skipping verification");
          return next();
        }

        const signature = req.headers["x-hub-signature"] as string;
        if (!signature) {
          return res.status(401).json({ error: "Missing Jira signature header" });
        }

        if (!verifyHmacSignature(secret, signature, rawBody, "sha256")) {
          return res.status(401).json({ error: "Invalid Jira signature" });
        }
        break;
      }

      case "pagerduty": {
        const secret = config.pagerduty;
        if (!secret) {
          console.warn("PAGERDUTY_WEBHOOK_SECRET not configured, skipping verification");
          return next();
        }

        const signatures = req.headers["x-pagerduty-signature"] as string;
        if (!signatures) {
          return res.status(401).json({ error: "Missing PagerDuty signature header" });
        }

        const signatureList = signatures.split(",");
        const v1Sig = signatureList.find(s => s.startsWith("v1="));
        
        if (!v1Sig) {
          return res.status(401).json({ error: "No v1 PagerDuty signature found" });
        }

        if (!verifyHmacSignature(secret, v1Sig.substring(3), rawBody, "sha256")) {
          return res.status(401).json({ error: "Invalid PagerDuty signature" });
        }
        break;
      }

      case "circleci": {
        // CircleCI webhooks can optionally use signature verification
        // If CIRCLECI_WEBHOOK_SECRET is configured, verify the signature
        const secret = config.circleci;
        if (!secret) {
          console.warn("CIRCLECI_WEBHOOK_SECRET not configured, skipping verification");
          return next();
        }

        // CircleCI uses X-Circleci-Signature header with HMAC-SHA256
        const signature = req.headers["x-circleci-signature"] as string;
        if (!signature) {
          return res.status(401).json({ error: "Missing CircleCI signature header" });
        }

        if (!verifyHmacSignature(secret, signature, rawBody, "sha256")) {
          return res.status(401).json({ error: "Invalid CircleCI signature" });
        }
        break;
      }

      default:
        return res.status(400).json({ error: `Unknown source: ${source}` });
    }

    next();
  };
}

export function getVerificationStatus(): Record<string, boolean> {
  const config = loadConfig();
  return {
    slack: !!config.slack,
    gitlab: !!config.gitlab,
    bitbucket: !!config.bitbucket,
    jira: !!config.jira,
    pagerduty: !!config.pagerduty,
    circleci: !!config.circleci,
  };
}
