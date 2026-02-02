import { useCallback, useEffect, useMemo, useState } from "react";

export interface McpTool {
  name: string;
  description: string;
  inputSchema: unknown;
  type: "CAPABILITY" | "BLUEPRINT";
  dataClassification: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";
  domain?: string;
  subdomain?: string;
  tags?: string[];
  maintainer?: string;
  requiredScopes?: string[];
  allowOutbound?: string[];
  isIdempotent?: boolean;
  costFactor?: "LOW" | "MEDIUM" | "HIGH";
}

export interface McpToolCatalogResponse {
  manifest: { generated_at: string; version: string };
  tools: McpTool[];
}

export function useMcpToolCatalog() {
  const [data, setData] = useState<McpToolCatalogResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCatalog = useCallback(
    async (input: { url: string; init: RequestInit; setBusy: (v: boolean) => void }) => {
      input.setBusy(true);
      setError(null);
      const res = await fetch(input.url, input.init);
      if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`${res.status}: ${text}`);
      }
      return (await res.json()) as McpToolCatalogResponse;
    },
    []
  );

  const load = useCallback(async () => {
    const json = await fetchCatalog({
      url: "/api/mcp/tools",
      init: { credentials: "include" },
      setBusy: setLoading,
    });
    setData(json);
  }, [fetchCatalog]);

  const refresh = useCallback(async () => {
    try {
      const json = await fetchCatalog({
        url: "/api/mcp/tools/refresh",
        init: { method: "POST", credentials: "include" },
        setBusy: setRefreshing,
      });
      setData(json);
    } catch (e) {
      // Best-effort fallback: if refresh endpoint fails, do a normal reload.
      try {
        await load();
      } catch {
        setError(e as Error);
      }
    } finally {
      setRefreshing(false);
    }
  }, [fetchCatalog, load]);

  useEffect(() => {
    let cancelled = false;

    load()
      .catch((e) => {
        if (!cancelled) setError(e as Error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [load]);

  const tools = useMemo(() => data?.tools ?? [], [data]);

  return { data, tools, loading, error, refresh, refreshing };
}

