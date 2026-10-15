#!/usr/bin/env node
// check-log.mjs — every logbook entry is well formed, its references resolve,
// its numbers point to where they came from, and settled entries stay as they
// were sealed.
//
//   node check-log.mjs projects/{name} [--seal] [--json]
//
// Errors (exit 1):
//   bad-frontmatter   the YAML block is missing or unreadable
//   bad-filename      not {YYYY-MM-DD}-{L001}-{slug}.md
//   missing-field     id, type, title, date, status or provenance is absent
//   bad-value         type, status, provenance or date is not an allowed value
//   id-mismatch       the id or date differs from the filename
//   duplicate-id      two entries share an ID
//   id-gap            IDs are not L001, L002, … without holes
//   unknown-ref       related / supersedes / corrects / affects names a missing entry
//   missing-section   a settled entry lacks a required `## ` section (planned and
//                     running entries need only the first one; question entries
//                     need the sections of their event)
//   unpointed-number  a number in Result (experiment) or Resulting statistics
//                     (dataset) has no pointer on its line: a file path, or (author)
//   notes-number      Claude's notes states a number the Result section does not
//   missing-run       a settled recorded experiment lacks run.commit or run.command
//   missing-snapshot  a settled experiment lists results but has no artifacts/{id}/manifest.json
//   snapshot-mismatch a file the manifest says was copied is missing or changed
//   edited-settled    a sealed entry or its artifacts changed after sealing
//   reopened          a sealed entry is no longer done, failed or abandoned
//   bad-question      a question entry lacks rq or a valid event, or names a
//                     missing replaced_by; a question file is misnamed or has a
//                     bad id, status or no `# ` title; RQ IDs have a gap
//   bad-evidence      an evidence item lacks rq, names a question that does not
//                     exist, or has no valid stance (a stance may wait until the
//                     entry is settled)
//   rq-not-logged     a question file has no `opened` entry in the log
//   rq-status-unlogged  a question file's status is not what its latest log
//                     event says
//   rq-unlogged-change  a question file's wording, contract sections or answer
//                     differ from what the log last recorded
//   bad-action        an action item lacks id or what, its id is not {entry}-A{n}
//                     of its own entry, or is used twice; resolves: names an
//                     unknown action item
//   unconfirmed-speakers  a settled transcribed entry lacks speakers_confirmed: true
// Warnings (exit 0):
//   unsealed          a settled entry has not been sealed yet; run with --seal
//   hypothesis-after-evidence  a hypothesis was revised after evidence for the
//                     question existed
//   answer-without-evidence  a question is answered with no valid evidence
//   overdue-action    an open action item is past its due date
//
// --seal records a hash for every settled, unsealed entry that has no errors,
// in log/.sealed.json. Corrections after that are new entries (corrects:).
// Exit 2 on usage errors.

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  TYPES, STATUSES, SETTLED, PROVENANCE, ENTRY_FILE, ID, EVENTS, RQ_CONTRACT, RQ_STATUSES, STANCES, RQ_FILE,
  ACTION_ID, loadProject, loadQuestions, bodySections, section, invalidations, questionHistory, evidenceFor, actionItems,
  asList, resultPaths, sha256File, sealHash, norm,
} from './log-lib.mjs';

const args = process.argv.slice(2);
const json = args.includes('--json');
const seal = args.includes('--seal');
const dir = args.find((a) => !a.startsWith('--'));

if (!dir || !existsSync(join(dir, 'project.yml'))) {
  console.error('usage: node check-log.mjs projects/{name} [--seal] [--json]   (the folder must hold project.yml)');
  process.exit(2);
}

const logDir = join(dir, 'log');
let loaded;
try {
  loaded = loadProject(dir);
} catch (err) {
  console.error(`project.yml: ${err.message}`);
  process.exit(2);
}
const { project, entries } = loaded;
const { questions, problems: qProblems } = loadQuestions(dir);
const errors = [...loaded.problems, ...qProblems];
const warnings = [];
const err = (e, type, detail, line) => errors.push({ type, file: e.file, id: e.id, line, detail });

