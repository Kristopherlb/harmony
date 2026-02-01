/**
 * packages/apps/console/client/src/features/workbench/required-fields.ts
 *
 * Helpers for deriving required input fields from MCP tool JSON schema and
 * computing missing/filled status against a node's properties.
 */
export type JsonSchemaObject = {
  type?: string;
  required?: string[];
  properties?: Record<string, unknown>;
};

export function asObjectSchema(schema: unknown): JsonSchemaObject | null {
  if (!schema || typeof schema !== "object") return null;
  const s = schema as any;
  if (s.type && s.type !== "object") return null;
  return {
    type: typeof s.type === "string" ? s.type : undefined,
    required: Array.isArray(s.required) ? (s.required as string[]) : undefined,
    properties:
      s.properties && typeof s.properties === "object"
        ? (s.properties as Record<string, unknown>)
        : undefined,
  };
}

export function isFilledValue(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  return true;
}

export function schemaRequiredKeys(inputSchema: unknown): string[] {
  const s = asObjectSchema(inputSchema);
  const required = s?.required ?? [];
  return required.filter((k) => typeof k === "string" && k.length > 0).sort();
}

export function missingRequiredKeys(input: {
  properties: Record<string, unknown> | undefined;
  required: string[];
}): string[] {
  const props = input.properties && typeof input.properties === "object" ? input.properties : {};
  return input.required
    .filter((k) => !Object.prototype.hasOwnProperty.call(props, k) || !isFilledValue(props[k]))
    .sort();
}

