/**
 * tools/scripts/restart-console-dev.mjs
 *
 * Purpose: Provide a single canonical command to restart the Console dev server,
 * which is the tool-surface that serves `/api/mcp/tools` to Workbench.
 *
 * Notes:
 * - Designed for local development on macOS/Linux (uses `lsof`).
 * - Does not attempt to restart Temporal/Workers; only the Console server.
 */
import { spawnSync } from "node:child_process";

const PORT = Number(process.env.CONSOLE_PORT ?? "5000");
if (!Number.isFinite(PORT) || PORT <= 0) {
  throw new Error(`Invalid CONSOLE_PORT: ${String(process.env.CONSOLE_PORT)}`);
}

function run(cmd, args) {
  const res = spawnSync(cmd, args, { stdio: "pipe", encoding: "utf8" });
  return { code: res.status ?? 0, stdout: res.stdout ?? "", stderr: res.stderr ?? "" };
}

// Best-effort: kill any processes listening on the Console port.
const lsof = run("lsof", ["-ti", `tcp:${PORT}`]);
const pids = lsof.stdout
  .split("\n")
  .map((s) => s.trim())
  .filter(Boolean);

if (pids.length > 0) {
  console.log(`[restart-console-dev] Killing processes on port ${PORT}: ${pids.join(", ")}`);
  for (const pid of pids) {
    // Try TERM first.
    run("kill", ["-TERM", pid]);
  }
  // Then KILL remaining.
  for (const pid of pids) {
    run("kill", ["-KILL", pid]);
  }
} else {
  console.log(`[restart-console-dev] No processes found on port ${PORT}`);
}

console.log("[restart-console-dev] Starting console dev server via Nx…");
const start = spawnSync("pnpm", ["nx", "run", "console:serve"], { stdio: "inherit" });
process.exit(start.status ?? 0);

