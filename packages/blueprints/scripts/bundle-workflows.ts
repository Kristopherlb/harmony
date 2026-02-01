/**
 * Bundle workflow code for Temporal worker (used by e2e and worker runtime).
 * Run from packages/blueprints: pnpm run bundle-workflows
 */
import { bundleWorkflowCode } from '@temporalio/worker';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');

async function bundle() {
  const workflowsPath = path.join(packageRoot, 'src/workflows');
  const outDir = path.join(packageRoot, 'dist');
  await mkdir(outDir, { recursive: true });
  const codePath = path.join(outDir, 'workflow-bundle.js');

  const { code } = await bundleWorkflowCode({
    workflowsPath,
    ignoreModules: [],
  });
  await writeFile(codePath, code);
  console.log(`Workflow bundle written to ${codePath}`);
}

bundle().catch((err) => {
  console.error(err);
  process.exit(1);
});
