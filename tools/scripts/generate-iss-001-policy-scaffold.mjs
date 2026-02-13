/**
 * tools/scripts/generate-iss-001-policy-scaffold.mjs
 *
 * Generate least-priv OpenBao policy + AppRole scaffold from discovered ISS-001 secret refs.
 *
 * Usage:
 *   node tools/scripts/generate-iss-001-policy-scaffold.mjs
 *   node tools/scripts/generate-iss-001-policy-scaffold.mjs --mount secret --policy-name console-staging-read-secrets --role-name console-staging
 *   node tools/scripts/generate-iss-001-policy-scaffold.mjs --out ./tmp/openbao-scaffold.md
 */
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_SOURCES = [
  'runbooks/openbao-least-priv-staging.md',
  'runbooks/release-staging-validation.md',
  'runbooks/deploy-staging-validation.md',
  'tools/scripts/release-staging-validate.mjs',
  'tools/scripts/deploy-staging-blue-green-validate.mjs',
];

function parseArgs(argv) {
  const out = {
    mount: 'secret',
    policyName: 'console-staging-read-secrets',
    roleName: 'console-staging',
    outputPath: '',
    json: false,
    sources: [...DEFAULT_SOURCES],
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--mount') out.mount = String(argv[++i] ?? out.mount);
    else if (a === '--policy-name') out.policyName = String(argv[++i] ?? out.policyName);
    else if (a === '--role-name') out.roleName = String(argv[++i] ?? out.roleName);
    else if (a === '--out') out.outputPath = String(argv[++i] ?? '');
    else if (a === '--json') out.json = true;
    else if (a === '--source') out.sources.push(String(argv[++i] ?? ''));
  }

  out.sources = out.sources.filter((s) => s.trim().length > 0);
  return out;
}

function normalizeSecretRef(ref) {
  return ref.trim().replace(/[),.;'"`]+$/g, '');
}

function extractSecretRefs(text) {
  const regex = /\/artifacts\/[A-Za-z0-9._/-]+/g;
  const matches = text.match(regex) ?? [];
  return matches.map(normalizeSecretRef);
}

function uniqSorted(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function toKvV2DataPath(mount, ref) {
  const rel = ref.replace(/^\/+/, '');
  return `${mount}/data/${rel}`;
}

function renderHclPolicy(mount, refs) {
  return refs
    .map((ref) => {
      const p = toKvV2DataPath(mount, ref);
      return `path "${p}" {\n  capabilities = ["read"]\n}`;
    })
    .join('\n\n');
}

function renderMarkdownScaffold(opts) {
  const hcl = renderHclPolicy(opts.mount, opts.refs);
  return `# ISS-001 OpenBao least-priv scaffold

Generated from:
${opts.sources.map((s) => `- \`${s}\``).join('\n')}

## Secret refs discovered
${opts.refs.map((r) => `- \`${r}\``).join('\n')}

## Policy (HCL)

\`\`\`hcl
${hcl}
\`\`\`

## AppRole scaffold (operator steps)

\`\`\`bash
# 1) Write policy
cat > /tmp/${opts.policyName}.hcl <<'EOF'
${hcl}
EOF
bao policy write ${opts.policyName} /tmp/${opts.policyName}.hcl

# 2) Create/Update AppRole
bao write auth/approle/role/${opts.roleName} token_policies=${opts.policyName}

# 3) Fetch Role ID
bao read auth/approle/role/${opts.roleName}/role-id

# 4) Generate Secret ID
bao write -f auth/approle/role/${opts.roleName}/secret-id
\`\`\`
`;
}

function readExistingFiles(repoRoot, sources) {
  const contents = [];
  const seen = [];
  for (const rel of sources) {
    const abs = path.resolve(repoRoot, rel);
    if (!fs.existsSync(abs)) continue;
    seen.push(rel);
    contents.push(fs.readFileSync(abs, 'utf8'));
  }
  return { seen, text: contents.join('\n') };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const { seen, text } = readExistingFiles(repoRoot, args.sources);
  const refs = uniqSorted(extractSecretRefs(text));

  const payload = {
    mount: args.mount,
    policyName: args.policyName,
    roleName: args.roleName,
    refs,
    sources: seen,
  };

  const output = args.json ? JSON.stringify(payload, null, 2) : renderMarkdownScaffold(payload);
  if (args.outputPath) {
    const outAbs = path.resolve(repoRoot, args.outputPath);
    fs.writeFileSync(outAbs, output, 'utf8');
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ ok: true, outputPath: args.outputPath, refs: refs.length }));
    return;
  }
  // eslint-disable-next-line no-console
  console.log(output);
}

export const __test = {
  parseArgs,
  extractSecretRefs,
  renderHclPolicy,
  toKvV2DataPath,
};

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

