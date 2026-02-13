/**
 * packages/blueprints/src/workflows/system/workbench-draft-run.logic.ts
 * Pure helpers for running a Workbench BlueprintDraft deterministically.
 */
import type { BlueprintDraft, BlueprintNode } from '@golden/core';

const PRIMITIVE_NODE_TYPES = new Set(['start', 'sleep', 'log', 'condition']);

export function isPrimitiveNodeType(type: string): boolean {
  return PRIMITIVE_NODE_TYPES.has(type);
}

/**
 * Deterministic execution order for a draft.
 *
 * - Uses a stable topological sort derived from edges.
 * - Uses the original `draft.nodes` order as a tie-breaker.
 * - If edges are cyclic or reference missing nodes, falls back to draft order.
 */
export function deriveDraftExecutionOrder(draft: BlueprintDraft): BlueprintNode[] {
  const nodes = Array.isArray(draft.nodes) ? draft.nodes : [];
  const edges = Array.isArray(draft.edges) ? draft.edges : [];

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const indexById = new Map(nodes.map((n, i) => [n.id, i]));

  const indegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();

  for (const n of nodes) {
    indegree.set(n.id, 0);
    outgoing.set(n.id, []);
  }

  for (const e of edges) {
    const src = e?.source;
    const tgt = e?.target;
    if (typeof src !== 'string' || typeof tgt !== 'string') continue;
    if (!byId.has(src) || !byId.has(tgt)) continue;
    outgoing.get(src)!.push(tgt);
    indegree.set(tgt, (indegree.get(tgt) ?? 0) + 1);
  }

  const ready: string[] = [];
  for (const [id, deg] of indegree) {
    if (deg === 0) ready.push(id);
  }
  ready.sort((a, b) => (indexById.get(a) ?? 0) - (indexById.get(b) ?? 0));

  const out: BlueprintNode[] = [];
  let cursor = 0;
  while (cursor < ready.length) {
    const id = ready[cursor++];
    const n = byId.get(id);
    if (n) out.push(n);
    const nexts = outgoing.get(id) ?? [];
    for (const to of nexts) {
      indegree.set(to, (indegree.get(to) ?? 0) - 1);
      if ((indegree.get(to) ?? 0) === 0) {
        ready.push(to);
      }
    }
    // Keep deterministic ordering for newly-ready nodes.
    ready
      .slice(cursor)
      .sort((a, b) => (indexById.get(a) ?? 0) - (indexById.get(b) ?? 0))
      .forEach((id2, i) => {
        ready[cursor + i] = id2;
      });
  }

  // If we didn't schedule all nodes, we likely had a cycle; fall back to draft order.
  if (out.length !== nodes.length) return nodes.slice();
  return out;
}

