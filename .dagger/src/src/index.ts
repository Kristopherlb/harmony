/**
 * .dagger/src/src/index.ts
 * Dagger module: CI operations as reusable capabilities.
 *
 * This module provides a thin wrapper around Harmony blueprints.
 * All CI/CD logic lives in capabilities and blueprints, not in Dagger code.
 *
 * Pattern: Dagger calls runBlueprint() which starts Temporal workflows.
 */
import { dag, Directory, func, object } from "@dagger.io/dagger"

const syncDryRunGateScript = [
  "node -e \"",
  "const { execSync } = require('node:child_process');",
  "let out = '';",
  "try {",
  "  out = execSync('pnpm nx g @golden/path:sync --dry-run', { encoding: 'utf-8' });",
  "} catch (e) {",
  "  if (e && typeof e.stdout === 'string') out = e.stdout;",
  "  process.stdout.write(out);",
  "  process.stderr.write(String(e?.stderr ?? e?.message ?? e));",
  "  process.exit(1);",
  "}",
  "process.stdout.write(out);",
  "if (/^(CREATE|UPDATE|DELETE)\\s+/m.test(out)) {",
  "  process.stderr.write('\\nGenerated artifacts are stale. Run: pnpm nx g @golden/path:sync (then commit).\\n');",
  "  process.exit(1);",
  "}",
  "\"",
].join("")

function ensureUrlHasGitSuffix(url: string): string {
  return url.endsWith(".git") ? url : `${url}.git`
}

function repoFromGit(repoUrl: string, ref: string): Directory {
  const url = ensureUrlHasGitSuffix(repoUrl)
  // Discard .git for determinism + smaller trees.
  return dag.git(url).ref(ref).tree({ discardGitDir: true })
}

function baseNodeContainer(repo: Directory) {
  const pnpmStore = dag.cacheVolume("pnpm-store")
  const nxCache = dag.cacheVolume("nx-cache")

  return dag
    .container()
    .from("node:20-bookworm")
    .withMountedDirectory("/repo", repo)
    .withWorkdir("/repo")
    // Cache stores to keep CI fast + deterministic.
    .withMountedCache("/pnpm/store", pnpmStore)
    .withEnvVariable("PNPM_STORE_PATH", "/pnpm/store")
    .withMountedCache("/repo/.nx/cache", nxCache)
    .withExec(["bash", "-lc", "corepack enable"])
    .withExec(["bash", "-lc", "pnpm --version"])
    .withExec(["bash", "-lc", "pnpm install --frozen-lockfile"])
}

/**
 * Escape JSON for shell command.
 */
