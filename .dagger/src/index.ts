/**
 * .dagger/src/index.ts
 * Dagger module: CI operations as reusable capabilities.
 */
import { dag, object, func } from '@dagger.io/dagger';

@object()
export class HarmonyCi {
  /**
   * Determinism gate: regenerate registries/barrels and fail if git diff is non-empty.
   */
  @func()
  async syncCheck(): Promise<string> {
    const repo = dag.host().directory('.', {
      exclude: ['node_modules', '**/node_modules', '.nx', '**/dist', '**/coverage'],
    });

    // Use a Debian-based image to install git quickly.
    const ctr = dag
      .container()
      .from('node:20-bookworm')
      .withDirectory('/repo', repo)
      .withWorkdir('/repo')
      .withExec(['bash', '-lc', 'corepack enable'])
      .withExec(['bash', '-lc', 'apt-get update && apt-get install -y --no-install-recommends git ca-certificates'])
      .withExec(['bash', '-lc', 'pnpm install --frozen-lockfile'])
      .withExec(['bash', '-lc', 'pnpm nx g @golden/path:sync'])
      .withExec(['bash', '-lc', 'git diff --exit-code']);

    // Ensure the container actually runs.
    await ctr.exitCode();
    return 'OK: syncCheck passed (no generated drift)';
  }

  /**
   * Workspace audit: determinism gate + affected lint/test.
   * This is intended to mirror `nx run harmony:audit` for CI reuse.
   */
  @func()
  async audit(): Promise<string> {
    const repo = dag.host().directory('.', {
      exclude: ['node_modules', '**/node_modules', '.nx', '**/dist', '**/coverage'],
    });

    const ctr = dag
      .container()
      .from('node:20-bookworm')
      .withDirectory('/repo', repo)
      .withWorkdir('/repo')
      .withExec(['bash', '-lc', 'corepack enable'])
      .withExec(['bash', '-lc', 'apt-get update && apt-get install -y --no-install-recommends git ca-certificates'])
      .withExec(['bash', '-lc', 'pnpm install --frozen-lockfile'])
      .withExec(['bash', '-lc', 'pnpm nx g @golden/path:sync'])
      .withExec(['bash', '-lc', 'git diff --exit-code'])
      .withExec(['bash', '-lc', 'pnpm nx affected -t lint test']);

    await ctr.exitCode();
    return 'OK: audit passed';
  }
}

