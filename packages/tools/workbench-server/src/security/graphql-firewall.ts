/**
 * packages/tools/workbench-server/src/security/graphql-firewall.ts
 * Minimal GraphQL query firewall (AST-based heuristics).
 *
 * NOTE: This does not replace provider-side cost analysis. It is a first line of defense
 * to reduce amplification and block obvious abuse (depth/aliases/selections/introspection).
 */
import {
  parse,
  type DocumentNode,
  type FragmentDefinitionNode,
  Kind,
  type OperationDefinitionNode,
  type SelectionSetNode,
} from 'graphql';

export type GraphqlOperationType = 'query' | 'mutation' | 'subscription';

export interface GraphqlFirewallLimits {
  maxDocumentChars: number;
  maxDepth: number;
  maxAliases: number;
  maxSelections: number;
  maxFragments: number;
}

export type GraphqlFirewallResult =
  | {
      ok: true;
      operationType: GraphqlOperationType;
      hasIntrospection: boolean;
      stats: { depth: number; aliases: number; selections: number; fragments: number };
      document: DocumentNode;
    }
  | { ok: false; reason: 'PARSE_ERROR' | 'INTROSPECTION_DISABLED' | 'LIMIT_EXCEEDED' };

export function analyzeGraphqlDocument(input: {
  query: string;
  operationName?: string;
  introspectionAllowed: boolean;
  limits: GraphqlFirewallLimits;
}): GraphqlFirewallResult {
  if (input.query.length > input.limits.maxDocumentChars) return { ok: false, reason: 'LIMIT_EXCEEDED' };

  let doc: DocumentNode;
  try {
    doc = parse(input.query);
  } catch {
    return { ok: false, reason: 'PARSE_ERROR' };
  }

  const ops = doc.definitions.filter((d): d is OperationDefinitionNode => d.kind === Kind.OPERATION_DEFINITION);
  if (ops.length === 1) {
    // eslint-disable-next-line prefer-destructuring -- clarity
    const op = ops[0];
    return analyzeOperation({ doc, op, input });
  }
  if (ops.length > 1) {
    const op = ops.find((o) => o.name?.value === input.operationName);
    if (!op) return { ok: false, reason: 'PARSE_ERROR' };
    return analyzeOperation({ doc, op, input });
  }
  return { ok: false, reason: 'PARSE_ERROR' };
}


function analyzeOperation(input: {
  doc: DocumentNode;
  op: OperationDefinitionNode;
  input: Parameters<typeof analyzeGraphqlDocument>[0];
}): GraphqlFirewallResult {
  const fragmentsByName = new Map<string, FragmentDefinitionNode>();
  for (const d of input.doc.definitions) {
    if (d.kind === Kind.FRAGMENT_DEFINITION) {
      fragmentsByName.set(d.name.value, d);
    }
  }

  const fragmentDefinitions = fragmentsByName.size;

  let maxDepth = 0;
  let aliases = 0;
  let selections = 0;
  let hasIntrospection = false;

  const stack = new Set<string>();

  function walkSelectionSet(selectionSet: SelectionSetNode, depth: number): void {
    if (depth > maxDepth) maxDepth = depth;
    for (const sel of selectionSet.selections) {
      if (sel.kind === Kind.FIELD) {
        selections += 1;
        if (sel.alias) aliases += 1;
        if (sel.name?.value === '__schema' || sel.name?.value === '__type') hasIntrospection = true;
        if (sel.selectionSet) walkSelectionSet(sel.selectionSet, depth + 1);
      } else if (sel.kind === Kind.INLINE_FRAGMENT) {
        walkSelectionSet(sel.selectionSet, depth + 1);
      } else if (sel.kind === Kind.FRAGMENT_SPREAD) {
        const name = sel.name?.value;
        if (typeof name !== 'string' || name.length === 0) continue;
        const frag = fragmentsByName.get(name);
        if (!frag) throw new Error('PARSE_ERROR');
        if (stack.has(name)) {
          // Cyclic fragments are invalid; treat as parse error to avoid unbounded recursion.
          throw new Error('PARSE_ERROR');
        }
        stack.add(name);
        walkSelectionSet(frag.selectionSet, depth + 1);
        stack.delete(name);
      }
    }
  }

  try {
    walkSelectionSet(input.op.selectionSet, 1);
  } catch {
    return { ok: false, reason: 'PARSE_ERROR' };
  }

  if (!input.input.introspectionAllowed && hasIntrospection) {
    return { ok: false, reason: 'INTROSPECTION_DISABLED' };
  }

  if (
    fragmentDefinitions > input.input.limits.maxFragments ||
    maxDepth > input.input.limits.maxDepth ||
    aliases > input.input.limits.maxAliases ||
    selections > input.input.limits.maxSelections
  ) {
    return { ok: false, reason: 'LIMIT_EXCEEDED' };
  }

  return {
    ok: true,
    operationType: input.op.operation,
    hasIntrospection,
    stats: { depth: maxDepth, aliases, selections, fragments: fragmentDefinitions },
    document: input.doc,
  };
}
