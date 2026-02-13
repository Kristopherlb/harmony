/**
 * tools/scripts/scaffold-improvement-entries.mjs
 *
 * Generate IMP-XXX table rows from retrospective recommendation bullets.
 *
 * Usage:
 *   node tools/scripts/scaffold-improvement-entries.mjs \
 *     --retro retrospectives/sessions/2026-02-10-workbench-m1-m3-agent-todos-retro.md \
 *     --source WORKBENCH-M1-M3-2026-02-10 \
 *     --start-id 60
 */
import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const out = {
    retroPath: '',
    source: '',
    startId: 1,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--retro') out.retroPath = String(argv[++i] ?? '');
    else if (a === '--source') out.source = String(argv[++i] ?? '');
    else if (a === '--start-id') out.startId = Number(argv[++i] ?? out.startId);
  }

  return out;
}

function cleanCell(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .replace(/^\[|\]$/g, '')
    .trim();
}

function parseRecommendationActions(markdown) {
  const lines = markdown.split(/\r?\n/);
  const actions = [];
  let inRecommendations = false;
  let inRecommendationTable = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^##\s+Recommendations\b/i.test(trimmed)) {
      inRecommendations = true;
      inRecommendationTable = false;
      continue;
    }
    if (inRecommendations && /^##\s+/.test(trimmed) && !/^##\s+Recommendations\b/i.test(trimmed)) {
      inRecommendations = false;
      inRecommendationTable = false;
      continue;
    }
    if (!inRecommendations) continue;

    if (/^###\s+(Immediate|Near-Term|Strategic)\b/i.test(trimmed)) {
      inRecommendationTable = true;
      continue;
    }
    if (/^###\s+/.test(trimmed) && !/^###\s+(Immediate|Near-Term|Strategic)\b/i.test(trimmed)) {
      inRecommendationTable = false;
      continue;
    }
    if (!inRecommendationTable) continue;

    if (!trimmed.startsWith('|')) continue;
    if (/^\|\s*Action\s*\|/i.test(trimmed)) continue;
    if (/^\|\s*-+\s*\|/.test(trimmed)) continue;

    const cols = trimmed
      .slice(1, -1)
      .split('|')
      .map((c) => c.trim());

    if (cols.length < 1) continue;
    const action = cleanCell(cols[0]);
    if (!action || action.toLowerCase() === 'action') continue;
    actions.push(action);
  }

  return [...new Set(actions)];
}

function impId(num) {
  return `IMP-${String(num).padStart(3, '0')}`;
}

function scaffoldRows(input) {
  const actions = parseRecommendationActions(input.markdown);
  let nextId = input.startId;

  const immediateRows = actions.map((action) => {
    const id = impId(nextId++);
    return `| ${id} | ${action} | ${input.source} | ⬜ |  |`;
  });

  nextId = input.startId;
  const impactRows = actions.map((action) => {
    const id = impId(nextId++);
    return `| ${id} | ${action} | _(pending)_ | ⬜ |`;
  });

  return { immediateRows, impactRows, count: actions.length };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.retroPath || !args.source || !Number.isFinite(args.startId) || args.startId <= 0) {
    // eslint-disable-next-line no-console
    console.error(
      'Usage: node tools/scripts/scaffold-improvement-entries.mjs --retro <path> --source <SOURCE-ID> --start-id <number>'
    );
    process.exit(1);
  }

  const retroAbs = path.resolve(process.cwd(), args.retroPath);
  if (!fs.existsSync(retroAbs)) {
    // eslint-disable-next-line no-console
    console.error(`Retro file not found: ${args.retroPath}`);
    process.exit(1);
  }

  const markdown = fs.readFileSync(retroAbs, 'utf8');
  const { immediateRows, impactRows, count } = scaffoldRows({
    markdown,
    source: args.source,
    startId: args.startId,
  });

  // eslint-disable-next-line no-console
  console.log(`# Scaffolded IMP rows (${count})`);
  // eslint-disable-next-line no-console
  console.log('\n## Immediate/Near-Term table rows\n');
  // eslint-disable-next-line no-console
  console.log(immediateRows.join('\n') || '_No recommendation actions found._');
  // eslint-disable-next-line no-console
  console.log('\n## Impact Tracking rows\n');
  // eslint-disable-next-line no-console
  console.log(impactRows.join('\n') || '_No recommendation actions found._');
}

export const __test = {
  parseArgs,
  parseRecommendationActions,
  scaffoldRows,
  impId,
};

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