function escapeJsonForShell(input: string): string {
  return input.replace(/'/g, "'\\''")
}

@object()
export class HarmonyCi {
  /**
   * Determinism gate: ensure sync generator is clean (dry-run).
   */
  @func()
  async syncCheck(repo: Directory): Promise<string> {
    const ctr = baseNodeContainer(repo).withExec(["bash", "-lc", syncDryRunGateScript])

    await ctr.exitCode()
    return "OK: syncCheck passed (no generated drift)"
  }

  /**
   * Workspace audit: determinism gate + affected lint/test + certification.
   * Mirrors `nx run harmony:audit` for CI reuse.
   */
  @func()
  async audit(repo: Directory): Promise<string> {
    const ctr = baseNodeContainer(repo)
      .withExec(["bash", "-lc", syncDryRunGateScript])
      .withExec(["bash", "-lc", "pnpm nx affected -t lint test --exclude=console"])
      .withExec(["bash", "-lc", "pnpm nx run certification:certify"])

    await ctr.exitCode()
    return "OK: audit passed"
  }

  /**
   * Determinism gate without host upload: clone from git URL at ref.
   *
   * Example:
   * - repoUrl: https://github.com/<org>/<repo>.git
   * - ref: a git SHA, branch name, or tag (e.g. ${{ github.sha }})
   */
  @func()
  async syncCheckGit(repoUrl: string, ref: string): Promise<string> {
    return await this.syncCheck(repoFromGit(repoUrl, ref))
  }

  /**
   * Audit without host upload: clone from git URL at ref.
   */
  @func()
  async auditGit(repoUrl: string, ref: string): Promise<string> {
    return await this.audit(repoFromGit(repoUrl, ref))
  }

  // ============================================================================
  // Blueprint Execution - Thin wrappers around Temporal workflows
  // All CI/CD logic lives in capabilities and blueprints, not in Dagger code.
  // ============================================================================

  /**
   * Execute a blueprint via Temporal workflow.
   * This is the core method - all other deployment methods delegate to this.
   *
   * @param repoUrl - Git repository URL
   * @param ref - Git ref (SHA, branch, or tag)
   * @param blueprintId - Blueprint ID (e.g., "blueprints.ci.release-pipeline")
   * @param input - JSON string of blueprint input
   * @returns Blueprint execution result as JSON string
   */
  @func()
  async runBlueprint(
    repoUrl: string,
    ref: string,
    blueprintId: string,
    input: string
  ): Promise<string> {
    const repo = repoFromGit(repoUrl, ref)
    const escapedInput = escapeJsonForShell(input)

    // Build the CLI command to start the blueprint as a Temporal workflow
    const runBlueprintCmd = [
      "pnpm tsx packages/tools/mcp-server/src/cli/run-blueprint.ts",
      `--blueprint='${blueprintId}'`,
      `--input='${escapedInput}'`,
    ].join(" ")

    const ctr = baseNodeContainer(repo)
      .withEnvVariable("TEMPORAL_ADDRESS", "temporal:7233")
      .withEnvVariable("TEMPORAL_NAMESPACE", "default")
      .withExec(["bash", "-lc", runBlueprintCmd])

    return await ctr.stdout()
  }

  /**
   * Execute release pipeline blueprint.
   * Runs certification, security scans, OSCAL generation, and artifact bundling.
   *
   * @param repoUrl - Git repository URL
   * @param ref - Git ref (SHA, branch, or tag)
   * @param version - Release version (e.g., "2.0.0")
   * @returns Release pipeline result
   */
  @func()
  async release(
    repoUrl: string,
    ref: string,
    version: string
  ): Promise<string> {
    const input = JSON.stringify({
      version,
      gitSha: ref,
      contextPath: ".",
    })

    return this.runBlueprint(
      repoUrl,
      ref,
      "blueprints.ci.release-pipeline",
      input
    )
  }

  /**
   * Execute blue/green deploy blueprint.
   * Zero-downtime deployment with Temporal worker versioning.
   *
   * @param repoUrl - Git repository URL
   * @param ref - Git ref (SHA, branch, or tag)
   * @param version - Release version / Build ID (e.g., "2.0.0")
   * @param registry - Container registry address
   * @param taskQueue - Temporal task queue (defaults to "golden-tools")
   * @param previousBuildId - Previous Build ID to drain (optional)
   * @returns Blue/green deploy result
   */
  @func()
  async deployBlueGreen(
    repoUrl: string,
    ref: string,
    version: string,
    registry: string,
    taskQueue: string = "golden-tools",
    previousBuildId?: string
  ): Promise<string> {
    const input = JSON.stringify({
      version,
      registry,
      taskQueue,
      previousBuildId,
      contextPath: "packages/blueprints",
      waitForDrain: true,
    })

    return this.runBlueprint(
      repoUrl,
      ref,
      "blueprints.deploy.blue-green",
      input
    )
  }

  /**
   * Execute progressive rollout blueprint.
   * Staged rollout with automatic canary analysis and rollback.
   *
   * @param repoUrl - Git repository URL
   * @param ref - Git ref (SHA, branch, or tag)
   * @param version - New version being rolled out
   * @param baselineVersion - Baseline version to compare against
   * @param service - Service name for mesh routing
   * @param prometheusUrl - Prometheus URL for metrics
   * @param stages - Rollout stages (percentages), defaults to [10, 25, 50, 75, 100]
   * @returns Progressive rollout result
   */
  @func()
  async progressiveRollout(
    repoUrl: string,
    ref: string,
    version: string,
    baselineVersion: string,
    service: string,
    prometheusUrl: string,
    stages?: number[]
  ): Promise<string> {
    const input = JSON.stringify({
      version,
      baselineVersion,
      service,
      prometheusUrl,
      stages: stages ?? [10, 25, 50, 75, 100],
      useMeshRouting: true,
    })

    return this.runBlueprint(
      repoUrl,
      ref,
      "blueprints.traffic.progressive-rollout",
      input
    )
  }

  /**
   * Execute release pipeline from git URL.
   * Convenience method that clones, builds, and runs the full release pipeline.
   */
  @func()
  async releaseGit(
    repoUrl: string,
    ref: string,
    version: string
  ): Promise<string> {
    return this.release(repoUrl, ref, version)
  }

  /**
   * Execute blue/green deploy from git URL.
   * Convenience method that clones and runs the blue/green deployment.
   */
  @func()
  async deployBlueGreenGit(
    repoUrl: string,
    ref: string,
    version: string,
    registry: string,
    taskQueue: string = "golden-tools",
    previousBuildId?: string
  ): Promise<string> {
    return this.deployBlueGreen(
      repoUrl,
      ref,
      version,
      registry,
      taskQueue,
      previousBuildId
    )
  }
}
