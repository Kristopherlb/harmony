/**
 * tools/scripts/generate-github-introspection.mjs
 *
 * Generate GraphQL introspection JSON from local GitHub SDL.
 *
 * Usage:
 *   node tools/scripts/generate-github-introspection.mjs
 *
 * Output:
 *   writes spec/github.schema.introspection.json
 */
import { readFile, writeFile } from 'node:fs/promises';
import { buildSchema, graphql, getIntrospectionQuery } from 'graphql';

const inPath = new URL('../../spec/github.schema.docs.graphql', import.meta.url);
const outPath = new URL('../../spec/github.schema.introspection.json', import.meta.url);

const sdl = await readFile(inPath, 'utf8');
const schema = buildSchema(sdl);
const result = await graphql({
  schema,
  source: getIntrospectionQuery(),
});

if (result.errors && result.errors.length > 0) {
  // Keep output compact; do not dump large error objects.
  throw new Error('Failed to generate introspection result (schema parse or execution error).');
}

await writeFile(outPath, JSON.stringify({ data: result.data }, null, 2) + '\n', 'utf8');
process.stdout.write(`Wrote ${outPath.pathname}\n`);

