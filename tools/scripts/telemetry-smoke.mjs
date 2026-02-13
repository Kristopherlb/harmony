/**
 * tools/scripts/telemetry-smoke.mjs
 *
 * Golden path: Telemetry → Metrics smoke test.
 *
 * Posts a synthetic telemetry event, then polls a Prometheus metrics endpoint until
 * expected series names appear (or times out).
 *
 * Usage:
 *   node tools/scripts/telemetry-smoke.mjs \
 *     --base-url http://localhost:3000 \
 *     --telemetry-path /api/workbench/telemetry \
 *     --metrics-path /api/workbench/metrics \
 *     --expected-series golden_contract_workbench_events_total \
 *     --expected-series golden_contract_workbench_event_duration_seconds_bucket
 */

function nowMs() {
  return Date.now();
}

function usage() {
  return `
telemetry-smoke

Options:
  --base-url <url>           Base URL (default: http://localhost:3000)
  --telemetry-path <path>    Telemetry POST path (default: /api/workbench/telemetry)
  --metrics-path <path>      Metrics GET path (default: /api/workbench/metrics)
  --event <name>             Event name (default: workbench.session_started)
  --session-id <id>          Session id (default: smoke-<timestamp>)
  --expected-series <name>   Expected series substring (repeatable)
  --timeout-ms <ms>          Timeout (default: 15000)
  --poll-ms <ms>             Poll interval (default: 500)
  --verbose                  Log responses and polling state
  --help                     Show help

Exit codes:
  0 = success
  1 = failure
`.trim();
}

function parseArgs(argv) {
  const out = {
    baseUrl: "http://localhost:3000",
    telemetryPath: "/api/workbench/telemetry",
    metricsPath: "/api/workbench/metrics",
    event: "workbench.session_started",
    sessionId: `smoke-${new Date().toISOString()}`,
    expectedSeries: [],
    timeoutMs: 15_000,
    pollMs: 500,
    verbose: false,
    help: false,
  };

  const args = [...argv];
  while (args.length > 0) {
    const a = args.shift();
    if (!a) break;
    if (a === "--help" || a === "-h") out.help = true;
    else if (a === "--verbose") out.verbose = true;
    else if (a === "--base-url") out.baseUrl = String(args.shift() ?? "");
    else if (a === "--telemetry-path") out.telemetryPath = String(args.shift() ?? "");
    else if (a === "--metrics-path") out.metricsPath = String(args.shift() ?? "");
    else if (a === "--event") out.event = String(args.shift() ?? "");
    else if (a === "--session-id") out.sessionId = String(args.shift() ?? "");
    else if (a === "--expected-series") out.expectedSeries.push(String(args.shift() ?? ""));
    else if (a === "--timeout-ms") out.timeoutMs = Number(args.shift() ?? out.timeoutMs);
    else if (a === "--poll-ms") out.pollMs = Number(args.shift() ?? out.pollMs);
    else {
      throw new Error(`Unknown arg: ${a}`);
    }
  }

  out.baseUrl = out.baseUrl.replace(/\/+$/, "");
  if (!out.telemetryPath.startsWith("/")) out.telemetryPath = `/${out.telemetryPath}`;
  if (!out.metricsPath.startsWith("/")) out.metricsPath = `/${out.metricsPath}`;
  out.expectedSeries = out.expectedSeries.filter((s) => typeof s === "string" && s.trim().length > 0);
  if (!Number.isFinite(out.timeoutMs) || out.timeoutMs <= 0) out.timeoutMs = 15_000;
  if (!Number.isFinite(out.pollMs) || out.pollMs <= 0) out.pollMs = 500;

  return out;
}

async function readTextSafe(res) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    process.exit(0);
  }

  const telemetryUrl = `${args.baseUrl}${args.telemetryPath}`;
  const metricsUrl = `${args.baseUrl}${args.metricsPath}`;

  const timestamp = new Date().toISOString();
  const payload = {
    event: args.event,
    sessionId: args.sessionId,
    timestamp,
  };

  if (args.verbose) {
    console.log(`[telemetry-smoke] POST ${telemetryUrl}`);
    console.log(`[telemetry-smoke] payload: ${JSON.stringify(payload)}`);
  }

  const postRes = await fetch(telemetryUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (postRes.status !== 204) {
    const text = await readTextSafe(postRes);
    throw new Error(`Telemetry POST failed (${postRes.status}): ${text || postRes.statusText}`);
  }

  const expected = args.expectedSeries.length > 0 ? args.expectedSeries : ["golden_contract_workbench_events_total"];
  const started = nowMs();
  let lastBody = "";

  while (nowMs() - started < args.timeoutMs) {
    const res = await fetch(metricsUrl, { method: "GET" });
    lastBody = await readTextSafe(res);

    const ok = expected.every((needle) => lastBody.includes(needle));
    if (ok) {
      console.log(
        `[telemetry-smoke] OK: saw ${expected.length} expected series in ${metricsUrl} (elapsed ${nowMs() - started}ms)`
      );
      return;
    }

    if (args.verbose) {
      console.log(`[telemetry-smoke] waiting... elapsed ${nowMs() - started}ms (missing: ${expected.filter((n) => !lastBody.includes(n)).join(", ")})`);
    }

    await new Promise((r) => setTimeout(r, args.pollMs));
  }

  const missing = expected.filter((n) => !lastBody.includes(n));
  throw new Error(
    `Timed out after ${args.timeoutMs}ms waiting for metrics series in ${metricsUrl}. Missing: ${missing.join(", ")}`
  );
}

main().catch((err) => {
  console.error(`[telemetry-smoke] ERROR: ${String(err?.message ?? err)}`);
  process.exit(1);
});

