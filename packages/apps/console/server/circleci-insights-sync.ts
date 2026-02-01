import { createServiceClients } from "./clients";
import { createRepository } from "./storage";
import { log } from "./index";

const DAILY_SYNC_HOUR = Number.parseInt(process.env.CIRCLECI_INSIGHTS_SYNC_HOUR ?? "2", 10); // 2 AM default
const REPORTING_WINDOW = "last-90-days" as const;

async function syncCircleCIInsights(): Promise<void> {
  const serviceClients = createServiceClients();
  const circleCIClient = serviceClients.circleci;
  
  if (!circleCIClient?.isConfigured()) {
    log("CircleCI not configured - skipping Insights sync", "circleci-insights-sync");
    return;
  }

  try {
    log("Starting CircleCI Insights sync...", "circleci-insights-sync");
    
    // Get project slugs (support multiple projects)
    const projectSlugs = (circleCIClient as any).projectSlugs ?? [];
    if (projectSlugs.length === 0) {
      log("No CircleCI projects configured", "circleci-insights-sync");
      return;
    }

    const allMetrics: Array<{
      projectSlug: string;
      workflowName: string;
      jobName: string;
      jobPrefix: string | null;
      serviceStackName: string | null;
      reportingWindow: string;
      windowStart: Date;
      windowEnd: Date;
      totalRuns: number;
      successfulRuns: number;
      failedRuns: number;
      successRate: number;
      throughput: number;
      totalCreditsUsed: number | null;
      durationMetrics: Record<string, unknown>;
    }> = [];

    // Fetch metrics for each project
    for (const projectSlug of projectSlugs) {
      try {
        log(`Fetching Insights data for project: ${projectSlug}`, "circleci-insights-sync");
        
        const jobMetrics = await (circleCIClient as any).fetchJobMetrics(
          projectSlug,
          "deploy-prod",
          REPORTING_WINDOW
        );

        // Filter out non-deploy jobs (e.g., "hold")
        const deployJobs = jobMetrics.filter((job: { name: string }) => 
          job.name.startsWith("Deploy ") && 
          !job.name.toLowerCase().includes("hold")
        );

        for (const job of deployJobs) {
          const jobPrefix = (circleCIClient as any).extractJobPrefix(job.name);
          const serviceStackName = (circleCIClient as any).extractServiceStackName(job.name);
          
          allMetrics.push({
            projectSlug,
            workflowName: "deploy-prod",
            jobName: job.name,
            jobPrefix,
            serviceStackName,
            reportingWindow: REPORTING_WINDOW,
            windowStart: new Date(job.window_start),
            windowEnd: new Date(job.window_end),
            totalRuns: job.metrics.total_runs,
            successfulRuns: job.metrics.successful_runs,
            failedRuns: job.metrics.failed_runs,
            successRate: job.metrics.success_rate,
            throughput: job.metrics.throughput,
            totalCreditsUsed: job.metrics.total_credits_used ?? null,
            durationMetrics: job.metrics.duration_metrics,
          });
        }

        log(`Fetched ${deployJobs.length} deploy jobs for ${projectSlug}`, "circleci-insights-sync");
      } catch (error) {
        log(`Error syncing project ${projectSlug}: ${error instanceof Error ? error.message : String(error)}`, "circleci-insights-sync");
      }
    }

    // Store in database
    if (allMetrics.length > 0) {
      const repository = createRepository();
      // Check if repository has upsertJobMetrics method (PostgresRepository)
      if (typeof (repository as any).upsertJobMetrics === "function") {
        try {
          await (repository as any).upsertJobMetrics(allMetrics);
          log(`Synced ${allMetrics.length} job metrics to database`, "circleci-insights-sync");
        } catch (error) {
          log(`Error storing job metrics in database: ${error instanceof Error ? error.message : String(error)}`, "circleci-insights-sync");
          throw error; // Re-throw to be caught by outer try-catch
        }
      } else {
        const repoMode = process.env.REPOSITORY_MODE || "memory";
        log(`Repository does not support upsertJobMetrics (REPOSITORY_MODE=${repoMode}). Set REPOSITORY_MODE=postgres to enable database storage.`, "circleci-insights-sync");
      }
    } else {
      log("No job metrics to sync", "circleci-insights-sync");
    }
  } catch (error) {
    log(`Error in CircleCI Insights sync: ${error instanceof Error ? error.message : String(error)}`, "circleci-insights-sync");
  }
}

/**
 * Calculate milliseconds until next sync time (default: 2 AM daily)
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

export function startCircleCIInsightsSync(): void {
  // Run initial sync after a short delay
  setTimeout(() => {
    log("Starting initial CircleCI Insights sync...", "circleci-insights-sync");
    syncCircleCIInsights().catch((error) => {
      log(`Initial Insights sync failed: ${error instanceof Error ? error.message : String(error)}`, "circleci-insights-sync");
    });
  }, 5000);

  // Schedule daily sync
  function scheduleNextSync(): void {
    const msUntilNext = getMsUntilNextSync();
    log(`Next CircleCI Insights sync scheduled in ${Math.round(msUntilNext / 1000 / 60)} minutes`, "circleci-insights-sync");
    
    setTimeout(() => {
      syncCircleCIInsights().catch((error) => {
        log(`Daily Insights sync failed: ${error instanceof Error ? error.message : String(error)}`, "circleci-insights-sync");
      });
      scheduleNextSync(); // Schedule next day
    }, msUntilNext);
  }

  scheduleNextSync();
}

// Export sync function for manual triggering
export { syncCircleCIInsights };
