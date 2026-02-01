/**
 * .dagger/src/src/index.ts
 * Dagger module: CI operations as reusable capabilities.
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
   * Workspace audit: determinism gate + affected lint/test.
   * Mirrors `nx run harmony:audit` for CI reuse.
   */
  @func()
  async audit(repo: Directory): Promise<string> {
    const ctr = baseNodeContainer(repo)
      .withExec(["bash", "-lc", syncDryRunGateScript])
      .withExec(["bash", "-lc", "pnpm nx affected -t lint test --exclude=console"])

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
}
