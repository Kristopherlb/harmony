/**
 * packages/capabilities/src/utilities/json-yaml-transform.capability.ts
 * JSON/YAML Transform Capability (OCS-001 Transformer Pattern)
 *
 * Provides JSON/YAML conversion, jq-style queries, merging, validation, and formatting.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const operationSchema = z.enum([
  'json-to-yaml',
  'yaml-to-json',
  'jq-query',
  'merge',
  'validate',
  'format',
]).describe('Transform operation to perform');

const inputSchema = z
  .object({
    operation: operationSchema,
    data: z.string().describe('Input data (JSON or YAML string)'),
    query: z.string().optional().describe('jq-style query expression (required for jq-query operation)'),
    mergeWith: z.string().optional().describe('Data to merge with (required for merge operation)'),
    deep: z.boolean().optional().describe('Perform deep merge (for merge operation), defaults to true'),
    indent: z.number().int().min(0).max(8).optional().describe('Indentation spaces for output, defaults to 2'),
    sortKeys: z.boolean().optional().describe('Sort object keys alphabetically, defaults to false'),
  })
  .describe('JSON/YAML Transform input');

const outputSchema = z
  .object({
    data: z.string().describe('Transformed data'),
    inputFormat: z.enum(['json', 'yaml']).describe('Detected input format'),
    outputFormat: z.enum(['json', 'yaml', 'values']).describe('Output format'),
    isValid: z.boolean().optional().describe('Whether input is valid (for validate operation)'),
    errors: z.array(z.string()).optional().describe('Validation errors if any'),
    queryResults: z.array(z.unknown()).optional().describe('Query results (for jq-query operation)'),
  })
  .describe('JSON/YAML Transform output');

const configSchema = z
  .object({
    defaultIndent: z.number().int().min(0).max(8).optional().describe('Default indentation, defaults to 2'),
    defaultSortKeys: z.boolean().optional().describe('Default key sorting, defaults to false'),
  })
  .describe('JSON/YAML Transform configuration');

const secretsSchema = z.object({}).describe('JSON/YAML Transform secrets - none required');

export type JsonYamlTransformInput = z.infer<typeof inputSchema>;
export type JsonYamlTransformOutput = z.infer<typeof outputSchema>;
export type JsonYamlTransformConfig = z.infer<typeof configSchema>;
export type JsonYamlTransformSecrets = z.infer<typeof secretsSchema>;

export const jsonYamlTransformCapability: Capability<
  JsonYamlTransformInput,
  JsonYamlTransformOutput,
  JsonYamlTransformConfig,
  JsonYamlTransformSecrets
> = {
  metadata: {
    id: 'golden.utilities.json-yaml-transform',
    version: '1.0.0',
    name: 'jsonYamlTransform',
    description:
      'JSON/YAML transformations including format conversion, jq-style queries, deep merging, validation, and pretty formatting.',
    tags: ['transformer', 'utilities', 'json', 'yaml', 'jq'],
    maintainer: 'platform',
  },
  schemas: {
    input: inputSchema,
    output: outputSchema,
    config: configSchema,
    secrets: secretsSchema,
  },
  security: {
    requiredScopes: [],
    dataClassification: 'INTERNAL',
    networkAccess: {
      allowOutbound: [], // Pure transformer - no network access
    },
  },
  operations: {
    isIdempotent: true,
    retryPolicy: { maxAttempts: 1, initialIntervalSeconds: 1, backoffCoefficient: 1 },
    errorMap: (error: unknown) => {
      if (error instanceof Error) {
        if (error.message.includes('parse')) return 'FATAL';
        if (error.message.includes('invalid')) return 'FATAL';
      }
      return 'FATAL';
    },
    costFactor: 'LOW',
  },
  aiHints: {
    exampleInput: {
      operation: 'jq-query',
      data: '{"users": [{"name": "Alice", "age": 30}, {"name": "Bob", "age": 25}]}',
      query: '.users[] | select(.age > 26) | .name',
      deep: true,
      indent: 2,
      sortKeys: false,
    },
    exampleOutput: {
      data: '"Alice"',
      inputFormat: 'json',
      outputFormat: 'values',
      queryResults: ['Alice'],
    },
    usageNotes:
      'Use jq-query for extracting and transforming data using jq syntax. Use merge for combining configuration files. Validate to check syntax before processing.',
  },
  factory: (
    dag,
    context: CapabilityContext<JsonYamlTransformConfig, JsonYamlTransformSecrets>,
    input: JsonYamlTransformInput
  ) => {
    type ContainerBuilder = {
      from(image: string): ContainerBuilder;
      withEnvVariable(key: string, value: string): ContainerBuilder;
      withExec(args: string[]): unknown;
    };
    type DaggerClient = { container(): ContainerBuilder };
    const d = dag as unknown as DaggerClient;

    const indent = input.indent ?? context.config.defaultIndent ?? 2;
    const sortKeys = input.sortKeys ?? context.config.defaultSortKeys ?? false;

    const payload = {
      operation: input.operation,
      data: input.data,
      query: input.query,
      mergeWith: input.mergeWith,
      deep: input.deep ?? true,
      indent,
      sortKeys,
    };

    return d
      .container()
      .from('node:20-alpine')
      .withEnvVariable('INPUT_JSON', JSON.stringify(payload))
      .withEnvVariable('OPERATION', input.operation)
      .withEnvVariable('JQ_QUERY', input.query ?? '')
      .withExec([
        'sh',
        '-c',
        `
npm install --no-save js-yaml jq-web 2>/dev/null && node -e '
const yaml = require("js-yaml");
const jq = require("jq-web");
const input = JSON.parse(process.env.INPUT_JSON);

// Detect if input is JSON or YAML
function detectFormat(data) {
  try {
    JSON.parse(data);
    return "json";
  } catch {
    return "yaml";
  }
}

// Parse input data to object
function parseData(data) {
  const format = detectFormat(data);
  if (format === "json") {
    return { parsed: JSON.parse(data), format: "json" };
  }
  return { parsed: yaml.load(data), format: "yaml" };
}

// Sort object keys recursively
function sortObjectKeys(obj) {
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }
  if (obj !== null && typeof obj === "object") {
    return Object.keys(obj).sort().reduce((acc, key) => {
      acc[key] = sortObjectKeys(obj[key]);
      return acc;
    }, {});
  }
  return obj;
}

// Deep merge objects
function deepMerge(target, source) {
  const output = { ...target };
  for (const key in source) {
    if (source[key] instanceof Object && key in target && target[key] instanceof Object) {
      output[key] = deepMerge(target[key], source[key]);
    } else {
      output[key] = source[key];
    }
  }
  return output;
}

async function run() {
  const { parsed, format: inputFormat } = parseData(input.data);
  let result = { inputFormat };
  let outputObj = parsed;
  
  if (input.sortKeys) {
    outputObj = sortObjectKeys(outputObj);
  }
  
  switch (input.operation) {
    case "json-to-yaml": {
      result.data = yaml.dump(outputObj, { indent: input.indent, sortKeys: input.sortKeys });
      result.outputFormat = "yaml";
      break;
    }
    case "yaml-to-json": {
      result.data = JSON.stringify(outputObj, null, input.indent);
      result.outputFormat = "json";
      break;
    }
    case "jq-query": {
      if (!input.query) {
        throw new Error("query is required for jq-query operation");
      }
      const queryResult = jq.json(parsed, input.query);
      result.queryResults = Array.isArray(queryResult) ? queryResult : [queryResult];
      result.data = JSON.stringify(queryResult, null, input.indent);
      result.outputFormat = "values";
      break;
    }
    case "merge": {
      if (!input.mergeWith) {
        throw new Error("mergeWith is required for merge operation");
      }
      const { parsed: mergeData } = parseData(input.mergeWith);
      const merged = input.deep ? deepMerge(parsed, mergeData) : { ...parsed, ...mergeData };
      result.data = JSON.stringify(merged, null, input.indent);
      result.outputFormat = "json";
      break;
    }
    case "validate": {
      result.isValid = true;
      result.errors = [];
      result.data = JSON.stringify(parsed, null, input.indent);
      result.outputFormat = "json";
      break;
    }
    case "format": {
      if (inputFormat === "yaml") {
        result.data = yaml.dump(outputObj, { indent: input.indent, sortKeys: input.sortKeys });
        result.outputFormat = "yaml";
      } else {
        result.data = JSON.stringify(outputObj, null, input.indent);
        result.outputFormat = "json";
      }
      break;
    }
  }
  
  process.stdout.write(JSON.stringify(result));
}

run().catch(err => {
  if (input.operation === "validate") {
    process.stdout.write(JSON.stringify({
      inputFormat: "unknown",
      outputFormat: "json",
      isValid: false,
      errors: [err.message],
      data: "",
    }));
  } else {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  }
});
'
        `.trim(),
      ]);
  },
};
