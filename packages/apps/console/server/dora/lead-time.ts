// server/dora/lead-time.ts
// Helper functions for DORA metrics and CircleCI integration

export type DeployAtMode = "firstRing" | "lastRing";

export function extractReleaseKeyFromBranch(branch: string | undefined): string | null {
  if (!branch) return null;

  // Supported examples:
  // - release/11.0.40
  // - release/v11.0.40
  // - release-11.0.40
  const match = branch.match(/^release[\/-](v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)$/i);
  if (!match) return null;

  return match[1].replace(/^v/i, "");
}

export function deriveRepoKeyFromProjectSlug(projectSlug: string | undefined): string | null {
  if (!projectSlug) return null;

  // CircleCI project slugs look like:
  // - bb/workspace/repo
  // - gh/org/repo
  const parts = projectSlug.split("/").filter(Boolean);
  if (parts.length >= 3) {
    return `${parts[1]}/${parts[2]}`;
  }
  if (parts.length === 2) {
    return parts[1];
  }
  return null;
}

export function deriveRepoKeyFromRepositoryUrl(repositoryUrl: string | undefined): string | null {
  if (!repositoryUrl) return null;
  try {
    const url = new URL(repositoryUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return `${parts[0]}/${parts[1]}`;
  } catch {
    return null;
  }
}

export function deriveRing(value: string | undefined): string | null {
  if (!value) return null;
  const ringMatch = value.match(/\b(ca|oc|eu|us2|na)\b/i);
  return ringMatch?.[1]?.toUpperCase() ?? null;
}

export function selectDeployTimestamp(
  deployedAtIsoTimestamps: Array<string | undefined>,
  mode: DeployAtMode
): string | null {
  const candidates = deployedAtIsoTimestamps
    .map((ts) => (ts ? new Date(ts) : null))
    .filter((d): d is Date => Boolean(d && Number.isFinite(d.getTime())));

  if (candidates.length === 0) return null;

  const sorted = candidates.sort((a, b) => a.getTime() - b.getTime());
  const chosen = mode === "firstRing" ? sorted[0] : sorted[sorted.length - 1];
  return chosen.toISOString();
}