// --- Shape -----------------------------------------------------------------

const byId = new Map();
for (const e of entries) {
  const f = e.front;
  const m = e.file.match(ENTRY_FILE);
  if (!m) err(e, 'bad-filename', 'expected {YYYY-MM-DD}-{L001}-{slug}.md');
  for (const k of ['id', 'type', 'title', 'date', 'status', 'provenance']) {
    if (f[k] == null || f[k] === '') err(e, 'missing-field', k);
  }
  if (f.type != null && !TYPES[f.type]) err(e, 'bad-value', `type "${f.type}" is not one of ${Object.keys(TYPES).join(', ')}`);
  if (f.status != null && !STATUSES.includes(f.status)) err(e, 'bad-value', `status "${f.status}" is not one of ${STATUSES.join(', ')}`);
  if (f.provenance != null && !PROVENANCE.includes(f.provenance)) err(e, 'bad-value', `provenance "${f.provenance}" is not one of ${PROVENANCE.join(', ')}`);
  if (f.date != null && !/^\d{4}-\d{2}-\d{2}$/.test(String(f.date))) err(e, 'bad-value', `date "${f.date}" is not YYYY-MM-DD`);
  if (e.id && !/^L\d{3,}$/.test(e.id)) err(e, 'bad-value', `id "${e.id}" is not L001-style`);
  if (m && e.id && m[2] !== e.id) err(e, 'id-mismatch', `filename says ${m[2]}, frontmatter says ${e.id}`);
  if (m && f.date && m[1] !== String(f.date)) err(e, 'id-mismatch', `filename date ${m[1]}, frontmatter date ${f.date}`);
  if (e.id) {
    if (byId.has(e.id)) err(e, 'duplicate-id', `${e.id} is also used by ${byId.get(e.id).file}`);
    else byId.set(e.id, e);
  }
}

const nums = [...byId.keys()].map((id) => parseInt(id.slice(1), 10)).sort((a, b) => a - b);
for (let k = 0; k < nums.length; k += 1) {
  if (nums[k] !== k + 1) {
    errors.push({ type: 'id-gap', detail: `expected L${String(k + 1).padStart(3, '0')}, found L${String(nums[k]).padStart(3, '0')}` });
    break;
  }
}

for (const e of entries) {
  for (const field of ['related', 'supersedes', 'corrects', 'affects']) {
    for (const t of asList(e.front[field])) if (!byId.has(t)) err(e, 'unknown-ref', `${field}: ${t} does not exist`);
  }
}

// --- Body ------------------------------------------------------------------

