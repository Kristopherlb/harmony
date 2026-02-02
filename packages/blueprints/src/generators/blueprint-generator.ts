/**
 * packages/blueprints/src/generators/blueprint-generator.ts
 * Generator for scaffolding new Blueprints.
 * IMP-017: Supports input_mapping for deterministic constants.
 */
import { z } from '@golden/schema-registry';

const fieldSchema = z.object({
    type: z.enum(['string', 'number', 'boolean', 'record', 'array']),
    description: z.string().optional(),
    optional: z.boolean().default(false),
    // IMP-017: Constant value support
    constant: z.union([z.string(), z.number(), z.boolean()]).optional(),
});

export const blueprintGeneratorSchema = z.object({
    name: z.string().describe('Name of the blueprint (kebab-case)'),
    description: z.string().describe('Description of the workflow'),
    domain: z.string().describe('Domain (e.g., incident, security)'),
    inputs: z.record(fieldSchema).describe('Input fields definition'),
});

export type BlueprintGeneratorInput = z.infer<typeof blueprintGeneratorSchema>;

export function generateBlueprintSource(input: BlueprintGeneratorInput): string {
    const camelName = toCamelCase(input.name);
    const pascalName = capitalize(camelName);

    const renderFields = (fields: Record<string, z.infer<typeof fieldSchema>>) => {
        return Object.entries(fields)
            .filter(([_, v]) => v.constant === undefined) // Exclude constants from Schema
            .map(([k, v]) => {
                let zodType = `z.${v.type}()`;
                if (v.type === 'record') zodType = 'z.record(z.unknown())';
                if (v.type === 'array') zodType = 'z.array(z.unknown())';
                const desc = v.description ? `.describe('${v.description}')` : '';
                const opt = v.optional ? `.optional()` : '';
                return `${k}: ${zodType}${desc}${opt},`;
            })
            .join('\n    ');
    };

    const renderConstants = (fields: Record<string, z.infer<typeof fieldSchema>>) => {
        const constants = Object.entries(fields)
            .filter(([_, v]) => v.constant !== undefined);

        if (constants.length === 0) return '';

        return `// Constants (IMP-017)
    const constants = {
      ${constants.map(([k, v]) => `${k}: ${JSON.stringify(v.constant)}`).join(',\n      ')}
    };`;
    };

    return `/**
 * Generated Blueprint: ${input.name}
 * Domain: ${input.domain}
 */
import { z } from '@golden/schema-registry';
import { defineBlueprint } from '../../descriptors/blueprint';

const inputSchema = z.object({
    ${renderFields(input.inputs)}
});

export const ${camelName}Blueprint = defineBlueprint({
  domain: '${input.domain}',
  name: '${input.name}',
  description: '${input.description}',
  input: inputSchema,
  output: z.object({ success: z.boolean() }),
  exampleInput: {}, // TODO: Populate example
  resolve: async (ctx, input) => {
    ${renderConstants(input.inputs)}
    
    // Workflow logic here
    return { success: true };
  },
});
`;
}

function toCamelCase(s: string) {
    return s.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
}

function capitalize(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
