import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runContractVerification } from './contract-runner.js';
import { detectSchemaDrift, generateSchemaSnapshot, loadSchemaBaseline, writeSchemaBaseline } from './schema-drift.js';
import { generateOscalComponentDefinition, stableOscalString } from './oscal-generator.js';

const command = process.argv[2];

async function main() {
  switch (command) {
    case 'check':
      await runCheck();
      break;
    case 'write-baseline':
      await runWriteBaseline();
      break;
    case 'oscal':
      await runOscal();
      break;
    default:
      console.error('Usage: golden-certify <check|write-baseline|oscal>');
      process.exit(1);
  }
}

async function runCheck() {
  const contract = runContractVerification();
  if (contract.failures.length > 0) {
    contract.failures.forEach((failure) => {
      console.error(`[contract] ${failure.id} (${failure.area}): ${failure.message}`);
    });
    process.exit(1);
  }

  const snapshot = generateSchemaSnapshot({ version: '1.0.0' });
  const baseline = await loadSchemaBaseline();
  const drift = detectSchemaDrift(snapshot, baseline);
  if (drift.length > 0) {
    drift.forEach((entry) => {
      console.error(`[schema-drift] ${entry.kind}:${entry.id}: ${entry.change}`);
    });
    process.exit(1);
  }

  const definition = generateOscalComponentDefinition({ version: '1.0.0' });
  const outDir = resolve(process.cwd(), 'dist', 'certification');
  await mkdir(outDir, { recursive: true });
  await writeFile(resolve(outDir, 'oscal-component-definition.json'), `${stableOscalString(definition)}\n`, 'utf-8');
  console.log('OK: certification checks passed.');
}

async function runWriteBaseline() {
  const snapshot = generateSchemaSnapshot({ version: '1.0.0' });
  await writeSchemaBaseline(snapshot);
  console.log('OK: schema baseline written.');
}

async function runOscal() {
  const definition = generateOscalComponentDefinition({ version: '1.0.0' });
  const outDir = resolve(process.cwd(), 'dist', 'certification');
  await mkdir(outDir, { recursive: true });
  await writeFile(resolve(outDir, 'oscal-component-definition.json'), `${stableOscalString(definition)}\n`, 'utf-8');
  console.log('OK: OSCAL component definition generated.');
}

void main();