const POINTER = /\(author\b|(?=[\w.~/-]*[A-Za-z])[\w.~-]*\/[\w./~-]+|\b[\w-]+\.(?:jsonl?|csv|tsv|txt|log|md|pdf|png|jpe?g|svg|tex|ya?ml|npz|npy|pkl|pt|parquet|out|err|html)\b/i;
// What is not a claimed number: entry and fact IDs, dates, @k cutoffs, markdown headings.
const unclaimed = (s) => s.replace(ID, ' ').replace(/\bF\d+\b/g, ' ').replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ').replace(/@\d+/g, ' ').replace(/^#+.*$/, ' ');
const numbersIn = (s) => new Set([...unclaimed(s).matchAll(/\d+(?:\.\d+)?(?:e-?\d+)?/gi)].map((m) => String(Number(m[0]))));

// Units a pointer must cover: a table row, a list item with its continuation, a paragraph.
function units(text, line0) {
  const lines = text.split('\n');
  const out = [];
  let cur = null;
  let fence = false;
  for (let k = 0; k < lines.length; k += 1) {
    const l = lines[k];
    if (/^\s*```/.test(l)) { fence = !fence; cur = null; continue; }
    if (l.trim() === '') { cur = null; continue; }
    if (/^\s*\|/.test(l)) {
      if (/^\s*\|[\s:|-]+\|\s*$/.test(l)) { cur = null; continue; }
      const header = /^\s*\|[\s:|-]+\|\s*$/.test(lines[k + 1] ?? '');
      const table = out.filter((u) => u.table).at(-1);
      const start = !table || table.end !== k - 1 ? k : table.start;
      out.push({ text: l, line: line0 + k, table: true, header, start, end: k });
      cur = null;
      continue;
    }
    if (/^\s*(?:[-*+]|\d+\.)\s/.test(l) || !cur || (cur.list && !/^\s+\S/.test(l))) {
      cur = { text: l, line: line0 + k, list: /^\s*(?:[-*+]|\d+\.)\s/.test(l), fence };
      out.push(cur);
    } else cur.text += `\n${l}`;
  }
  return out.filter((u) => !u.fence);
}

function checkPointers(e, section) {
  const us = units(section.text, section.line + 1);
  // A "Source: path" line right after a table covers all of its rows.
  const covered = new Set();
  us.forEach((u, k) => {
    if (!u.table && /^\s*(?:sources?|from)\s*:/i.test(u.text) && POINTER.test(u.text) && us[k - 1]?.table) covered.add(us[k - 1].start);
  });
  for (const u of us) {
    if (u.header || POINTER.test(u.text) || (u.table && covered.has(u.start))) continue;
    if (numbersIn(u.text).size) err(e, 'unpointed-number', u.text.split('\n')[0].trim().slice(0, 100), u.line);
  }
}

for (const e of entries) {
  const spec = TYPES[e.front.type];
  if (!spec) continue;
  const sections = bodySections(e.body, e.bodyLine);
  const find = (name) => sections.find((s) => s.heading.toLowerCase() === name.toLowerCase());
  const settled = SETTLED.includes(e.front.status);
  const required = e.front.type === 'question' ? EVENTS[e.front.event]?.required ?? [] : spec.required;
  for (const name of settled || e.front.type === 'question' ? required : required.slice(0, 1)) {
    if (!find(name)) err(e, 'missing-section', `## ${name}`);
  }
  for (const name of spec.numbers ?? []) {
    const s = find(name);
    if (s) checkPointers(e, s);
  }
  const notes = find("Claude's notes");
  const result = find('Result');
  if (notes && result) {
    const allowed = numbersIn(result.text);
    for (const n of numbersIn(notes.text)) if (!allowed.has(n)) err(e, 'notes-number', `${n} is not in the Result section`, notes.line);
  }
  if (settled && e.front.type === 'experiment') {
    const run = e.front.run ?? {};
    if (e.front.provenance === 'recorded' && (!run.commit || !run.command)) err(e, 'missing-run', 'run.commit and run.command are required for a recorded experiment');
    if (resultPaths(e.front).length && e.id && !existsSync(join(logDir, 'artifacts', e.id, 'manifest.json'))) {
      err(e, 'missing-snapshot', `run node log-snapshot.mjs ${dir} ${e.id}`);
    }
  }
}

// --- Research questions ----------------------------------------------------

const rqIds = new Set();
for (const q of questions) {
  const m = q.file.match(RQ_FILE);
  const where = { file: `questions/${q.file}`, id: q.id };
  const bad = (detail) => errors.push({ type: 'bad-question', ...where, detail });
  if (!m) bad('expected questions/RQ{n}.md');
  else if (q.id !== m[1]) bad(`filename says ${m[1]}, frontmatter id is ${q.id}`);
  if (!RQ_STATUSES.includes(q.front.status)) bad(`status "${q.front.status}" is not one of ${RQ_STATUSES.join(', ')}`);
  if (!q.title) bad('no `# ` title holding the question');
  if (q.id) rqIds.add(q.id);
}
const rqNums = [...rqIds].map((id) => parseInt(id.slice(2), 10)).sort((a, b) => a - b);
for (let k = 0; k < rqNums.length; k += 1) {
  if (rqNums[k] !== k + 1) { errors.push({ type: 'bad-question', file: 'questions/', detail: `expected RQ${k + 1}, found RQ${rqNums[k]}` }); break; }
}

for (const e of entries) {
  const f = e.front;
  if (f.type === 'question') {
    if (!f.rq || !rqIds.has(String(f.rq))) err(e, 'bad-question', `rq: ${f.rq ?? '(missing)'} has no file in questions/`);
    if (!EVENTS[f.event]) err(e, 'bad-question', `event "${f.event ?? ''}" is not one of ${Object.keys(EVENTS).join(', ')}`);
    if (f.event === 'replaced' && !rqIds.has(String(f.replaced_by ?? ''))) err(e, 'bad-question', `replaced_by: ${f.replaced_by ?? '(missing)'} has no file in questions/`);
    if (f.evidence != null) err(e, 'bad-evidence', 'question entries cannot be evidence');
    continue;
  }
  if (f.evidence == null) continue;
  if (!Array.isArray(f.evidence)) { err(e, 'bad-evidence', 'evidence must be a list of {rq, stance}'); continue; }
  for (const ev of f.evidence) {
    if (!ev || typeof ev !== 'object' || !ev.rq) err(e, 'bad-evidence', 'each evidence item needs rq and stance');
    else if (!rqIds.has(String(ev.rq))) err(e, 'bad-evidence', `${ev.rq} has no file in questions/`);
    else if (ev.stance == null ? SETTLED.includes(f.status) : !STANCES.includes(ev.stance)) {
      err(e, 'bad-evidence', `${ev.rq}: stance "${ev.stance ?? ''}" is not one of ${STANCES.join(', ')}`);
    }
  }
}

const invalid = invalidations(entries);
const history = questionHistory(entries);
const evidence = evidenceFor(entries, invalid);
const counts = (rq) => (evidence.get(rq) ?? []).filter((x) => !x.invalid.length && x.stance && x.stance !== 'setup');
for (const q of questions) {
  if (!q.id) continue;
  const where = { file: `questions/${q.file}`, id: q.id };
  const events = (history.get(q.id) ?? []).filter((e) => EVENTS[e.front.event]);
  if (!events.some((e) => e.front.event === 'opened')) {
    errors.push({ type: 'rq-not-logged', ...where, detail: `no question entry with rq: ${q.id} and event: opened` });
    continue;
  }
  const last = events.at(-1);
  if (EVENTS[last.front.event].status !== q.front.status) {
    errors.push({ type: 'rq-status-unlogged', ...where, detail: `file says ${q.front.status}, latest event is ${last.front.event} (${last.id})` });
  }
  if (q.front.status === 'reformulated' && last.front.event === 'replaced' && String(q.front.reformulated_as ?? '') !== String(last.front.replaced_by)) {
    errors.push({ type: 'rq-status-unlogged', ...where, detail: `reformulated_as is ${q.front.reformulated_as ?? 'empty'}, ${last.id} says ${last.front.replaced_by}` });
  }
  const contracts = events.filter((e) => ['opened', 'revised'].includes(e.front.event));
  const contract = contracts.at(-1);
  const logged = (name) => norm(section(bodySections(contract.body), name)?.text);
  if (norm(q.title) !== logged('Question')) {
    errors.push({ type: 'rq-unlogged-change', ...where, detail: `the question's wording differs from ${contract.id}` });
  }
  for (const name of RQ_CONTRACT) {
    if (norm(section(q.sections, name)?.text) !== logged(name)) {
      errors.push({ type: 'rq-unlogged-change', ...where, detail: `## ${name} differs from ${contract.id}` });
    }
  }
  if (['answered', 'partially-answered'].includes(q.front.status)) {
    const answer = [...events].reverse().find((e) => ['answered', 'partially-answered'].includes(e.front.event));
    if (answer && norm(section(q.sections, 'Answer')?.text) !== norm(section(bodySections(answer.body), 'Answer')?.text)) {
      errors.push({ type: 'rq-unlogged-change', ...where, detail: `## Answer differs from ${answer.id}` });
    }
    if (!counts(q.id).length) warnings.push({ type: 'answer-without-evidence', ...where, detail: 'answered, but no valid supporting, contradicting or inconclusive entry' });
  }
  for (let k = 1; k < contracts.length; k += 1) {
    const hyp = (e) => norm(section(bodySections(e.body), 'Hypothesis')?.text);
    if (hyp(contracts[k]) === hyp(contracts[k - 1])) continue;
    const before = counts(q.id).filter((x) => x.date <= String(contracts[k].front.date));
    if (before.length) warnings.push({ type: 'hypothesis-after-evidence', ...where, detail: `${contracts[k].id} changed the hypothesis after ${before.map((x) => x.id).join(', ')}` });
  }
}

// --- Meetings and action items ---------------------------------------------

const seenActions = new Set();
for (const e of entries) {
  const f = e.front;
  if (f.provenance === 'transcribed' && SETTLED.includes(f.status) && f.speakers_confirmed !== true) {
    err(e, 'unconfirmed-speakers', 'who said what was inferred from a transcript; the author must confirm it (speakers_confirmed: true)');
  }
  if (f.actions == null) continue;
  if (!Array.isArray(f.actions)) { err(e, 'bad-action', 'actions must be a list of {id, what, who, due}'); continue; }
  for (const a of f.actions) {
    if (!a || typeof a !== 'object' || !a.id || !a.what) { err(e, 'bad-action', 'each action item needs id and what'); continue; }
    const m = String(a.id).match(ACTION_ID);
    if (!m || m[1] !== e.id) err(e, 'bad-action', `${a.id} should be ${e.id}-A{n}`);
    if (seenActions.has(String(a.id))) err(e, 'bad-action', `${a.id} is used twice`);
    seenActions.add(String(a.id));
    if (a.due != null && !/^\d{4}-\d{2}-\d{2}$/.test(String(a.due))) err(e, 'bad-action', `${a.id}: due "${a.due}" is not YYYY-MM-DD`);
  }
}
for (const e of entries) {
  for (const r of asList(e.front.resolves)) if (!seenActions.has(r)) err(e, 'bad-action', `resolves: ${r} is not an action item`);
}
const today = new Date().toISOString().slice(0, 10);
const actions = actionItems(entries);
for (const a of actions) {
  if (!a.resolvedBy && a.due && a.due < today) warnings.push({ type: 'overdue-action', file: entries.find((e) => e.id === a.meeting)?.file, id: a.meeting, detail: `${a.id} (${a.who ?? 'no owner'}, due ${a.due}): ${a.what}` });
}

// --- Snapshots and seals ---------------------------------------------------

for (const e of entries) {
  if (!e.id) continue;
  const manifestPath = join(logDir, 'artifacts', e.id, 'manifest.json');
  if (!existsSync(manifestPath)) continue;
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  for (const f of manifest.files ?? []) {
    if (!f.copied) continue;
    const local = join(logDir, 'artifacts', e.id, 'results', f.path);
    if (!existsSync(local)) err(e, 'snapshot-mismatch', `${f.path} is missing from the snapshot`);
    else if ((await sha256File(local)) !== f.sha256) err(e, 'snapshot-mismatch', `${f.path} changed after the snapshot`);
  }
}

const sealsPath = join(logDir, '.sealed.json');
const seals = existsSync(sealsPath) ? JSON.parse(readFileSync(sealsPath, 'utf8')) : {};
const toSeal = [];
for (const e of entries) {
  if (!e.id || byId.get(e.id) !== e) continue;
  const settled = SETTLED.includes(e.front.status);
  const hash = await sealHash(logDir, e);
  if (seals[e.id]) {
    if (!settled) err(e, 'reopened', `sealed on ${seals[e.id].date}, now "${e.front.status}"`);
    else if (seals[e.id].hash !== hash) err(e, 'edited-settled', `changed after it was sealed on ${seals[e.id].date}; restore it and write a new entry with corrects: ${e.id}`);
  } else if (settled) {
    if (seal && !errors.some((x) => x.id === e.id)) toSeal.push({ e, hash });
    else warnings.push({ type: 'unsealed', file: e.file, id: e.id, detail: 'settled but not sealed; run with --seal' });
  }
}
if (seal && toSeal.length) {
  for (const { e, hash } of toSeal) seals[e.id] = { hash, date: today };
  const sorted = Object.fromEntries(Object.entries(seals).sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true })));
  writeFileSync(sealsPath, `${JSON.stringify(sorted, null, 2)}\n`);
}

