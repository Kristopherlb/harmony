// server/metrics/application/get-dora-metrics.ts
// Use case: Calculate DORA metrics from raw events

import type { DORAMetrics, Event } from "@shared/schema";
import type { EventRepositoryPort } from "../../events/application/ports";
import { normalizeCircleCiDeployEvents } from "../../dora/lead-time-join";

export interface GetDORAMetricsResponse {
  deploymentFrequency: number;
  leadTime: number;
  meanTimeToRecovery: number;
  changeFailureRate: number;
}

export class GetDORAMetrics {
  constructor(private eventRepository: EventRepositoryPort) {}

  async execute(): Promise<GetDORAMetricsResponse> {
    const { events } = await this.eventRepository.getEvents({ pageSize: 10000 });
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const recentEvents = events.filter((e) => new Date(e.timestamp) >= thirtyDaysAgo);
    
    // For deployment frequency: ONLY count CircleCI releases (exclude ansible_playbook_prod workflows)
    // Deployment frequency should NOT include GitLab, Slack, or any other sources
    const circleCiReleases = recentEvents.filter((e) => e.source === "circleci" && e.type === "release");
    
    const filteredReleases = circleCiReleases.filter((e) => {
      const payload = e.payload as { workflowName?: string | null } | undefined;
      const workflowName = (payload?.workflowName ?? "").toLowerCase();
      // Exclude ansible_playbook_prod from deployment frequency
      return !workflowName.includes("ansible_playbook_prod");
    });
    
    // Group deployments to count unique deployments, not individual jobs
    // Multiple jobs (different regions/stacks like "Deploy eu-central-..." and "Deploy app-...")
    // from the same release should count as 1 deployment
    const uniqueDeployments = new Map<string, Event>();
    
    for (const release of filteredReleases) {
      const payload = release.payload as {
        releaseKey?: string | null;
        revision?: string | null;
        branch?: string | null;
        repoKey?: string | null;
        pipelineId?: string | null;
        workflowId?: string | null;
      } | undefined;
      
      // Primary grouping: releaseKey|revision|branch
      // A deployment is defined by the release version, not the pipeline
      // All jobs (eu-central, app, oc, us2, ca) with the same releaseKey|revision|branch = ONE deployment
      let deploymentKey: string;
      
      if (payload?.releaseKey && payload?.revision && (payload?.branch || payload?.repoKey)) {
        const branch = payload.branch || payload.repoKey || "unknown";
        deploymentKey = `release:${payload.releaseKey}|${payload.revision}|${branch}`;
      } else if (payload?.pipelineId) {
        // Fallback to pipelineId if releaseKey|revision|branch missing
        deploymentKey = `pipeline:${payload.pipelineId}`;
      } else if (payload?.workflowId) {
        // Fallback to workflowId if both missing
        deploymentKey = `workflow:${payload.workflowId}`;
      } else {
        // Last resort: use event ID (shouldn't happen for valid CircleCI events)
        deploymentKey = `fallback:${release.id}`;
      }
      
      // Keep the earliest timestamp for this deployment
      const existing = uniqueDeployments.get(deploymentKey);
      if (!existing || new Date(release.timestamp) < new Date(existing.timestamp)) {
        uniqueDeployments.set(deploymentKey, release);
      }
    }
    
    // Convert back to array for compatibility
    const releasesForDF = Array.from(uniqueDeployments.values());
    
    const deploymentFrequency = releasesForDF.length / 30;

    // For lead time, use improved calculation if we have CircleCI events with proper structure
    // Otherwise fall back to simple calculation
    let leadTime = 0;
    const normalizedDeploys = normalizeCircleCiDeployEvents(recentEvents);
    
    if (normalizedDeploys.length > 0) {
      // Use improved lead time calculation
      // For now, use simple average until PR merge data is available
      // This can be enhanced later with PR merge tracking
      const leadTimes: number[] = [];
      for (const release of releasesForDF) {
        const payload = release.payload as { leadTimeHours?: number };
        if (payload.leadTimeHours) {
          leadTimes.push(payload.leadTimeHours);
        }
      }
      if (leadTimes.length > 0) {
        leadTime = leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length;
      }
    } else if (recentEvents.filter((e) => e.type === "release").length > 0) {
      // Fallback to simple calculation for non-CircleCI releases
      const allReleases = recentEvents.filter((e) => e.type === "release");
      leadTime = allReleases.reduce((sum, r) => {
        const payload = r.payload as { leadTimeHours?: number };
        return sum + (payload.leadTimeHours ?? 24);
      }, 0) / allReleases.length;
    }

    // MTTR: Mean Time To Recovery from blockers/alerts
    const blockers = events.filter((e) => e.type === "blocker" || (e.type === "alert" && e.severity === "critical"));
    const resolvedBlockers = blockers.filter((e) => e.resolved && e.resolvedAt);
    
    let meanTimeToRecovery = 0;
    if (resolvedBlockers.length > 0) {
      const recoveryTimes = resolvedBlockers.map((b) => {
        const created = new Date(b.timestamp).getTime();
        const resolved = new Date(b.resolvedAt!).getTime();
        return (resolved - created) / (1000 * 60 * 60);
      });
      meanTimeToRecovery = recoveryTimes.reduce((a, b) => a + b, 0) / recoveryTimes.length;
    }

    // Change Failure Rate: failed deployments / total deployments
    const failedReleases = releasesForDF.filter((r) => {
      const payload = r.payload as { failed?: boolean };
      return payload.failed === true;
    });
    const changeFailureRate = releasesForDF.length > 0 ? failedReleases.length / releasesForDF.length : 0;

    return {
      deploymentFrequency,
      leadTime,
      meanTimeToRecovery,
      changeFailureRate,
    };
  }
}
