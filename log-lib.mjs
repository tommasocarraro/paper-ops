// log-lib.mjs — shared by check-log.mjs, build-log.mjs and log-snapshot.mjs.
//
// A project is projects/{name}/ with project.yml, log/*.md and questions/RQ*.md.
// Each log entry is YAML frontmatter (a small subset: maps, lists, inline
// [a, b] lists, scalars) followed by a markdown body whose `## ` headings are
// fixed per type. The log is the complete, append-only history; a question
// file is the current version of one research question, and every change to
// it is a `question` entry in the log.

import { readFileSync, readdirSync, existsSync, statSync, createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';

export const TYPES = {
  experiment: { required: ['Question', 'Setup', 'Result', "Author's reading"], numbers: ['Result'] },
  decision: { required: ['Context', 'Options considered', 'Decision', 'Why', 'Consequences'] },
  design: { required: ['What', 'Why', 'Alternatives', 'Affects'] },
  dataset: { required: ['Source', 'Processing steps', 'Resulting statistics', 'Known issues'], numbers: ['Resulting statistics'] },
  bug: { required: ['What was wrong', 'Which entries it affects', 'Fix', 'Rerun needed'] },
  'dead-end': { required: ['What was tried', 'Why it was dropped', 'What would change that'] },
  finding: { required: ['What', 'Source', 'Consequence for the project'] },
  work: { required: ['What was done', 'Why'] },
  meeting: { required: [] }, // shape set per project by meeting-template.md
  question: { required: [] }, // by event, see EVENTS
};

// Sections of a question file that only a logged event may change.
export const RQ_CONTRACT = ['Why it matters', 'Hypothesis', 'What would answer it', 'Scope'];
// Each question event: the sections its entry needs, and the status the question file then has.
export const EVENTS = {
  opened: { required: ['Question', ...RQ_CONTRACT], status: 'open' },
  revised: { required: ['Question', ...RQ_CONTRACT, 'What changed and why'], status: 'open' },
  answered: { required: ['Answer'], status: 'answered' },
  'partially-answered': { required: ['Answer'], status: 'partially-answered' },
  dropped: { required: ['Why'], status: 'dropped' },
  reopened: { required: ['Why'], status: 'open' },
  replaced: { required: ['Why'], status: 'reformulated' },
};
export const RQ_STATUSES = ['open', 'answered', 'partially-answered', 'dropped', 'reformulated'];
export const STANCES = ['supports', 'contradicts', 'inconclusive', 'setup'];
export const RQ_FILE = /^(RQ\d+)\.md$/;
export const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
export const STATUSES = ['planned', 'running', 'done', 'failed', 'abandoned'];
export const SETTLED = ['done', 'failed', 'abandoned'];
export const PROVENANCE = ['recorded', 'ingested', 'stated', 'transcribed'];
export const ACTION_ID = /^(L\d{3,})-A\d+$/;
export const ENTRY_FILE = /^(\d{4}-\d{2}-\d{2})-(L\d{3,})-[a-z0-9][a-z0-9-]*\.md$/;
export const ID = /\bL\d{3,}\b/g;

// --- YAML subset -----------------------------------------------------------

function stripComment(s) {
  let quote = null;
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (quote) { if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'") quote = c;
    else if (c === '#' && (i === 0 || /\s/.test(s[i - 1]))) return s.slice(0, i);
  }
  return s;
}

function splitInline(s) {
  const parts = [];
  let quote = null;
  let cur = '';
  for (const c of s) {
    if (quote) { if (c === quote) quote = null; cur += c; continue; }
    if (c === '"' || c === "'") quote = c;
    if (c === ',') { parts.push(cur); cur = ''; } else cur += c;
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

function scalar(raw) {
  const s = raw.trim();
  if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) return JSON.parse(s);
  if (s.startsWith("'") && s.endsWith("'") && s.length >= 2) return s.slice(1, -1).replace(/''/g, "'");
  if (s.startsWith('[') && s.endsWith(']')) return splitInline(s.slice(1, -1)).map(scalar);
  if (s === 'null' || s === '~' || s === '') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  return s;
}

const isItem = (text) => text === '-' || text.startsWith('- ');

function parseBlock(lines, i, indent) {
  if (isItem(lines[i].text)) {
    const list = [];
    while (i < lines.length && lines[i].indent === indent && isItem(lines[i].text)) {
      const rest = lines[i].text.slice(1).trimStart();
      if (/^[A-Za-z0-9_-]+:(\s|$)/.test(rest)) {
        lines[i] = { ...lines[i], indent: indent + 2, text: rest };
        const [value, next] = parseBlock(lines, i, indent + 2);
        list.push(value);
        i = next;
      } else {
        list.push(scalar(rest));
        i += 1;
      }
    }
    return [list, i];
  }
  const map = {};
  while (i < lines.length && lines[i].indent === indent && !isItem(lines[i].text)) {
    const m = lines[i].text.match(/^([A-Za-z0-9_-]+):(?:\s+(.*))?$/);
    if (!m) throw new Error(`line ${lines[i].n}: cannot read "${lines[i].text}"`);
    const value = (m[2] ?? '').trim();
    i += 1;
    if (value !== '') {
      map[m[1]] = scalar(value);
    } else if (i < lines.length && (lines[i].indent > indent || (lines[i].indent === indent && isItem(lines[i].text)))) {
      const [child, next] = parseBlock(lines, i, lines[i].indent);
      map[m[1]] = child;
      i = next;
    } else {
      map[m[1]] = null;
    }
  }
  if (i < lines.length && lines[i].indent > indent) throw new Error(`line ${lines[i].n}: unexpected indentation`);
  return [map, i];
}

export function parseYaml(text) {
  const lines = [];
  text.split('\n').forEach((raw, k) => {
    const body = stripComment(raw).replace(/\s+$/, '');
    if (body.trim() === '') return;
    if (/^\t/.test(body)) throw new Error(`line ${k + 1}: tabs are not allowed for indentation`);
    lines.push({ n: k + 1, indent: body.length - body.trimStart().length, text: body.trim() });
  });
  if (!lines.length) return {};
  const [value, next] = parseBlock(lines, 0, lines[0].indent);
  if (next < lines.length) throw new Error(`line ${lines[next].n}: unexpected indentation`);
  return value;
}

// --- Entries ---------------------------------------------------------------

export function splitEntry(raw) {
  const lines = raw.split('\n');
  if (lines[0].trim() !== '---') throw new Error('no frontmatter: the file must start with ---');
  const end = lines.findIndex((l, k) => k > 0 && l.trim() === '---');
  if (end < 0) throw new Error('frontmatter is not closed with ---');
  return { front: parseYaml(lines.slice(1, end).join('\n')), body: lines.slice(end + 1).join('\n'), bodyLine: end + 2 };
}

// `## Heading` → { heading, text, line } in body order. Fenced code is not scanned for headings.
export function bodySections(body, bodyLine = 1) {
  const out = [];
  let cur = null;
  let fence = false;
  body.split('\n').forEach((line, k) => {
    if (/^\s*```/.test(line)) fence = !fence;
    const h = !fence && line.match(/^##\s+(.+?)\s*$/);
    if (h) { cur = { heading: h[1], lines: [], line: bodyLine + k }; out.push(cur); } else if (cur) cur.lines.push(line);
  });
  return out.map((s) => ({ heading: s.heading, text: s.lines.join('\n'), line: s.line }));
}

export const asList = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]).map(String);
export const resultPaths = (front) => asList(front.results).filter(Boolean);

export function loadProject(dir) {
  const project = parseYaml(readFileSync(join(dir, 'project.yml'), 'utf8'));
  const logDir = join(dir, 'log');
  const entries = [];
  const problems = [];
  const files = existsSync(logDir) ? readdirSync(logDir).filter((f) => f.endsWith('.md')).sort() : [];
  for (const file of files) {
    const raw = readFileSync(join(logDir, file), 'utf8');
    try {
      const { front, body, bodyLine } = splitEntry(raw);
      entries.push({ file, raw, front, body, bodyLine, id: front.id == null ? null : String(front.id) });
    } catch (err) {
      problems.push({ type: 'bad-frontmatter', file, detail: err.message });
    }
  }
  return { project, entries, problems };
}

// questions/RQ*.md → { file, id, front, title, sections }
export function loadQuestions(dir) {
  const qDir = join(dir, 'questions');
  const questions = [];
  const problems = [];
  const files = existsSync(qDir) ? readdirSync(qDir).filter((f) => f.endsWith('.md')).sort((a, b) => a.localeCompare(b, 'en', { numeric: true })) : [];
  for (const file of files) {
    try {
      const { front, body, bodyLine } = splitEntry(readFileSync(join(qDir, file), 'utf8'));
      const title = body.match(/^#\s+(.+?)\s*$/m)?.[1] ?? null;
      questions.push({ file, front, title, id: front.id == null ? null : String(front.id), sections: bodySections(body, bodyLine) });
    } catch (err) {
      problems.push({ type: 'bad-frontmatter', file: `questions/${file}`, detail: err.message });
    }
  }
  return { questions, problems };
}

export const section = (sections, name) => sections.find((s) => s.heading.toLowerCase() === name.toLowerCase());
const byDate = (a, b) => String(a.front.date).localeCompare(String(b.front.date)) || a.id.localeCompare(b.id, 'en', { numeric: true });

// RQ id → its question entries, oldest first.
export function questionHistory(entries) {
  const out = new Map();
  for (const e of entries.filter((x) => x.front.type === 'question' && x.id).sort(byDate)) {
    const rq = String(e.front.rq ?? '');
    if (!out.has(rq)) out.set(rq, []);
    out.get(rq).push(e);
  }
  return out;
}

// RQ id → [{ id, stance, date, invalid }] from the `evidence:` blocks of entries.
export function evidenceFor(entries, invalid) {
  const out = new Map();
  for (const e of entries.filter((x) => x.id).sort(byDate)) {
    for (const ev of Array.isArray(e.front.evidence) ? e.front.evidence : []) {
      if (!ev || typeof ev !== 'object' || !ev.rq) continue;
      const rq = String(ev.rq);
      if (!out.has(rq)) out.set(rq, []);
      out.get(rq).push({ id: e.id, stance: ev.stance ?? null, date: String(e.front.date ?? ''), title: e.front.title, invalid: invalid.get(e.id) ?? [] });
    }
  }
  return out;
}

// Action items from meeting entries → [{ id, what, who, due, meeting, date, resolvedBy }].
export function actionItems(entries) {
  const items = [];
  for (const e of entries.filter((x) => x.id)) {
    for (const a of Array.isArray(e.front.actions) ? e.front.actions : []) {
      if (a && typeof a === 'object' && a.id) {
        items.push({ id: String(a.id), what: a.what ?? '', who: a.who ?? null, due: a.due ? String(a.due) : null, meeting: e.id, date: String(e.front.date ?? ''), resolvedBy: null });
      }
    }
  }
  const byId = new Map(items.map((a) => [a.id, a]));
  for (const e of entries.filter((x) => x.id)) {
    for (const r of asList(e.front.resolves)) if (byId.has(r) && !byId.get(r).resolvedBy) byId.get(r).resolvedBy = e.id;
  }
  return items;
}

// Entries a later entry has superseded, corrected, or declared affected by a bug.
export function invalidations(entries) {
  const out = new Map();
  const add = (target, kind, by) => {
    if (!out.has(target)) out.set(target, []);
    out.get(target).push({ kind, by });
  };
  for (const e of entries) {
    if (e.front.status === 'abandoned' && e.front.type === 'bug') continue;
    for (const t of asList(e.front.supersedes)) add(t, 'superseded', e.id);
    for (const t of asList(e.front.corrects)) add(t, 'corrected', e.id);
    if (e.front.type === 'bug') for (const t of asList(e.front.affects)) add(t, 'affected', e.id);
  }
  return out;
}

export function codeRepo(project, name) {
  const repos = (Array.isArray(project.code_repos) ? project.code_repos : []).filter((r) => r && r.path);
  if (name) return repos.find((r) => r.name === name || String(r.path).replace(/\/+$/, '').split('/').pop() === name) ?? null;
  return repos.length === 1 ? repos[0] : null;
}

// --- Files -----------------------------------------------------------------

export function walk(path) {
  if (!existsSync(path)) return [];
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path).sort().flatMap((f) => walk(join(path, f)));
}

export function sha256File(path) {
  return new Promise((resolve, reject) => {
    const h = createHash('sha256');
    createReadStream(path).on('data', (d) => h.update(d)).on('end', () => resolve(h.digest('hex'))).on('error', reject);
  });
}

// One hash over an entry file and everything in its artifacts folder.
export async function sealHash(logDir, entry) {
  const h = createHash('sha256');
  h.update(entry.raw);
  const art = join(logDir, 'artifacts', entry.id);
  for (const f of walk(art)) h.update(`\0${relative(art, f)}\0${await sha256File(f)}`);
  return h.digest('hex');
}
