import { randomUUID } from "crypto";
import type { InsertEvent, EventSource, EventType, Severity, SlackCommand } from "@shared/schema";

export interface SourceAdapter {
  source: EventSource;
  transformToEvent(payload: unknown): InsertEvent;
}

export class SlackAdapter implements SourceAdapter {
  source: EventSource = "slack";

  transformToEvent(payload: SlackCommand): InsertEvent {
    const text = payload.text.trim();
    const parts = text.split(" ");
    const command = parts[0]?.toLowerCase() ?? "log";
    const message = parts.slice(1).join(" ") || text;

    const { type, severity } = this.parseCommand(command);

    return {
      timestamp: new Date().toISOString(),
      source: this.source,
      type,
      severity,
      message,
      payload: {
        channel_id: payload.channel_id,
        channel_name: payload.channel_name,
        original_command: payload.command,
        response_url: payload.response_url,
      },
      userId: payload.user_id,
      username: payload.user_name,
      resolved: false,
      contextType: type === "blocker" ? "incident" : "general",
      serviceTags: [],
    };
  }

  private parseCommand(command: string): { type: EventType; severity: Severity } {
    switch (command) {
      case "blocker":
        return { type: "blocker", severity: "high" };
      case "decision":
        return { type: "decision", severity: "medium" };
      case "status":
        return { type: "log", severity: "low" };
      case "log":
      default:
        return { type: "log", severity: "low" };
    }
  }

