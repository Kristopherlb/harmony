// server/dora/lead-time-join.ts
// Lead time calculation utilities for DORA metrics

import type { Event } from "@shared/schema";
import { selectDeployTimestamp, type DeployAtMode } from "./lead-time";

export interface NormalizedDeployEvent {
  repoKey: string;
  releaseBranch: string;
  releaseKey: string;
  ring: string | null;
  deployedAt: string; // ISO timestamp
}

export interface NormalizedPrMerge {
  repoKey: string;
  releaseBranch: string;
  mergedAt: string; // ISO timestamp
}

export function normalizeCircleCiDeployEvents(events: Event[]): NormalizedDeployEvent[] {
  const out: NormalizedDeployEvent[] = [];

  for (const e of events) {
    if (e.source !== "circleci") continue;
    if (e.type !== "release") continue;

    const payload = e.payload as {
      repoKey?: string | null;
      branch?: string | null;
      releaseKey?: string | null;
      ring?: string | null;
    };

    const repoKey = payload.repoKey ?? null;
    const releaseBranch = payload.branch ?? null;
    const releaseKey = payload.releaseKey ?? null;
    if (!repoKey || !releaseBranch || !releaseKey) continue;

    out.push({
      repoKey,
      releaseBranch,
      releaseKey,
      ring: payload.ring ?? null,
      deployedAt: e.timestamp,
    });
  }

  return out;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

export function computeLeadTimeHours(args: {
  deployEvents: NormalizedDeployEvent[];
  prMerges: NormalizedPrMerge[];
  deployAt: DeployAtMode;
  windowStart?: Date;
  windowEnd?: Date;
}): number | null {
  const { deployEvents, prMerges, deployAt, windowStart, windowEnd } = args;

  // Collapse ring-level deploys into one deploy per (repoKey, releaseBranch, releaseKey),
  // choosing first vs last ring time.
  const collapsed = new Map<string, NormalizedDeployEvent>();
  const groupedTimestamps = new Map<string, string[]>();

  for (const d of deployEvents) {
    const key = `${d.repoKey}|${d.releaseBranch}|${d.releaseKey}`;
    const list = groupedTimestamps.get(key) ?? [];
    list.push(d.deployedAt);
    groupedTimestamps.set(key, list);
  }

  groupedTimestamps.forEach((timestamps, key) => {
    const [repoKey, releaseBranch, releaseKey] = key.split("|") as [string, string, string];
    const deployedAt = selectDeployTimestamp(timestamps, deployAt);
    if (!deployedAt) return;

    collapsed.set(key, {
      repoKey,
      releaseBranch,
      releaseKey,
      ring: null,
      deployedAt,
    });
  });

  let deployments = Array.from(collapsed.values());
  deployments.sort((a, b) => new Date(a.deployedAt).getTime() - new Date(b.deployedAt).getTime());

  if (windowStart || windowEnd) {
    deployments = deployments.filter((d) => {
      const t = new Date(d.deployedAt).getTime();
      if (windowStart && t < windowStart.getTime()) return false;
      if (windowEnd && t > windowEnd.getTime()) return false;
      return true;
    });
  }

  const mergesByRepoBranch = new Map<string, Date[]>();
  for (const m of prMerges) {
    const key = `${m.repoKey}|${m.releaseBranch}`;
    const list = mergesByRepoBranch.get(key) ?? [];
    const dt = new Date(m.mergedAt);
    if (!Number.isFinite(dt.getTime())) continue;
    list.push(dt);
    mergesByRepoBranch.set(key, list);
  }
  mergesByRepoBranch.forEach((list) => {
    list.sort((a: Date, b: Date) => a.getTime() - b.getTime());
  });

  const lastDeployedAtByRepoBranch = new Map<string, Date>();
  const perDeploymentMedians: number[] = [];

  for (const d of deployments) {
    const repoBranchKey = `${d.repoKey}|${d.releaseBranch}`;
    const deployedAt = new Date(d.deployedAt);
    if (!Number.isFinite(deployedAt.getTime())) continue;

    const previousDeployedAt = lastDeployedAtByRepoBranch.get(repoBranchKey) ?? null;
    lastDeployedAtByRepoBranch.set(repoBranchKey, deployedAt);

    const merges = mergesByRepoBranch.get(repoBranchKey) ?? [];
    const leadTimesForThisDeploy: number[] = [];

    for (const mergedAt of merges) {
      if (mergedAt.getTime() > deployedAt.getTime()) break;
      if (previousDeployedAt && mergedAt.getTime() <= previousDeployedAt.getTime()) continue;
      leadTimesForThisDeploy.push((deployedAt.getTime() - mergedAt.getTime()) / (1000 * 60 * 60));
    }

    const m = median(leadTimesForThisDeploy);
    if (m !== null) perDeploymentMedians.push(m);
  }

  return median(perDeploymentMedians);
}
