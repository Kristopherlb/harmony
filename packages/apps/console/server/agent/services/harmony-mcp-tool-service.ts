import {
  createToolSurface,
  generateToolManifestFromCapabilities,
  type McpTool,
  type ToolManifest,
  type ToolManifestEntry,
  type ToolSurface,
} from "@golden/mcp-server";
import { createCapabilityRegistry, type CapabilityRegistry } from "@golden/capabilities";

export interface ToolCatalogTool extends McpTool {
  type: ToolManifestEntry["type"];
  dataClassification: ToolManifestEntry["data_classification"];
}

export interface ToolCatalogSnapshot {
  manifest: Pick<ToolManifest, "generated_at" | "version">;
  tools: ToolCatalogTool[];
}

export class HarmonyMcpToolService {
  private readonly registry: CapabilityRegistry;
  private readonly manifest: ToolManifest;
  private readonly toolSurface: ToolSurface;

  constructor(input?: { includeBlueprints?: boolean; version?: string }) {
    this.registry = createCapabilityRegistry();
    this.manifest = generateToolManifestFromCapabilities({
      registry: this.registry,
      generated_at: new Date().toISOString(),
      version: input?.version ?? "1",
      includeBlueprints: input?.includeBlueprints ?? true,
    });
    this.toolSurface = createToolSurface({
      manifest: this.manifest,
      traceId: () => `console-${Date.now()}`,
    });
  }

  listTools(): McpTool[] {
    return this.toolSurface.listTools();
  }

  listToolCatalog(): ToolCatalogTool[] {
    const mcpTools = this.listTools();
    const metaById = new Map<string, Pick<ToolManifestEntry, "type" | "data_classification">>();
    for (const entry of this.manifest.tools) {
      metaById.set(entry.id, { type: entry.type, data_classification: entry.data_classification });
    }

    return mcpTools.map((t) => {
      const meta = metaById.get(t.name);
      return {
        ...t,
        type: meta?.type ?? "CAPABILITY",
        dataClassification: meta?.data_classification ?? "INTERNAL",
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

