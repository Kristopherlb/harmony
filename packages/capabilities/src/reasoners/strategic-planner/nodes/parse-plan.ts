/**
 * packages/capabilities/src/reasoners/strategic-planner/nodes/parse-plan.ts
 *
 * Purpose: parse plan inputs (file/content/intent) into a deterministic ParsedPlan structure.
 *
 * Notes:
 * - Keep parsing minimal and deterministic (no network calls, no date/time).
 * - This is not a full markdown parser; it extracts stable fields used by later nodes.
 */
import { readFile } from 'node:fs/promises';

export type PlanSource =
  | { type: 'file'; path: string }
  | { type: 'content'; content: string }
  | { type: 'intent'; description: string; goals: string[]; constraints?: string[] };

export type ParsedPlan = {
  source: { type: PlanSource['type'] };
  format: 'markdown' | 'json' | 'intent';
  title: string;
  owner?: string;
  domain?: string;
  status?: string;
  intent: string;
  goals: string[];
  constraints: string[];
  phases: Array<{ id?: string; title?: string; tasks?: string[] }>;
  raw: { content: string };
};

export async function parsePlan(source: PlanSource): Promise<ParsedPlan> {
  if (source.type === 'intent') {
    return {
      source: { type: 'intent' },
      format: 'intent',
      title: 'Intent Plan',
      intent: source.description,
      goals: source.goals,
      constraints: source.constraints ?? [],
      phases: [],
      raw: { content: JSON.stringify(source) },
    };
  }

  const content =
    source.type === 'file' ? await readFile(source.path, 'utf8') : source.content;

  const trimmed = content.trimStart();
  if (looksLikeJson(trimmed)) {
    const obj = JSON.parse(trimmed) as Record<string, unknown>;
    return parseJsonPlan(source.type, content, obj);
  }

  return parseMarkdownPlan(source.type, content);
}

function looksLikeJson(value: string): boolean {
  const t = value.trimStart();
  return t.startsWith('{') || t.startsWith('[');
}

function parseJsonPlan(
  sourceType: 'file' | 'content',
  content: string,
  obj: Record<string, unknown>
): ParsedPlan {
  const title = typeof obj.title === 'string' ? obj.title : 'Untitled Plan';
  const intent = typeof obj.intent === 'string' ? obj.intent : '';
  const goals = Array.isArray(obj.goals) ? obj.goals.filter(isString) : [];
  const constraints = Array.isArray(obj.constraints) ? obj.constraints.filter(isString) : [];
  const phasesRaw = Array.isArray(obj.phases) ? obj.phases : [];

  const phases = phasesRaw
    .map((p) => (p && typeof p === 'object' ? (p as Record<string, unknown>) : null))
    .filter((p): p is Record<string, unknown> => p != null)
    .map((p) => ({
      id: typeof p.id === 'string' ? p.id : undefined,
      title: typeof p.title === 'string' ? p.title : undefined,
      tasks: Array.isArray(p.tasks) ? p.tasks.filter(isString) : undefined,
    }));

  return {
    source: { type: sourceType },
    format: 'json',
    title,
    owner: typeof obj.owner === 'string' ? obj.owner : undefined,
    domain: typeof obj.domain === 'string' ? obj.domain : undefined,
    status: typeof obj.status === 'string' ? obj.status : undefined,
    intent,
    goals,
    constraints,
    phases,
    raw: { content },
  };
}

function parseMarkdownPlan(sourceType: 'file' | 'content', content: string): ParsedPlan {
  const { frontmatter, body } = extractFrontmatter(content);

  const titleFromFm = asString(frontmatter.title);
  const owner = asString(frontmatter.owner);
  const domain = asString(frontmatter.domain);
  const status = asString(frontmatter.status);

  const title = titleFromFm ?? extractFirstHeading(body) ?? 'Untitled Plan';
  const intent = extractSectionText(body, 'Intent');
  const goals = extractBulletSection(body, 'Goals');
  const constraints = extractBulletSection(body, 'Constraints');

  // Minimal phase extraction: capture Phase headings and bullets beneath them.
  const phases = extractPhases(body);

  return {
    source: { type: sourceType },
    format: 'markdown',
    title,
    owner,
    domain,
    status,
    intent,
    goals,
    constraints,
    phases,
    raw: { content },
  };
}

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function extractFrontmatter(content: string): {
  frontmatter: Record<string, string>;
  body: string;
} {
  const lines = content.split(/\r?\n/);
  if (lines[0] !== '---') return { frontmatter: {}, body: content };

  const fm: Record<string, string> = {};
  let i = 1;
  for (; i < lines.length; i++) {
    if (lines[i] === '---') {
      i++;
      break;
    }
    const line = lines[i];
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const rawValue = line.slice(idx + 1).trim();
    const value = rawValue.replace(/^"(.*)"$/, '$1');
    if (key) fm[key] = value;
  }
  return { frontmatter: fm, body: lines.slice(i).join('\n') };
}

function extractFirstHeading(markdown: string): string | undefined {
  const m = markdown.match(/^#\s+(.+)$/m);
  return m?.[1]?.trim();
}

function extractSectionText(markdown: string, heading: string): string {
  const re = new RegExp(`^##\\s+${escapeRegExp(heading)}\\s*$([\\s\\S]*?)(^##\\s+|\\Z)`, 'm');
  const m = markdown.match(re);
  if (!m) return '';
  return m[1]
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('- '))
    .join(' ')
    .trim();
}

function extractBulletSection(markdown: string, heading: string): string[] {
  const re = new RegExp(`^##\\s+${escapeRegExp(heading)}\\s*$([\\s\\S]*?)(^##\\s+|\\Z)`, 'm');
  const m = markdown.match(re);
  if (!m) return [];
  return m[1]
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith('- '))
    .map((l) => l.replace(/^- /, '').trim())
    .filter((l) => l.length > 0);
}

function extractPhases(markdown: string): Array<{ id?: string; title?: string; tasks?: string[] }> {
  const lines = markdown.split(/\r?\n/);
  const phases: Array<{ title?: string; tasks: string[] }> = [];

  let current: { title?: string; tasks: string[] } | null = null;
  for (const line of lines) {
    const trimmed = line.trim();
    const phaseHeading = trimmed.match(/^###\s+(.*)$/);
    if (phaseHeading) {
      if (current) phases.push(current);
      current = { title: phaseHeading[1].trim(), tasks: [] };
      continue;
    }
    if (current && trimmed.startsWith('- ')) {
      current.tasks.push(trimmed.replace(/^- /, '').trim());
    }
  }
  if (current) phases.push(current);

  return phases.map((p) => ({ title: p.title, tasks: p.tasks.length > 0 ? p.tasks : undefined }));
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

