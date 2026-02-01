import { useEffect, useMemo, useState } from "react";

export interface McpTool {
  name: string;
  description: string;
  inputSchema: unknown;
  type: "CAPABILITY" | "BLUEPRINT";
  dataClassification: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";
}

export interface McpToolCatalogResponse {
  manifest: { generated_at: string; version: string };
  tools: McpTool[];
}

export function useMcpToolCatalog() {
  const [data, setData] = useState<McpToolCatalogResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/mcp/tools", { credentials: "include" });
        if (!res.ok) {
          const text = (await res.text()) || res.statusText;
          throw new Error(`${res.status}: ${text}`);
        }
        const json = (await res.json()) as McpToolCatalogResponse;
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e as Error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  const tools = useMemo(() => data?.tools ?? [], [data]);

  return { data, tools, loading, error };
}

