import mcpServer from "@golden/mcp-server";
import type { McpTool, ToolCatalog, ToolManifest, ToolManifestEntry, ToolSurface } from "@golden/mcp-server";
import capabilities from "@golden/capabilities";
import type { CapabilityRegistry } from "@golden/capabilities";
import { readFileSync } from "node:fs";
import path from "node:path";

export interface ToolCatalogTool extends McpTool {
  type: ToolManifestEntry["type"];
  dataClassification: ToolManifestEntry["data_classification"];
  domain?: ToolManifestEntry["domain"];
  subdomain?: ToolManifestEntry["subdomain"];
  tags?: ToolManifestEntry["tags"];
  maintainer?: ToolManifestEntry["maintainer"];
  requiredScopes?: ToolManifestEntry["requiredScopes"];
  allowOutbound?: ToolManifestEntry["allowOutbound"];
  isIdempotent?: ToolManifestEntry["isIdempotent"];
  costFactor?: ToolManifestEntry["costFactor"];
}

export interface ToolCatalogSnapshot {
  manifest: Pick<ToolManifest, "generated_at" | "version">;
  tools: ToolCatalogTool[];
}

export class HarmonyMcpToolService {
  private readonly registry: CapabilityRegistry;
  private manifest: ToolManifest;
  private toolSurface: ToolSurface;
  private readonly version: string;
  private readonly includeBlueprints: boolean;
  private lastGeneratedAtMs = 0;

  private loadCatalogArtifact(): ToolCatalog | undefined {
    const candidates = [
      // Monorepo dev/runtime (repo-root cwd)
      path.resolve(process.cwd(), "packages/tools/mcp-server/src/manifest/tool-catalog.json"),
      // Built package / installed dependency (best-effort)
      path.resolve(process.cwd(), "node_modules/@golden/mcp-server/src/manifest/tool-catalog.json"),
    ];

    for (const p of candidates) {
      try {
        const raw = readFileSync(p, "utf-8");
        return JSON.parse(raw) as ToolCatalog;
      } catch {
        // ignore; try next candidate
      }
    }
    return undefined;
  }

  constructor(input?: { includeBlueprints?: boolean; version?: string }) {
    this.registry = capabilities.createCapabilityRegistry();
    this.version = input?.version ?? "1";
    this.includeBlueprints = input?.includeBlueprints ?? true;

    // Initialize state once so listTools() works immediately.
    // We intentionally set generated_at to "when this service built the snapshot",
    // not "when the artifact was originally generated", because the UI needs freshness
    // relative to the running process.
    this.manifest = { generated_at: "1970-01-01T00:00:00.000Z", version: this.version, tools: [] };
    this.toolSurface = mcpServer.createToolSurface({ manifest: this.manifest, traceId: () => `console-${Date.now()}` });
    this.refresh();
  }

  private nextGeneratedAtIso(): string {
    const now = Date.now();
    // Ensure `generated_at` is strictly increasing even if refresh is called rapidly.
    const next = now <= this.lastGeneratedAtMs ? this.lastGeneratedAtMs + 1 : now;
    this.lastGeneratedAtMs = next;
    return new Date(next).toISOString();
  }

  private buildManifest(): ToolManifest {
    const version = this.version;
    const includeBlueprints = this.includeBlueprints;

    // Source of truth: deterministic artifact (generated in CI). Fallback: runtime generation.
    const artifact = this.loadCatalogArtifact();
    if (artifact && artifact.version === version) {
      return {
        generated_at: this.nextGeneratedAtIso(),
        version: artifact.version,
        tools: artifact.tools,
      };
    }

    const catalog = mcpServer.generateToolCatalog({ registry: this.registry, version, includeBlueprints });
    return {
      generated_at: this.nextGeneratedAtIso(),
      version: catalog.version,
      tools: catalog.tools,
    };
  }

  refresh(): ToolCatalogSnapshot {
    this.manifest = this.buildManifest();
    this.toolSurface = mcpServer.createToolSurface({
      manifest: this.manifest,
      traceId: () => `console-${Date.now()}`,
    });
    return this.snapshot();
  }

  listTools(): McpTool[] {
    return this.toolSurface.listTools();
  }

  listToolCatalog(): ToolCatalogTool[] {
    const mcpTools = this.listTools();
    const metaById = new Map<
      string,
      Pick<
        ToolManifestEntry,
        | "type"
        | "data_classification"
        | "domain"
        | "subdomain"
        | "tags"
        | "maintainer"
        | "requiredScopes"
        | "allowOutbound"
        | "isIdempotent"
        | "costFactor"
      >
    >();
    for (const entry of this.manifest.tools) {
      metaById.set(entry.id, {
        type: entry.type,
        data_classification: entry.data_classification,
        domain: entry.domain,
        subdomain: entry.subdomain,
        tags: entry.tags,
        maintainer: entry.maintainer,
        requiredScopes: entry.requiredScopes,
        allowOutbound: entry.allowOutbound,
        isIdempotent: entry.isIdempotent,
        costFactor: entry.costFactor,
      });
    }

    return mcpTools.map((t) => {
      const meta = metaById.get(t.name);
      return {
        ...t,
        type: meta?.type ?? "CAPABILITY",
        dataClassification: meta?.data_classification ?? "INTERNAL",
        domain: meta?.domain,
        subdomain: meta?.subdomain,
        tags: meta?.tags,
        maintainer: meta?.maintainer,
        requiredScopes: meta?.requiredScopes,
        allowOutbound: meta?.allowOutbound,
        isIdempotent: meta?.isIdempotent,
        costFactor: meta?.costFactor,
      };
    });
  }

  getManifestMeta(): Pick<ToolManifest, "generated_at" | "version"> {
    return { generated_at: this.manifest.generated_at, version: this.manifest.version };
  }

  snapshot(): ToolCatalogSnapshot {
    return { manifest: this.getManifestMeta(), tools: this.listToolCatalog() };
  }
}

