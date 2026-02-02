/**
 * packages/blueprints/src/generators/domain-generator.ts
 * IMP-006: Auto-generate capability from specification.
 */
import { z } from '@golden/schema-registry';

export const fieldSchema = z.object({
  type: z.enum(['string', 'number', 'boolean', 'record', 'array']),
  description: z.string().optional(),
  optional: z.boolean().default(false),
});

export const domainGeneratorSchema = z.object({
  name: z.string().describe('Name of the capability'),
  description: z.string().describe('Description of functionality'),
  domain: z.string().describe('Domain/category (e.g., security, auth)'),
  operations: z.array(z.string()).describe('List of supported operations'),
  inputs: z.record(fieldSchema).describe('Input fields key->def'),
  outputs: z.record(fieldSchema).describe('Output fields key->def'),
});

export type DomainGeneratorInput = z.infer<typeof domainGeneratorSchema>;

export function generateCapabilitySource(input: DomainGeneratorInput): string {
  const operationsEnum = input.operations.map((op) => `'${op}'`).join(', ');

  const renderFields = (fields: Record<string, z.infer<typeof fieldSchema>>) => {
    return Object.entries(fields)
      .map(([k, v]) => {
        let zodType = `z.${v.type}()`;
        if (v.type === 'record') zodType = 'z.record(z.unknown())';
        if (v.type === 'array') zodType = 'z.array(z.unknown())';
        const desc = v.description ? `.describe('${v.description}')` : '';
        const opt = v.optional ? `.optional()` : '';
        return `${k}: ${zodType}${desc}${opt},`;
      })
      .join('\n  ');
  };

  return `/**
 * Generated Capability: ${input.name}
 * Domain: ${input.domain}
 * Description: ${input.description}
 */
import { z } from '@golden/schema-registry';
import type { Capability } from '@golden/core';

const operationSchema = z.enum([${operationsEnum}]).describe('${input.name} operation');

const inputSchema = z.object({
  operation: operationSchema,
  ${renderFields(input.inputs)}
});

const outputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  metadata: z.record(z.unknown()).optional(),
  ${renderFields(input.outputs)}
});

export type ${capitalize(input.name)}Input = z.infer<typeof inputSchema>;
export type ${capitalize(input.name)}Output = z.infer<typeof outputSchema>;

export const ${input.name}Capability: Capability<${capitalize(input.name)}Input, ${capitalize(input.name)}Output, void, void> = {
  metadata: {
    id: 'golden.${input.domain}.${input.name}',
    version: '1.0.0',
    name: '${input.name}',
    description: '${input.description}',
    tags: ['${input.domain}', 'generated'],
    maintainer: 'platform',
  },
  schemas: {
    input: inputSchema,
    output: outputSchema,
    config: z.void(),
    secrets: z.void(),
  },
  security: {
    requiredScopes: ['${input.domain}:read'],
    dataClassification: 'INTERNAL',
    networkAccess: { allowOutbound: [] },
  },
  operations: {
    isIdempotent: false,
    retryPolicy: { maxAttempts: 3, initialIntervalSeconds: 1, backoffCoefficient: 2 },
    errorMap: () => 'FATAL',
    costFactor: 'LOW',
  },
  aiHints: {
    usageNotes: 'Auto-generated capability.',
    exampleInput: { operation: '${input.operations[0]}' } as any,
    exampleOutput: { success: true, message: 'Success' } as any,
  },
  factory: (dag, context, input) => {
    const d = dag as any;
    return d.container()
      .from('alpine:latest')
      .withExec(['echo', JSON.stringify({ success: true, message: \`Executed \${input.operation}\` })]);
  }
};
`;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
