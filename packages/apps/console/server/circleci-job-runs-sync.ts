import { createServiceClients } from "./clients";
import { createRepository } from "./storage";
import { log } from "./index";
import { extractReleaseKeyFromBranch } from "./dora/lead-time";

const DAILY_SYNC_HOUR = Number.parseInt(process.env.CIRCLECI_JOB_RUNS_SYNC_HOUR ?? "3", 10); // 3 AM default (after Insights sync)

/**
 * Sync individual CircleCI job runs from pipeline/workflow API
 * This stores job runs with release info (releaseKey) so we can group by releaseKey + serviceStackName
 * for accurate deployment frequency calculation.
 */
async function syncCircleCIJobRuns(): Promise<void> {
  const serviceClients = createServiceClients();
  const circleCIClient = serviceClients.circleci;
  
  if (!circleCIClient?.isConfigured()) {
    log("CircleCI not configured - skipping job runs sync", "circleci-job-runs-sync");
    return;
  }

  try {
    log("Starting CircleCI job runs sync...", "circleci-job-runs-sync");
    
    // Fetch recent activity (this gets individual job runs from pipeline API with release info)
    const since = new Date();
    since.setDate(since.getDate() - 90); // Last 90 days
    
    const events = await circleCIClient.fetchRecentActivity({ since, limit: 1000 });
    
    // Filter to only CircleCI release events (deploy jobs)
    const deployEvents = events.filter((e) => {
      if (e.source !== "circleci" || e.type !== "release") return false;
      
      const payload = e.payload as { jobName?: string; workflowName?: string } | undefined;
      const jobName = payload?.jobName ?? "";
      const workflowName = (payload?.workflowName ?? "").toLowerCase();
      
      // Only include deploy jobs from deploy-prod workflow
      if (!workflowName.includes("deploy-prod")) return false;
      if (!jobName.startsWith("Deploy ")) return false;
      if (workflowName.includes("ansible_playbook_prod")) return false;
      
      return true;
    });

    log(`Found ${deployEvents.length} deploy job events to sync`, "circleci-job-runs-sync");

    // Store in circleciJobRuns table
    const repository = createRepository();
    if (deployEvents.length > 0 && typeof (repository as any).upsertJobRuns === "function") {
      const jobRuns: Array<{
        projectSlug: string;
        pipelineId: string;
        pipelineNumber?: number;
        workflowId: string;
        workflowName: string;
        jobId?: string;
        jobName: string;
        jobPrefix?: string | null;
        serviceStackName?: string | null;
        branch?: string;
        releaseKey?: string;
        revision?: string;
        jobStartedAt?: Date;
        jobStoppedAt?: Date;
        timestamp: Date;
        status: string;
        failed: boolean;
      }> = [];
      
      let skipped = 0;
      
      for (const event of deployEvents) {
        const payload = event.payload as {
          projectSlug?: string;
          pipelineId?: string;
          pipelineNumber?: number;
          workflowId?: string;
          workflowName?: string;
          jobName?: string;
          jobStatus?: string;
          jobStartedAt?: string;
          jobStoppedAt?: string;
          branch?: string;
          releaseKey?: string;
          revision?: string;
          failed?: boolean;
        } | undefined;

        if (!payload?.pipelineId || !payload?.workflowId || !payload?.jobName) {
          skipped++;
          continue;
        }

        // Extract job prefix and service stack name
        const jobPrefix = (circleCIClient as any).extractJobPrefix(payload.jobName);
        const serviceStackName = (circleCIClient as any).extractServiceStackName(payload.jobName);
        
        // Extract release key from branch if not already in payload
        const branch = payload.branch ?? "";
        const releaseKey = payload.releaseKey ?? extractReleaseKeyFromBranch(branch);
        
        // Determine job ID (use workflowId + jobName as fallback if jobId not available)
        // Note: The pipeline API doesn't always return jobId, so we'll use a composite key
        const jobId = `${payload.workflowId}-${payload.jobName}-${payload.revision ?? "unknown"}`;

        jobRuns.push({
          projectSlug: payload.projectSlug ?? "unknown",
          pipelineId: payload.pipelineId,
          pipelineNumber: payload.pipelineNumber,
          workflowId: payload.workflowId,
          workflowName: payload.workflowName ?? "deploy-prod",
          jobId: jobId,
          jobName: payload.jobName,
          jobPrefix: jobPrefix,
          serviceStackName: serviceStackName,
          branch: branch || undefined,
          releaseKey: releaseKey || undefined,
          revision: payload.revision ?? undefined,
          jobStartedAt: payload.jobStartedAt ? new Date(payload.jobStartedAt) : undefined,
          jobStoppedAt: payload.jobStoppedAt ? new Date(payload.jobStoppedAt) : undefined,
          timestamp: new Date(event.timestamp),
          status: payload.jobStatus ?? "unknown",
          failed: payload.failed ?? false,
        });
      }
      
      try {
        await (repository as any).upsertJobRuns(jobRuns);
        log(`Synced ${jobRuns.length} job runs to database (${skipped} skipped)`, "circleci-job-runs-sync");
      } catch (error) {
        log(`Error storing job runs: ${error instanceof Error ? error.message : String(error)}`, "circleci-job-runs-sync");
      }
    } else {
      const repoMode = process.env.REPOSITORY_MODE || "memory";
      log(`Repository does not support upsertJobRuns (REPOSITORY_MODE=${repoMode}). Set REPOSITORY_MODE=postgres to enable database storage.`, "circleci-job-runs-sync");
    }
  } catch (error) {
    log(`Error in CircleCI job runs sync: ${error instanceof Error ? error.message : String(error)}`, "circleci-job-runs-sync");
  }
}

/**
 * Calculate milliseconds until next sync time (default: 3 AM daily)
 */
function getMsUntilNextSync(): number {
  const now = new Date();
  const nextSync = new Date();
  nextSync.setHours(DAILY_SYNC_HOUR, 0, 0, 0);
  
  // If already past today's sync time, schedule for tomorrow
  if (now >= nextSync) {
    nextSync.setDate(nextSync.getDate() + 1);
  }
  
  return nextSync.getTime() - now.getTime();
}

export function startCircleCIJobRunsSync(): void {
  // Run initial sync after a short delay
  setTimeout(() => {
    log("Starting initial CircleCI job runs sync...", "circleci-job-runs-sync");
    syncCircleCIJobRuns().catch((error) => {
      log(`Initial job runs sync failed: ${error instanceof Error ? error.message : String(error)}`, "circleci-job-runs-sync");
    });
  }, 10000); // 10 seconds after Insights sync

  // Schedule daily sync
  function scheduleNextSync(): void {
    const msUntilNext = getMsUntilNextSync();
    log(`Next CircleCI job runs sync scheduled in ${Math.round(msUntilNext / 1000 / 60)} minutes`, "circleci-job-runs-sync");
    
    setTimeout(() => {
      syncCircleCIJobRuns().catch((error) => {
        log(`Daily job runs sync failed: ${error instanceof Error ? error.message : String(error)}`, "circleci-job-runs-sync");
      });
      scheduleNextSync(); // Schedule next day
    }, msUntilNext);
  }

  scheduleNextSync();
}

// Export sync function for manual triggering
export { syncCircleCIJobRuns };