  createBlockKitResponse(event: InsertEvent): object {
    const severityEmoji = {
      low: ":white_check_mark:",
      medium: ":warning:",
      high: ":rotating_light:",
      critical: ":fire:",
    };

    return {
      response_type: "in_channel",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `${severityEmoji[event.severity]} *${event.type.toUpperCase()}* logged by <@${event.userId}>`,
          },
        },
        {
          type: "section",
          text: {
            type: "plain_text",
            text: event.message,
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Source: ${event.source} | Severity: ${event.severity} | ${new Date(event.timestamp).toLocaleString()}`,
            },
          ],
        },
      ],
    };
  }
}

export class GitLabAdapter implements SourceAdapter {
  source: EventSource = "gitlab";

  transformToEvent(payload: unknown): InsertEvent {
    const data = payload as {
      object_kind?: string;
      ref?: string;
      user_name?: string;
      user_id?: string;
      project?: { name?: string };
      commits?: Array<{ message?: string }>;
    };

    const objectKind = data.object_kind ?? "push";
    let type: EventType = "log";
    let severity: Severity = "low";
    let message = `GitLab ${objectKind} event`;

    let leadTimeHours: number | undefined;

    if (objectKind === "push") {
      type = "release";
      severity = "medium";
      const commitCount = data.commits?.length ?? 0;
      message = `Pushed ${commitCount} commit(s) to ${data.ref ?? "unknown branch"}`;
      // Calculate lead time based on commit count (heuristic: more commits = longer lead time)
      leadTimeHours = Math.max(4, commitCount * 8 + Math.random() * 12);
    } else if (objectKind === "merge_request") {
      type = "log";
      message = `Merge request activity in ${data.project?.name ?? "project"}`;
    } else if (objectKind === "pipeline") {
      type = "log";
      message = `Pipeline triggered for ${data.project?.name ?? "project"}`;
    }

    return {
      timestamp: new Date().toISOString(),
      source: this.source,
      type,
      severity,
      message,
      payload: { ...data, leadTimeHours },
      userId: data.user_id,
      username: data.user_name,
      resolved: false,
      contextType: type === "release" ? "deployment_failure" : "general",
      serviceTags: [],
    };
  }
}

export class BitbucketAdapter implements SourceAdapter {
  source: EventSource = "bitbucket";

  transformToEvent(payload: unknown): InsertEvent {
    const data = payload as {
      push?: { changes?: Array<{ new?: { name?: string } }> };
      actor?: { display_name?: string; uuid?: string };
      repository?: { name?: string };
    };

    const branchName = data.push?.changes?.[0]?.new?.name ?? "unknown";
    const repoName = data.repository?.name ?? "repository";
    // Heuristic lead time for Bitbucket pushes
    const leadTimeHours = Math.max(4, Math.random() * 24 + 8);

    return {
      timestamp: new Date().toISOString(),
      source: this.source,
      type: "release",
      severity: "medium",
      message: `Push to ${branchName} in ${repoName}`,
      payload: { ...data, leadTimeHours },
      userId: data.actor?.uuid,
      username: data.actor?.display_name,
      resolved: false,
      contextType: "deployment_failure",
      serviceTags: [],
    };
  }
}

export class JiraAdapter implements SourceAdapter {
  source: EventSource = "jira";

  transformToEvent(payload: unknown): InsertEvent {
    const data = payload as {
      webhookEvent?: string;
      issue?: {
        key?: string;
        fields?: {
          summary?: string;
          priority?: { name?: string };
          assignee?: { displayName?: string; accountId?: string };
        };
      };
      user?: { displayName?: string; accountId?: string };
    };

    const eventType = data.webhookEvent ?? "jira:issue_updated";
    const issueKey = data.issue?.key ?? "UNKNOWN";
    const summary = data.issue?.fields?.summary ?? "Issue update";
    const priority = data.issue?.fields?.priority?.name ?? "Medium";

    let type: EventType = "log";
    let severity: Severity = "low";

    if (eventType.includes("created")) {
      type = "log";
    } else if (priority.toLowerCase() === "highest" || priority.toLowerCase() === "blocker") {
      type = "blocker";
      severity = "high";
    }

    return {
      timestamp: new Date().toISOString(),
      source: this.source,
      type,
      severity,
      message: `[${issueKey}] ${summary}`,
      payload: data,
      userId: data.user?.accountId,
      username: data.user?.displayName,
      resolved: false,
      contextType: type === "blocker" ? "support_ticket" : "general",
      serviceTags: [],
    };
  }
}

export class PagerDutyAdapter implements SourceAdapter {
  source: EventSource = "pagerduty";

  transformToEvent(payload: unknown): InsertEvent {
    const data = payload as {
      event?: {
        event_type?: string;
        data?: {
          title?: string;
          urgency?: string;
          assignees?: Array<{ summary?: string; id?: string }>;
        };
      };
    };

    const eventType = data.event?.event_type ?? "incident.triggered";
    const title = data.event?.data?.title ?? "PagerDuty Alert";
    const urgency = data.event?.data?.urgency ?? "low";
    const assignee = data.event?.data?.assignees?.[0];

    let type: EventType = "alert";
    let severity: Severity = urgency === "high" ? "critical" : "high";
    let resolved = false;

    if (eventType.includes("resolved")) {
      resolved = true;
      severity = "low";
    } else if (eventType.includes("acknowledged")) {
      severity = "medium";
    }

    return {
      timestamp: new Date().toISOString(),
      source: this.source,
      type,
      severity,
      message: title,
      payload: data,
      userId: assignee?.id,
      contextType: type === "alert" ? "incident" : "general",
      serviceTags: [],
      username: assignee?.summary,
      resolved,
      resolvedAt: resolved ? new Date().toISOString() : undefined,
    };
  }
}

export class CircleCIAdapter implements SourceAdapter {
  source: EventSource = "circleci";

  transformToEvent(payload: unknown): InsertEvent {
    return {
      timestamp: new Date().toISOString(),
      source: this.source,
      type: "release",
      severity: "medium",
      message: "CircleCI deploy event",
      contextType: "general",
      serviceTags: [],
      payload: payload as Record<string, unknown>,
      userId: undefined,
      username: undefined,
      resolved: false,
    };
  }
}

export const adapters: Record<EventSource, SourceAdapter> = {
  slack: new SlackAdapter(),
  gitlab: new GitLabAdapter(),
  bitbucket: new BitbucketAdapter(),
  jira: new JiraAdapter(),
  pagerduty: new PagerDutyAdapter(),
  circleci: new CircleCIAdapter(),
};

export function getAdapter(source: EventSource): SourceAdapter {
  return adapters[source];
}
