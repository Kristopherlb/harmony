/**
 * packages/blueprints/src/workflows/ci/github-release.workflow-run.ts
 * Temporal workflow entry: run function for GitHubReleaseWorkflow.
 */
import {
  GitHubReleaseWorkflow,
  type GitHubReleaseInput,
  type GitHubReleaseOutput,
  type GitHubReleaseConfig,
} from './github-release.workflow';

export async function githubReleaseWorkflow(
  input: GitHubReleaseInput,
  config: GitHubReleaseConfig = {}
): Promise<GitHubReleaseOutput> {
  const w = new GitHubReleaseWorkflow();
  return w.main(input, config);
}

