/**
 * packages/tools/mcp-server/src/manifest/cdm-001-strict-domain.test.ts
 * CI gate: require explicit metadata.domain on source definitions (with temporary allowlist).
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { getRepoRoot } from '@golden/core';

type Allowlist = {
  capabilities?: string[];
  blueprints?: string[];
};

function readAllowlist(): Required<Allowlist> {
  // Policy files are centralized at repo root.
  const repoRoot = getRepoRoot();
  const p = path.resolve(repoRoot, 'policies/cdm-001-domain-allowlist.json');
  const raw = readFileSync(p, 'utf-8');
  const parsed = JSON.parse(raw) as Allowlist;
  return {
    capabilities: Array.isArray(parsed.capabilities) ? parsed.capabilities : [],
    blueprints: Array.isArray(parsed.blueprints) ? parsed.blueprints : [],
  };
}

describe('CDM-001 strict domain (source-level)', () => {
  it('requires metadata.domain unless allowlisted', async () => {
    // Some tests intentionally mock @golden/blueprints; ensure we use the real registries here.
    vi.resetModules();
    vi.unmock('@golden/blueprints');
    vi.unmock('@golden/capabilities');

    const { createCapabilityRegistry } = await import('@golden/capabilities');
    const { createBlueprintRegistry } = await import('@golden/blueprints');

    const allow = readAllowlist();
    const capAllow = new Set(allow.capabilities);
    const bpAllow = new Set(allow.blueprints);

    const caps = createCapabilityRegistry();
    for (const cap of caps.values()) {
      if (!cap.metadata.domain) {
        expect(capAllow.has(cap.metadata.id)).toBe(true);
        continue;
      }
      // When declared, tags must include domain.
      expect(cap.metadata.tags).toContain(cap.metadata.domain);
    }

    const bps = createBlueprintRegistry();
    for (const entry of bps.values()) {
      const meta = (entry.descriptor as any)?.metadata as any;
      const domain = meta?.domain as string | undefined;
      if (!domain) {
        expect(bpAllow.has(entry.blueprintId)).toBe(true);
        continue;
      }
      const tags = meta?.tags as unknown;
      if (Array.isArray(tags)) expect(tags).toContain(domain);
    }
  });
});