// --- Report ----------------------------------------------------------------

const inboxDir = join(dir, 'inbox');
const inbox = existsSync(inboxDir) ? readdirSync(inboxDir).filter((f) => f !== 'done' && !f.startsWith('.')).sort() : [];
const summary = entries.filter((e) => e.id).map((e) => ({
  id: e.id, file: e.file, type: e.front.type, title: e.front.title, date: String(e.front.date ?? ''),
  status: e.front.status, provenance: e.front.provenance, tags: asList(e.front.tags), paper: e.front.paper ?? null,
  sealed: Boolean(seals[e.id]), invalid: invalid.get(e.id) ?? [],
  evidence: (Array.isArray(e.front.evidence) ? e.front.evidence : []).filter((x) => x && x.rq).map((x) => ({ rq: String(x.rq), stance: x.stance ?? null })),
}));
const rqSummary = questions.filter((q) => q.id).map((q) => ({
  id: q.id, title: q.title, status: q.front.status, reformulated_as: q.front.reformulated_as ?? null,
  history: (history.get(q.id) ?? []).map((e) => ({ id: e.id, event: e.front.event, date: String(e.front.date ?? '') })),
  evidence: evidence.get(q.id) ?? [],
}));

if (json) {
  console.log(JSON.stringify({ project: project.name ?? null, entries: summary, questions: rqSummary, actions, errors, warnings, sealed: toSeal.map((s) => s.e.id), inbox }, null, 2));
} else {
  const counts = {};
  for (const s of summary) counts[s.type] = (counts[s.type] ?? 0) + 1;
  const tally = Object.entries(counts).map(([t, n]) => `${n} ${t}`).join(', ') || 'no entries';
  if (errors.length === 0) console.log(`OK: ${summary.length} entries (${tally}).`);
  else {
    console.log(`${errors.length} problem(s) in ${summary.length} entries (${tally}):\n`);
    for (const x of errors) console.log(`  ${x.file ?? 'log/'}${x.line ? `:${x.line}` : ''}  ${x.type}  ${x.detail ?? ''}`);
  }
  if (toSeal.length) console.log(`\nSealed: ${toSeal.map((s) => s.e.id).join(', ')}`);
  const unsealed = warnings.filter((w) => w.type === 'unsealed');
  for (const w of warnings.filter((x) => x.type === 'overdue-action')) console.log(`Overdue: ${w.detail}`);
  if (unsealed.length) console.log(`\nUnsealed settled entries: ${unsealed.map((w) => w.id).join(', ')} (run with --seal)`);
  const open = actions.filter((a) => !a.resolvedBy);
  if (open.length) console.log(`Open action items: ${open.map((a) => `${a.id} (${a.who ?? 'no owner'}${a.due ? `, due ${a.due}` : ''})`).join(', ')}`);
  for (const w of warnings.filter((x) => !['unsealed', 'overdue-action'].includes(x.type))) console.log(`Warning: ${w.file}  ${w.type}  ${w.detail}`);
  if (rqSummary.length) {
    console.log(`Research questions: ${rqSummary.map((q) => `${q.id} ${q.status} (${q.evidence.filter((x) => !x.invalid.length && x.stance && x.stance !== 'setup').length} evidence)`).join(', ')}`);
  }
  const running = summary.filter((s) => s.status === 'running' || s.status === 'planned');
  if (running.length) console.log(`Open: ${running.map((s) => `${s.id} (${s.status})`).join(', ')}`);
  if (inbox.length) console.log(`Inbox waiting for ingest: ${inbox.join(', ')}`);
}

process.exit(errors.length ? 1 : 0);
