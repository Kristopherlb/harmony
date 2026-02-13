import { describe, it, expect, vi, beforeEach } from "vitest";

describe("workbench telemetry", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
  });

  it("reuses an existing session id from sessionStorage", async () => {
    window.sessionStorage.setItem("golden.workbench.session_id", "session-xyz");
    const { getOrCreateWorkbenchSessionId } = await import("./workbench-telemetry");
    expect(getOrCreateWorkbenchSessionId()).toBe("session-xyz");
  });

  it("posts events to /api/workbench/telemetry with required fields", async () => {
    const fetchSpy = vi.fn(async () => ({ ok: true } as any));
    // @ts-expect-error - test stub
    global.fetch = fetchSpy;

    const { emitWorkbenchEvent } = await import("./workbench-telemetry");
    await emitWorkbenchEvent({ event: "workbench.session_started" });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/workbench/telemetry");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body).toHaveProperty("event", "workbench.session_started");
    expect(body).toHaveProperty("sessionId");
    expect(body).toHaveProperty("timestamp");
  });
});

