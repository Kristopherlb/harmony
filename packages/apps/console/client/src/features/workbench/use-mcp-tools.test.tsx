import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useMcpToolCatalog } from "./use-mcp-tools";

function Harness() {
  const { data, loading, error, refresh, refreshing } = useMcpToolCatalog();

  if (loading) return <div>loading</div>;
  if (error) return <div>error:{error.message}</div>;

  return (
    <div>
      <div>version:{data?.manifest.version ?? ""}</div>
      <div>generated_at:{data?.manifest.generated_at ?? ""}</div>
      <div>aiHints:{(data?.tools?.[0] as any)?.aiHints?.usageNotes ?? ""}</div>
      <div>refreshing:{String(refreshing)}</div>
      <button type="button" onClick={() => refresh()}>
        refresh
      </button>
    </div>
  );
}

describe("useMcpToolCatalog", () => {
  it("refreshes the tool catalog via POST and updates generated_at", async () => {
    const fetchMock = vi.fn(async (url: any, _init?: any) => {
      if (url === "/api/mcp/tools") {
        return {
          ok: true,
          json: async () => ({
            manifest: { generated_at: "2026-02-02T00:00:00.000Z", version: "1" },
            tools: [
              {
                name: "golden.echo",
                description: "Echo",
                inputSchema: { type: "object" },
                type: "CAPABILITY",
                dataClassification: "PUBLIC",
                aiHints: { usageNotes: "Use for smoke checks." },
              },
            ],
          }),
        } as any;
      }
      if (url === "/api/mcp/tools/refresh") {
        return {
          ok: true,
          json: async () => ({
            manifest: { generated_at: "2026-02-02T00:00:01.000Z", version: "1" },
            tools: [
              {
                name: "golden.echo",
                description: "Echo",
                inputSchema: { type: "object" },
                type: "CAPABILITY",
                dataClassification: "PUBLIC",
                aiHints: { usageNotes: "Use for smoke checks." },
              },
            ],
          }),
        } as any;
      }
      throw new Error(`unexpected url ${String(url)}`);
    });

    const prevFetch = global.fetch;
    global.fetch = fetchMock as any;
    try {
      render(<Harness />);

      await screen.findByText("version:1");
      expect(screen.getByText("generated_at:2026-02-02T00:00:00.000Z")).toBeInTheDocument();
      expect(screen.getByText("aiHints:Use for smoke checks.")).toBeInTheDocument();

      fireEvent.click(screen.getByText("refresh"));

      await waitFor(() => {
        expect(screen.getByText("generated_at:2026-02-02T00:00:01.000Z")).toBeInTheDocument();
      });

      expect(fetchMock).toHaveBeenCalledWith("/api/mcp/tools", expect.anything());
      expect(fetchMock).toHaveBeenCalledWith("/api/mcp/tools/refresh", expect.anything());
    } finally {
      global.fetch = prevFetch as any;
    }
  });
});

