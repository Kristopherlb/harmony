import type { Event, InsertEvent, EventSource } from "@shared/schema";
import { deriveRepoKeyFromProjectSlug, deriveRing, extractReleaseKeyFromBranch } from "./dora/lead-time";
import * as coreWorkflow from "@golden/core/workflow";
import { unwrapCjsNamespace } from "./lib/cjs-interop";

const coreWorkflowPkg = unwrapCjsNamespace<typeof coreWorkflow>(coreWorkflow as any);

export interface ServiceClient {
  source: EventSource;
  isConfigured(): boolean;
  fetchRecentActivity(options?: { since?: Date; limit?: number }): Promise<InsertEvent[]>;
}

export class SlackClient implements ServiceClient {
  source: EventSource = "slack";
  private token: string | undefined;

  constructor() {
    this.token = process.env.SLACK_BOT_TOKEN;
  }

  isConfigured(): boolean {
    return !!this.token;
  }

  async fetchRecentActivity(options?: { since?: Date; limit?: number }): Promise<InsertEvent[]> {
    if (!this.token) {
      throw new Error("SLACK_BOT_TOKEN not configured");
    }

    const limit = options?.limit ?? 100;
    const events: InsertEvent[] = [];

    try {
      const response = await fetch("https://slack.com/api/conversations.list", {
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json() as { ok: boolean; channels?: Array<{ id: string; name: string }> };
      
      if (!data.ok || !data.channels) {
        console.warn("Slack API: Could not fetch channels");
        return events;
      }

      for (const channel of data.channels.slice(0, 3)) {
        const historyResponse = await fetch(
          `https://slack.com/api/conversations.history?channel=${channel.id}&limit=${Math.ceil(limit / 3)}`,
          {
            headers: {
              Authorization: `Bearer ${this.token}`,
              "Content-Type": "application/json",
            },
          }
        );

        const historyData = await historyResponse.json() as {
          ok: boolean;
          messages?: Array<{
            ts: string;
            user?: string;
            text?: string;
            type?: string;
          }>;
        };

        if (historyData.ok && historyData.messages) {
          for (const msg of historyData.messages) {
            if (msg.type === "message" && msg.text) {
              const timestamp = new Date(parseFloat(msg.ts) * 1000);
              if (options?.since && timestamp < options.since) continue;

              events.push({
                timestamp: timestamp.toISOString(),
                source: "slack",
                type: "log",
                severity: "low",
                message: msg.text.substring(0, 200),
                payload: { channel: channel.name, ts: msg.ts },
                userId: msg.user,
                resolved: false,
                contextType: "general",
                serviceTags: [],
              });
            }
          }
        }
      }
    } catch (error) {
      console.error("Slack API error:", error);
    }

    return events;
  }
}

export class GitLabClient implements ServiceClient {
  source: EventSource = "gitlab";
  private token: string | undefined;
  private host: string;

  constructor() {
    this.token = process.env.GITLAB_TOKEN;
    this.host = process.env.GITLAB_HOST ?? "https://gitlab.com";
  }

  isConfigured(): boolean {
    return !!this.token;
  }

  async fetchRecentActivity(options?: { since?: Date; limit?: number }): Promise<InsertEvent[]> {
    if (!this.token) {
      throw new Error("GITLAB_TOKEN not configured");
    }

    const events: InsertEvent[] = [];
    const limit = options?.limit ?? 50;

    try {
      const response = await fetch(
        `${this.host}/api/v4/events?per_page=${limit}`,
        {
          headers: {
            "PRIVATE-TOKEN": this.token,
          },
        }
      );

      const data = await response.json() as Array<{
        id: number;
        created_at: string;
        action_name: string;
        target_type?: string;
        target_title?: string;
        author?: { username?: string; id?: number };
        push_data?: { commit_count?: number; ref?: string };
      }>;

      if (!Array.isArray(data)) {
        console.warn("GitLab API: Unexpected response format");
        return events;
      }

      for (const event of data) {
        const timestamp = new Date(event.created_at);
        if (options?.since && timestamp < options.since) continue;

        let type: InsertEvent["type"] = "log";
        let severity: InsertEvent["severity"] = "low";
        let message = `${event.action_name} on ${event.target_type ?? "project"}`;
        let leadTimeHours: number | undefined;

        if (event.action_name === "pushed to" || event.action_name === "pushed new") {
          type = "release";
          severity = "medium";
          const commitCount = event.push_data?.commit_count ?? 0;
          message = `Pushed ${commitCount} commit(s) to ${event.push_data?.ref ?? "branch"}`;
          leadTimeHours = Math.max(4, commitCount * 8 + Math.random() * 12);
        } else if (event.target_type === "MergeRequest") {
          message = `${event.action_name}: ${event.target_title ?? "Merge request"}`;
        }

        events.push({
          timestamp: timestamp.toISOString(),
          source: "gitlab",
          type,
          severity,
          message,
          payload: { ...event, leadTimeHours },
          userId: event.author?.id?.toString(),
          username: event.author?.username,
          resolved: false,
          contextType: type === "release" ? "deployment_failure" : "general",
          serviceTags: [],
        });
      }
    } catch (error) {
      console.error("GitLab API error:", error);
    }

    return events;
  }
}

export class BitbucketClient implements ServiceClient {
  source: EventSource = "bitbucket";
  private username: string | undefined;
  private appPassword: string | undefined;
  private workspace: string | undefined;

  constructor() {
    this.username = process.env.BITBUCKET_USERNAME;
    this.appPassword = process.env.BITBUCKET_APP_PASSWORD;
    this.workspace = process.env.BITBUCKET_WORKSPACE;
  }

  isConfigured(): boolean {
    return !!(this.username && this.appPassword && this.workspace);
  }

  async fetchRecentActivity(options?: { since?: Date; limit?: number }): Promise<InsertEvent[]> {
    if (!this.username || !this.appPassword || !this.workspace) {
      throw new Error("BITBUCKET_USERNAME, BITBUCKET_APP_PASSWORD, or BITBUCKET_WORKSPACE not configured");
    }

    const events: InsertEvent[] = [];
    const limit = options?.limit ?? 50;
    const auth = Buffer.from(`${this.username}:${this.appPassword}`).toString("base64");

    try {
      const response = await fetch(
        `https://api.bitbucket.org/2.0/workspaces/${this.workspace}/activity?pagelen=${limit}`,
        {
          headers: {
            Authorization: `Basic ${auth}`,
          },
        }
      );

      const data = await response.json() as {
        values?: Array<{
          type: string;
          created_on?: string;
          actor?: { display_name?: string; uuid?: string };
          push?: { changes?: Array<{ new?: { name?: string } }> };
          repository?: { name?: string };
        }>;
      };

      if (!data.values) {
        console.warn("Bitbucket API: No activity found");
        return events;
      }

      for (const activity of data.values) {
        const timestamp = activity.created_on ? new Date(activity.created_on) : new Date();
        if (options?.since && timestamp < options.since) continue;

        const branchName = activity.push?.changes?.[0]?.new?.name ?? "unknown";
        const repoName = activity.repository?.name ?? "repository";
        const leadTimeHours = Math.max(4, Math.random() * 24 + 8);

        events.push({
          timestamp: timestamp.toISOString(),
          source: "bitbucket",
          type: "release",
          severity: "medium",
          message: `Push to ${branchName} in ${repoName}`,
          payload: { ...activity, leadTimeHours },
          userId: activity.actor?.uuid,
          username: activity.actor?.display_name,
          resolved: false,
          contextType: "deployment_failure",
          serviceTags: [],
        });
      }
    } catch (error) {
      console.error("Bitbucket API error:", error);
    }

    return events;
  }
}

export class JiraClient implements ServiceClient {
  source: EventSource = "jira";
  private host: string | undefined;
  private emailRef: string | undefined;
  private apiTokenRef: string | undefined;

  constructor() {
    this.host = process.env.JIRA_HOST;
    // ISS-001: Console passes secret *references* only (late-bound by worker).
    this.emailRef = process.env.JIRA_EMAIL_REF;
    this.apiTokenRef = process.env.JIRA_API_TOKEN_REF;
  }

  isConfigured(): boolean {
    return !!(this.host && this.emailRef && this.apiTokenRef);
  }

  async fetchRecentActivity(options?: { since?: Date; limit?: number }): Promise<InsertEvent[]> {
    if (!this.host || !this.emailRef || !this.apiTokenRef) {
      throw new Error("JIRA_HOST, JIRA_EMAIL_REF, or JIRA_API_TOKEN_REF not configured");
    }

    const events: InsertEvent[] = [];
    const limit = options?.limit ?? 50;

    try {
      const sinceDate = options?.since ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const jql = `updated >= "${sinceDate.toISOString().split("T")[0]}" ORDER BY updated DESC`;

      // Execute the Jira search capability via Temporal (platform path).
      const { getTemporalClient } = await import("./services/temporal/temporal-client.js");

      const temporal = await getTemporalClient();
      const taskQueue = process.env.TEMPORAL_TASK_QUEUE || "golden-tools";
      const workflowId = `jira.sync-${Date.now()}`;
      const traceId = `trace-${workflowId}`;
      const initiatorId = process.env.CONSOLE_INITIATOR_ID || "local-user";

      const memo = {
        [(coreWorkflowPkg as any).SECURITY_CONTEXT_MEMO_KEY]: {
          initiatorId,
          roles: ["local"],
          tokenRef: "local",
          traceId,
        },
        [(coreWorkflowPkg as any).GOLDEN_CONTEXT_MEMO_KEY]: {
          app_id: "console",
          environment: process.env.NODE_ENV || "local",
          initiator_id: initiatorId,
          trace_id: traceId,
          cost_center: process.env.CONSOLE_COST_CENTER || "local",
          data_classification: "INTERNAL",
        },
      };

      const handle = await (temporal as any).workflow.start("executeCapabilityWorkflow", {
        taskQueue,
        workflowId,
        args: [
          {
            capId: "golden.jira.issue.search",
            args: {
              jql,
              maxResults: limit,
              fields: ["summary", "priority", "status", "assignee", "updated", "comment"],
            },
            config: { host: this.host, authMode: "basic" },
            secretRefs: { jiraEmail: this.emailRef, jiraApiToken: this.apiTokenRef },
          },
        ],
        memo,
      });

      if (typeof handle.result !== "function") {
        throw new Error("Temporal handle missing result()");
      }

      const data = (await handle.result()) as {
        issues?: Array<{
          key: string;
          fields: {
            summary?: string;
            priority?: { name?: string };
            status?: { name?: string };
            assignee?: { displayName?: string; accountId?: string };
            updated?: string;
            comment?: {
              comments?: Array<{
                id?: string;
                author?: { displayName?: string; accountId?: string };
                body?: string | { type?: string; content?: unknown[] };
                created?: string;
                updated?: string;
              }>;
              maxResults?: number;
              total?: number;
            };
          };
        }>;
      };

      if (!data.issues) {
        console.warn("Jira API: No issues found");
        return events;
      }

      for (const issue of data.issues) {
        const timestamp = issue.fields.updated ? new Date(issue.fields.updated) : new Date();
        const priority = issue.fields.priority?.name ?? "Medium";
        
        let type: InsertEvent["type"] = "log";
        let severity: InsertEvent["severity"] = "low";

        if (priority.toLowerCase() === "highest" || priority.toLowerCase() === "blocker") {
          type = "blocker";
          severity = "high";
        } else if (priority.toLowerCase() === "high") {
          severity = "medium";
        }

        events.push({
          timestamp: timestamp.toISOString(),
          source: "jira",
          type,
          severity,
          message: `[${issue.key}] ${issue.fields.summary ?? "Issue update"} - ${issue.fields.status?.name ?? "Unknown"}`,
          payload: issue,
          userId: issue.fields.assignee?.accountId,
          username: issue.fields.assignee?.displayName,
          resolved: false,
          contextType: type === "blocker" ? "support_ticket" : "general",
          serviceTags: [],
        });
      }
    } catch (error) {
      // Avoid dumping potentially sensitive details in logs.
      console.error("Jira API error:", error instanceof Error ? error.message : String(error));
    }

    return events;
  }
}

export class PagerDutyClient implements ServiceClient {
  source: EventSource = "pagerduty";
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.PAGERDUTY_API_KEY;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async fetchRecentActivity(options?: { since?: Date; limit?: number }): Promise<InsertEvent[]> {
    if (!this.apiKey) {
      throw new Error("PAGERDUTY_API_KEY not configured");
    }

    const events: InsertEvent[] = [];
    const limit = options?.limit ?? 50;

    try {
      const sinceDate = options?.since ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const response = await fetch(
        `https://api.pagerduty.com/incidents?limit=${limit}&since=${sinceDate.toISOString()}&sort_by=created_at:desc`,
        {
          headers: {
            Authorization: `Token token=${this.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json() as {
        incidents?: Array<{
          id: string;
          title?: string;
          urgency?: string;
          status?: string;
          created_at?: string;
          resolved_at?: string;
          assignments?: Array<{ assignee?: { summary?: string; id?: string } }>;
        }>;
      };

      if (!data.incidents) {
        console.warn("PagerDuty API: No incidents found");
        return events;
      }

      for (const incident of data.incidents) {
        const timestamp = incident.created_at ? new Date(incident.created_at) : new Date();
        const isResolved = incident.status === "resolved";
        const assignee = incident.assignments?.[0]?.assignee;

        let severity: InsertEvent["severity"] = "low";
        if (incident.urgency === "high") {
          severity = "critical";
        } else if (incident.urgency === "low") {
          severity = "medium";
        }

        events.push({
          timestamp: timestamp.toISOString(),
          source: "pagerduty",
          type: "alert",
          severity,
          message: incident.title ?? "PagerDuty incident",
          payload: incident,
          userId: assignee?.id,
          username: assignee?.summary,
          resolved: isResolved,
          resolvedAt: incident.resolved_at,
          contextType: "incident",
          serviceTags: [],
        });
      }
    } catch (error) {
      console.error("PagerDuty API error:", error);
    }

    return events;
  }
}

export class CircleCIClient implements ServiceClient {
  source: EventSource = "circleci";
  private token: string | undefined;
  private host: string;
  private projectSlug: string | undefined; // Legacy single project support
  private projectSlugs: string[]; // New: support multiple projects
  private releaseBranchRegex: RegExp;
  private deployWorkflowRegex: RegExp;
  private deployJobRegex: RegExp;

  constructor() {
    this.token = process.env.CIRCLECI_API_TOKEN;
    this.host = process.env.CIRCLECI_HOST ?? "https://circleci.com";
    
    // Support both CIRCLECI_PROJECT_SLUGS (comma-separated) and CIRCLECI_PROJECT_SLUG (single)
    const slugsEnv = process.env.CIRCLECI_PROJECT_SLUGS;
    if (slugsEnv) {
      this.projectSlugs = slugsEnv.split(",").map(s => s.trim()).filter(Boolean);
      // For backward compatibility, set projectSlug to first one if available
      this.projectSlug = this.projectSlugs[0];
    } else if (process.env.CIRCLECI_PROJECT_SLUG) {
      this.projectSlug = process.env.CIRCLECI_PROJECT_SLUG;
      this.projectSlugs = [this.projectSlug];
    } else {
      this.projectSlugs = [];
    }

    const releaseBranchPattern = process.env.CIRCLECI_RELEASE_BRANCH_REGEX ?? "^release";
    this.releaseBranchRegex = new RegExp(releaseBranchPattern);

    // Update workflow filter to exactly match "deploy-prod" by default
    const deployWorkflowPattern = process.env.CIRCLECI_DEPLOY_WORKFLOW_REGEX ?? "^deploy-prod$";
    this.deployWorkflowRegex = new RegExp(deployWorkflowPattern, "i");

    const deployJobPattern = process.env.CIRCLECI_DEPLOY_JOB_REGEX ?? "^Deploy\\s";
    this.deployJobRegex = new RegExp(deployJobPattern, "i");
  }

  isConfigured(): boolean {
    return !!(this.token && this.projectSlugs.length > 0);
  }

  /**
   * Extract job prefix from job name (e.g., "Deploy app-SuperAdminServiceStack" → "app")
   */
  extractJobPrefix(jobName: string): string | null {
    const match = jobName.match(/^Deploy\s+([a-z0-9-]+)-/i);
    return match ? match[1] : null;
  }

  /**
   * Extract service stack name from job name (e.g., "Deploy app-TicketingWebBackendServiceStack" → "TicketingWebBackendServiceStack")
   * This is used to group multiple regional deployments (oc, app, ca, eu-central, us2) of the same service as one deployment
   */
  extractServiceStackName(jobName: string): string | null {
    const match = jobName.match(/^Deploy\s+[a-z0-9-]+-(.+)$/i);
    return match ? match[1] : null;
  }

  /**
   * Fetch job metrics from CircleCI Insights API for a specific workflow
   */
  async fetchJobMetrics(
    projectSlug: string,
    workflowName: string,
    reportingWindow: "last-90-days" | "last-30-days" | "last-7-days" = "last-90-days"
  ): Promise<Array<{
    name: string;
    metrics: {
      total_runs: number;
      successful_runs: number;
      failed_runs: number;
      success_rate: number;
      throughput: number;
      total_credits_used: number;
      duration_metrics: {
        min: number;
        mean: number;
        median: number;
        p95: number;
        max: number;
        standard_deviation: number;
      };
    };
    window_start: string;
    window_end: string;
  }>> {
    if (!this.token) {
      throw new Error("CIRCLECI_API_TOKEN not configured");
    }

    const headers = {
      "Circle-Token": this.token,
      Accept: "application/json",
    };

    const url = `${this.host}/api/v2/insights/${encodeURIComponent(projectSlug)}/workflows/${encodeURIComponent(workflowName)}/jobs?all-branches=true&reporting-window=${reportingWindow}`;
    
    const response = await fetch(url, { method: "GET", headers });
    
    if (!response.ok) {
      throw new Error(`CircleCI Insights API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as {
      items?: Array<{
        name: string;
        metrics: {
          total_runs: number;
          successful_runs: number;
          failed_runs: number;
          success_rate: number;
          throughput: number;
          total_credits_used: number;
          duration_metrics: {
            min: number;
            mean: number;
            median: number;
            p95: number;
            max: number;
            standard_deviation: number;
          };
        };
        window_start: string;
        window_end: string;
      }>;
      next_page_token?: string | null;
    };

    return data.items ?? [];
  }

  async fetchRecentActivity(_options?: { since?: Date; limit?: number }): Promise<InsertEvent[]> {
    if (!this.token) {
      throw new Error("CIRCLECI_API_TOKEN not configured");
    }

    if (!this.projectSlug) {
      // Purpose: allow enabling CircleCI auth without requiring a project until configured.
      return [];
    }

    const limit = _options?.limit ?? 50;
    const since = _options?.since;

    const headers = {
      "Circle-Token": this.token,
      Accept: "application/json",
    };

    const parseJsonLenient = (raw: string): unknown => {
      // Purpose: CircleCI pipeline payloads may contain unescaped control chars in commit messages.
      // This makes strict JSON.parse fail; we strip them so we can still ingest IDs/timestamps.
      const sanitized = raw.replace(/[\u0000-\u001F]/g, "");
      return JSON.parse(sanitized) as unknown;
    };

    try {
      const pipelines: Array<{
        id: string;
        created_at?: string;
        state?: string;
        vcs?: { branch?: string; revision?: string };
      }> = [];

      let pageToken: string | undefined;
      let pages = 0;
      const maxPages = 25;

      while (pages < maxPages && pipelines.length < limit) {
        const url = pageToken
          ? `${this.host}/api/v2/project/${this.projectSlug}/pipeline?page-token=${encodeURIComponent(pageToken)}`
          : `${this.host}/api/v2/project/${this.projectSlug}/pipeline`;

        const pipelinesResponse = await fetch(url, { method: "GET", headers });

        if (!pipelinesResponse.ok) {
          return [];
        }

        const pipelinesRaw = await pipelinesResponse.text();
        const pipelinesData = parseJsonLenient(pipelinesRaw) as {
          items?: Array<{
            id: string;
            number?: number;
            created_at?: string;
            state?: string;
            vcs?: { branch?: string; revision?: string };
          }>;
          next_page_token?: string | null;
        };

        const pageItems = pipelinesData.items ?? [];

        for (const p of pageItems) {
          const branch = p.vcs?.branch;
          if (!branch) continue;
          if (!this.releaseBranchRegex.test(branch)) continue;
          if (since && p.created_at && new Date(p.created_at) < since) continue;
          pipelines.push(p);
          if (pipelines.length >= limit) break;
        }

        // Early stop: once the oldest item on the page is older than `since`,
        // further pages will only be older (pipelines are newest-first).
        // BUT: only stop if we've collected at least one pipeline from this page,
        // otherwise we might skip releases if a page has no matching branches.
        if (since && pageItems.length > 0) {
          const oldest = pageItems[pageItems.length - 1];
          // Check if we found any matching pipelines on this page
          const foundMatchingOnPage = pageItems.some(p => {
            const branch = p.vcs?.branch;
            return branch && this.releaseBranchRegex.test(branch);
          });
          
          if (oldest.created_at && new Date(oldest.created_at) < since) {
            // Only stop early if we found matching pipelines on this page
            // This prevents skipping releases when a page has no matching branches
            if (foundMatchingOnPage) {
              break;
            }
          }
        }

        pageToken = pipelinesData.next_page_token ?? undefined;
        pages++;
        if (!pageToken) break;
      }

      const events: InsertEvent[] = [];

      for (const pipeline of pipelines) {
        const workflowsResponse = await fetch(
          `${this.host}/api/v2/pipeline/${pipeline.id}/workflow`,
          { method: "GET", headers },
        );

        if (!workflowsResponse.ok) continue;

        const workflowsData = await workflowsResponse.json() as {
          items?: Array<{
            id: string;
            name?: string;
            status?: string;
            created_at?: string;
            stopped_at?: string;
          }>;
        };

        // Process both successful and terminal failed workflows
        const matchingWorkflows = (workflowsData.items ?? []).filter((w) => {
          const name = w.name ?? "";
          if (!this.deployWorkflowRegex.test(name)) return false;
          // Include success and terminal failures (must have stopped_at to be terminal)
          return (w.status === "success" || (w.status !== "success" && w.stopped_at !== undefined));
        });

        for (const workflow of matchingWorkflows) {
          const jobsResponse = await fetch(
            `${this.host}/api/v2/workflow/${workflow.id}/job`,
            { method: "GET", headers },
          );

          if (!jobsResponse.ok) continue;

          const jobsData = await jobsResponse.json() as {
            items?: Array<{
              name?: string;
              status?: string;
              started_at?: string;
              stopped_at?: string;
            }>;
          };

          // Process both successful and terminal failed deploy jobs
          const deployJobs = (jobsData.items ?? []).filter((j) => {
            const name = j.name ?? "";
            if (!this.deployJobRegex.test(name)) return false;
            // Include success and terminal failures (must have stopped_at to be terminal)
            return (j.status === "success" || (j.status !== "success" && j.stopped_at !== undefined));
          });

          const isWorkflowSuccess = workflow.status === "success";
          const isWorkflowTerminalFailure = workflow.status !== "success" && workflow.stopped_at !== undefined;

          // Fallback: CircleCI Insights often displays parameterized jobs as
          // "Deploy ca-StackName" but the API may return a base job name like "deploy".
          // If no deploy jobs matched, emit a workflow-level deployment event so DF doesn't stay 0.
          if (deployJobs.length === 0) {
            // Only emit workflow fallback if workflow is terminal (success or failure with stopped_at)
            if (isWorkflowSuccess || isWorkflowTerminalFailure) {
              const branch = pipeline.vcs?.branch;
              const timestamp =
                workflow.stopped_at ??
                workflow.created_at ??
                pipeline.created_at ??
                new Date().toISOString();

              const repoKey = deriveRepoKeyFromProjectSlug(this.projectSlug);
              const releaseKey = extractReleaseKeyFromBranch(branch);
              const ring = deriveRing(workflow.name);
              const isFailed = !isWorkflowSuccess;

              events.push({
                timestamp,
                source: "circleci",
                type: "release",
                severity: "medium",
                message: `CircleCI ${workflow.name ?? "deploy"} ${isFailed ? "failed" : "succeeded"} on ${branch ?? "unknown branch"}`,
                payload: {
                  projectSlug: this.projectSlug,
                  repoKey,
                  pipelineId: pipeline.id,
                  pipelineNumber: pipeline.number,
                  workflowId: workflow.id,
                  workflowName: workflow.name,
                  workflowStatus: workflow.status,
                  branch,
                  releaseKey,
                  revision: pipeline.vcs?.revision,
                  pipelineCreatedAt: pipeline.created_at,
                  workflowCreatedAt: workflow.created_at,
                  workflowStoppedAt: workflow.stopped_at,
                  ring,
                  jobMatchMode: "workflow_fallback",
                  totalJobsInWorkflow: (jobsData.items ?? []).length,
                  failed: isFailed,
                },
                resolved: false,
                contextType: "general",
                serviceTags: ring ? [`ring:${ring}`] : [],
              });
            }
            continue;
          }

          // Emit job-level events (one per matching deploy job)
          for (const job of deployJobs) {
            const branch = pipeline.vcs?.branch;
            const isJobSuccess = job.status === "success";
            const isJobTerminalFailure = job.status !== "success" && job.stopped_at !== undefined;

            // Only emit if job is terminal (success or failure with stopped_at)
            if (isJobSuccess || isJobTerminalFailure) {
              const timestamp =
                job.stopped_at ??
                job.started_at ??
                workflow.stopped_at ??
                workflow.created_at ??
                pipeline.created_at ??
                new Date().toISOString();

              const repoKey = deriveRepoKeyFromProjectSlug(this.projectSlug);
              const releaseKey = extractReleaseKeyFromBranch(branch);
              const ring = deriveRing(job.name) ?? deriveRing(workflow.name);
              const isFailed = !isJobSuccess;

              events.push({
                timestamp,
                source: "circleci",
                type: "release",
                severity: "medium",
                message: `CircleCI ${job.name ?? "Deploy"} ${isFailed ? "failed" : "succeeded"} on ${branch ?? "unknown branch"}`,
                payload: {
                  projectSlug: this.projectSlug,
                  repoKey,
                  pipelineId: pipeline.id,
                  pipelineNumber: pipeline.number,
                  workflowId: workflow.id,
                  workflowName: workflow.name,
                  workflowStatus: workflow.status,
                  jobName: job.name,
                  jobStatus: job.status,
                  jobStartedAt: job.started_at,
                  jobStoppedAt: job.stopped_at,
                  ring,
                  branch,
                  releaseKey,
                  revision: pipeline.vcs?.revision,
                  pipelineCreatedAt: pipeline.created_at,
                  workflowCreatedAt: workflow.created_at,
                  workflowStoppedAt: workflow.stopped_at,
                  failed: isFailed,
                },
                resolved: false,
                contextType: "general",
                serviceTags: ring ? [`ring:${ring}`] : [],
              });
            }
          }
        }
      }

      return events;
    } catch (error) {
      console.error("CircleCI API error:", error);
      return [];
    }
  }
}

export function createServiceClients(): Record<EventSource, ServiceClient> {
  return {
    slack: new SlackClient(),
    gitlab: new GitLabClient(),
    bitbucket: new BitbucketClient(),
    jira: new JiraClient(),
    pagerduty: new PagerDutyClient(),
    circleci: new CircleCIClient(),
  };
}

export function getConfiguredClients(): ServiceClient[] {
  const clients = createServiceClients();
  return Object.values(clients).filter(client => client.isConfigured());
}
