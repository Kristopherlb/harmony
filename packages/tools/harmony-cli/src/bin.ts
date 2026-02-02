#!/usr/bin/env node
/**
 * packages/tools/harmony-cli/src/bin.ts
 *
 * Purpose: executable entrypoint for the `harmony` CLI.
 */
import { runCli } from './cli.js';

runCli(process.argv.slice(2))
  .then((res) => {
    if (res.stdout) process.stdout.write(res.stdout);
    if (res.stderr) process.stderr.write(res.stderr);
    process.exit(res.exitCode);
  })
  .catch((err) => {
    process.stderr.write(err instanceof Error ? `${err.stack ?? err.message}\n` : `${String(err)}\n`);
    process.exit(1);
  });

