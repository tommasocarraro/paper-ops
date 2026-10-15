// node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, appendFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../log-lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const node = (script, ...args) => spawnSync(process.execPath, [join(root, script), ...args], { encoding: 'utf8' });

const DECISION = `---
id: L001
type: decision
title: Use BM25 as first stage
date: 2026-10-14
status: done
provenance: stated
tags: [retrieval]
---

## Context
We need 1,000 candidates per query.

## Options considered
- BM25
- Dense retriever

## Decision
BM25.

## Why
Cheap.

## Consequences
Lexical candidates only.
`;

const experiment = ({ status = 'done', result, notes = '', extra = '' } = {}) => `---
id: L002
type: experiment
title: Learning-rate sweep
date: 2026-10-15
status: ${status}
provenance: recorded
related: [L001]
${extra}run:
  repo: reranker
  commit: 3f2a9c1d0e4b
  command: python train.py
---

## Question
Which learning rate?

## Setup
Two rates, one seed.

## Result
${result ?? '| lr | NDCG@10 | source |\n|----|---------|--------|\n| 3e-5 | 0.412 | runs/a/metrics.json |'}

## Author's reading
3e-5 is best.
${notes}`;

// A throwaway project; files maps path under the project -> content.
function project(files) {
  const dir = mkdtempSync(join(tmpdir(), 'lab-log-'));
  writeFileSync(join(dir, 'project.yml'), 'name: test\ncode_repos:\n  - name: reranker\n    path: /nonexistent\n');
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  return dir;
}
function check(files, ...flags) {
  const dir = project(files);
  try {
    const run = node('check-log.mjs', dir, '--json', ...flags);
    return { status: run.status, ...JSON.parse(run.stdout) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const types = (r) => r.errors.map((e) => e.type);
const D = 'log/2026-10-14-L001-bm25.md';
const E = 'log/2026-10-15-L002-lr-sweep.md';

test('the YAML subset reads nested maps, lists of maps, inline lists and comments', () => {
  const y = parseYaml('a: 1   # note\nb: [x, "y, z"]\nc:\n  d: null\n  e: true\nf:\n  - name: r\n    path: /p\n  - plain\ng:\n- one\n');
  assert.deepEqual(y, { a: '1', b: ['x', 'y, z'], c: { d: null, e: true }, f: [{ name: 'r', path: '/p' }, 'plain'], g: ['one'] });
});

test('a well-formed log passes', () => {
  const r = check({ [D]: DECISION, [E]: experiment({ extra: 'paper: null\n' }) });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings.map((w) => w.type), ['unsealed', 'unsealed']);
});

test('result numbers need a pointer; numbers outside Result do not', () => {
  const r = check({ [D]: DECISION, [E]: experiment({ result: 'NDCG@10 reached 0.412.\n\nIt took 41 minutes (author, 2026-10-15).\n\n- 0.399 on test, see runs/a/test.json' }) });
  assert.deepEqual(types(r), ['unpointed-number']);
  assert.match(r.errors[0].detail, /0\.412/);
});

test('a Source line after a table covers its rows', () => {
  const r = check({ [D]: DECISION, [E]: experiment({ result: '| lr | NDCG@10 |\n|----|----|\n| 3e-5 | 0.412 |\n| 1e-5 | 0.401 |\n\nSource: runs/a/metrics.csv' }) });
  assert.deepEqual(r.errors, []);
});

test("Claude's notes may not state numbers the Result lacks", () => {
  const r = check({ [D]: DECISION, [E]: experiment({ notes: "\n## Claude's notes\nOne seed, so the 0.011 gap to 0.401 may be noise.\n" }) });
  assert.deepEqual(types(r), ['notes-number', 'notes-number']);
});

test('settled entries need every section; running ones only the first', () => {
  const running = experiment({ status: 'running' }).split('## Setup')[0];
  assert.deepEqual(check({ [D]: DECISION, [E]: running }).errors, []);
  const done = experiment().split('## Setup')[0];
  assert.deepEqual(types(check({ [D]: DECISION, [E]: done })), ['missing-section', 'missing-section', 'missing-section']);
});

test('IDs: gaps, duplicates, mismatched filenames and unknown references fail', () => {
  assert.deepEqual(types(check({ [E]: experiment() })), ['id-gap', 'unknown-ref']);
  assert.deepEqual(types(check({ [D]: DECISION, 'log/2026-10-14-L002-copy.md': DECISION })), ['id-mismatch', 'duplicate-id']);
  assert.deepEqual(types(check({ 'log/notes.md': DECISION })), ['bad-filename']);
});

test('frontmatter values are validated', () => {
  const bad = DECISION.replace('status: done', 'status: finished').replace('type: decision', 'type: idea');
  assert.deepEqual(types(check({ [D]: bad })), ['bad-value', 'bad-value']);
  assert.deepEqual(types(check({ [D]: DECISION.replace('---\nid', 'id') })), ['bad-frontmatter']);
});

test('a settled recorded experiment with results needs a snapshot', () => {
  const r = check({ [D]: DECISION, [E]: experiment({ extra: 'results:\n  - runs/a/\n' }) });
  assert.deepEqual(types(r), ['missing-snapshot']);
});

test('a bug invalidates the entries it affects', () => {
  const bug = `---\nid: L003\ntype: bug\ntitle: Leak\ndate: 2026-10-16\nstatus: done\nprovenance: stated\naffects: [L002]\n---\n\n## What was wrong\nx\n## Which entries it affects\nL002\n## Fix\ny\n## Rerun needed\nyes\n`;
  const r = check({ [D]: DECISION, [E]: experiment(), 'log/2026-10-16-L003-leak.md': bug });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.entries.find((e) => e.id === 'L002').invalid, [{ kind: 'affected', by: 'L003' }]);
});

test('sealed entries cannot be edited or reopened', () => {
  const dir = project({ [D]: DECISION, [E]: experiment({ status: 'running' }) });
  try {
    const sealed = JSON.parse(node('check-log.mjs', dir, '--seal', '--json').stdout);
    assert.deepEqual(sealed.sealed, ['L001']);
    appendFileSync(join(dir, D), 'edited\n');
    assert.deepEqual(JSON.parse(node('check-log.mjs', dir, '--json').stdout).errors.map((e) => e.type), ['edited-settled']);
    writeFileSync(join(dir, D), DECISION.replace('status: done', 'status: running'));
    assert.deepEqual(JSON.parse(node('check-log.mjs', dir, '--json').stdout).errors.map((e) => e.type), ['reopened']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('log-snapshot captures the code state and the results; build-log renders the entry', () => {
  const code = mkdtempSync(join(tmpdir(), 'lab-log-code-'));
  const dir = project({ [D]: DECISION });
  try {
    const git = (...a) => execFileSync('git', ['-C', code, ...a], { encoding: 'utf8' });
    mkdirSync(join(code, 'runs/a'), { recursive: true });
    writeFileSync(join(code, 'conf.yaml'), 'lr: 3e-5\n');
    git('init', '-q');
    git('add', '.');
    git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'init');
    writeFileSync(join(code, 'conf.yaml'), 'lr: 1e-5\n');
    writeFileSync(join(code, 'runs/a/metrics.json'), '{"ndcg@10": 0.412}\n');
    writeFileSync(join(code, 'runs/a/big.bin'), Buffer.alloc(2 * 1024 * 1024));
    writeFileSync(join(dir, 'project.yml'), `name: test\ncode_repos:\n  - name: reranker\n    path: ${code}\nsnapshot:\n  max_file_mb: 1\n`);
    writeFileSync(join(dir, E), experiment({ extra: 'results:\n  - runs/a/\n' }).replace('command: python train.py', 'command: python train.py\n  config: conf.yaml'));

    const start = JSON.parse(node('log-snapshot.mjs', dir, 'L002', '--start').stdout);
    assert.equal(start.dirty, true);
    assert.equal(start.commit, git('rev-parse', 'HEAD').trim().slice(0, 12));
    assert.match(readFileSync(join(dir, 'log/artifacts/L002/uncommitted.diff'), 'utf8'), /\+lr: 1e-5/);
    assert.ok(existsSync(join(dir, 'log/artifacts/L002/config/conf.yaml')));

    assert.equal(node('log-snapshot.mjs', dir, 'L002').status, 0);
    const manifest = JSON.parse(readFileSync(join(dir, 'log/artifacts/L002/manifest.json'), 'utf8'));
    assert.deepEqual(manifest.files.map((f) => [f.path, f.copied]), [['runs/a/big.bin', false], ['runs/a/metrics.json', true]]);
    assert.deepEqual(JSON.parse(node('check-log.mjs', dir, '--json').stdout).errors, []);

    writeFileSync(join(dir, 'log/artifacts/L002/results/runs/a/metrics.json'), '{"ndcg@10": 0.5}\n');
    assert.deepEqual(JSON.parse(node('check-log.mjs', dir, '--json').stdout).errors.map((e) => e.type), ['snapshot-mismatch']);

    assert.equal(node('build-log.mjs', dir).status, 0);
    const tex = readFileSync(join(dir, 'build/logbook.tex'), 'utf8');
    assert.match(tex, /\\hypertarget\{L002\}/);
    assert.match(tex, /Recorded by hash only/);
    assert.match(tex, /\\hyperlink\{L001\}\{L001\}/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(code, { recursive: true, force: true });
  }
});

// --- Research questions ------------------------------------------------------

const CONTRACT = (hyp = 'Larger on the tail.') => `## Why it matters\nBM25 is weak there.\n\n## Hypothesis\n${hyp}\n\n## What would answer it\nNDCG@10 gain by bucket.\n\n## Scope\nEnglish only.\n`;
const RQ_TITLE = 'Does reranking help tail queries more?';
const rqFile = ({ status = 'open', title = RQ_TITLE, hyp, answer = '', extra = '' } = {}) =>
  `---\nid: RQ1\nstatus: ${status}\n${extra}---\n\n# ${title}\n\n${CONTRACT(hyp)}\n## Answer\n${answer}\n`;
const qEntry = (id, date, event, body, extra = '') =>
  `---\nid: ${id}\ntype: question\ntitle: RQ1 ${event}\ndate: ${date}\nstatus: done\nprovenance: stated\nrq: RQ1\nevent: ${event}\n${extra}---\n\n${body}`;
const OPENED = { 'log/2026-10-16-L003-open-rq1.md': qEntry('L003', '2026-10-16', 'opened', `## Question\n${RQ_TITLE}\n\n${CONTRACT()}`) };
const withEvidence = (stance) => experiment({ extra: `evidence:\n  - rq: RQ1\n${stance ? `    stance: ${stance}\n` : ''}` }).replace('date: 2026-10-15', 'date: 2026-10-17');
const E2 = 'log/2026-10-17-L002-lr-sweep.md';

test('a question file that matches its opened entry passes, and collects evidence', () => {
  const r = check({ [D]: DECISION, [E2]: withEvidence('supports'), ...OPENED, 'questions/RQ1.md': rqFile() });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.questions[0].evidence.map((x) => [x.id, x.stance]), [['L002', 'supports']]);
});

test('a question file without an opened entry fails', () => {
  assert.deepEqual(types(check({ [D]: DECISION, 'questions/RQ1.md': rqFile() })), ['rq-not-logged']);
});

test('changing a question file without a log entry fails', () => {
  const r = check({ [D]: DECISION, [E2]: withEvidence('setup'), ...OPENED, 'questions/RQ1.md': rqFile({ status: 'answered', title: 'Something else?', hyp: 'Changed.' }) });
  assert.deepEqual(types(r), ['rq-status-unlogged', 'rq-unlogged-change', 'rq-unlogged-change']);
});

test('a logged revision and answer pass; a hypothesis revised after evidence warns', () => {
  const revised = qEntry('L004', '2026-10-18', 'revised', `## Question\n${RQ_TITLE}\n\n${CONTRACT('Twice as large on the tail.')}\n## What changed and why\nMade it quantitative.\n`);
  const answered = qEntry('L005', '2026-10-19', 'answered', '## Answer\nYes, on one seed (L002).\n');
  const r = check({
    [D]: DECISION, [E2]: withEvidence('supports'), ...OPENED,
    'log/2026-10-18-L004-revise.md': revised, 'log/2026-10-19-L005-answer.md': answered,
    'questions/RQ1.md': rqFile({ status: 'answered', hyp: 'Twice as large on the tail.', answer: 'Yes, on one seed (L002).' }),
  });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings.filter((w) => w.type !== 'unsealed').map((w) => w.type), ['hypothesis-after-evidence']);
});

test('answering with only invalidated evidence warns', () => {
  const answered = qEntry('L004', '2026-10-18', 'answered', '## Answer\nYes.\n');
  const bug = `---\nid: L005\ntype: bug\ntitle: Leak\ndate: 2026-10-19\nstatus: done\nprovenance: stated\naffects: [L002]\n---\n\n## What was wrong\nx\n## Which entries it affects\nL002\n## Fix\ny\n## Rerun needed\nyes\n`;
  const r = check({
    [D]: DECISION, [E2]: withEvidence('supports'), ...OPENED, 'log/2026-10-18-L004-answer.md': answered,
    'log/2026-10-19-L005-leak.md': bug, 'questions/RQ1.md': rqFile({ status: 'answered', answer: 'Yes.' }),
  });
  assert.deepEqual(r.errors, []);
  assert.ok(r.warnings.some((w) => w.type === 'answer-without-evidence'));
});

test('evidence needs an existing question, and a stance once the entry settles', () => {
  const files = { [D]: DECISION, ...OPENED, 'questions/RQ1.md': rqFile() };
  assert.deepEqual(types(check({ ...files, [E2]: withEvidence(null) })), ['bad-evidence']);
  assert.deepEqual(check({ ...files, [E2]: withEvidence(null).replace('status: done', 'status: running') }).errors, []);
  assert.deepEqual(types(check({ ...files, [E2]: withEvidence('proves') })), ['bad-evidence']);
  assert.deepEqual(types(check({ ...files, [E2]: withEvidence('supports').replace('rq: RQ1', 'rq: RQ9') })), ['bad-evidence']);
});

test('question entries need their event sections; replaced needs replaced_by', () => {
  const dropped = qEntry('L004', '2026-10-18', 'dropped', '## Context\nnothing\n');
  const replaced = qEntry('L004', '2026-10-18', 'replaced', '## Why\nToo broad.\n', 'replaced_by: RQ7\n');
  const base = { [D]: DECISION, [E2]: withEvidence('setup'), ...OPENED };
  assert.deepEqual(types(check({ ...base, 'log/2026-10-18-L004-x.md': dropped, 'questions/RQ1.md': rqFile({ status: 'dropped' }) })), ['missing-section']);
  assert.deepEqual(types(check({ ...base, 'log/2026-10-18-L004-x.md': replaced, 'questions/RQ1.md': rqFile({ status: 'reformulated', extra: 'reformulated_as: RQ7\n' }) })), ['bad-question']);
});

// --- Meetings ----------------------------------------------------------------

const meeting = (id, date, { actions = '', resolves = '', provenance = 'stated', extra = '' } = {}) =>
  `---\nid: ${id}\ntype: meeting\ntitle: Supervisor meeting\ndate: ${date}\nstatus: done\nprovenance: ${provenance}\nattendees: [author, supervisor]\n${actions}${resolves}${extra}---\n\n## Discussed\nThe sweep.\n`;
const ACTIONS = (id) => `actions:\n  - id: ${id}-A1\n    what: Rerun with three seeds\n    who: author\n    due: 2000-01-01\n  - id: ${id}-A2\n    what: Read the dataset paper\n`;

test('action items stay open until a later entry resolves them; overdue ones warn', () => {
  const r = check({ [D]: DECISION, 'log/2026-10-15-L002-meet.md': meeting('L002', '2026-10-15', { actions: ACTIONS('L002') }), 'log/2026-10-22-L003-meet.md': meeting('L003', '2026-10-22', { resolves: 'resolves: [L002-A2]\n' }) });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.actions.map((a) => [a.id, a.resolvedBy]), [['L002-A1', null], ['L002-A2', 'L003']]);
  assert.deepEqual(r.warnings.filter((w) => w.type === 'overdue-action').map((w) => w.detail.split(' ')[0]), ['L002-A1']);
});

test('action ids belong to their entry, are unique, and resolves must name one', () => {
  const wrong = ACTIONS('L002').replace('L002-A2', 'L002-A1').replace('id: L002-A1\n    what: Rerun', 'id: L009-A1\n    what: Rerun');
  const r = check({ [D]: DECISION, 'log/2026-10-15-L002-meet.md': meeting('L002', '2026-10-15', { actions: wrong, resolves: 'resolves: [L001-A5]\n' }) });
  assert.deepEqual(types(r), ['bad-action', 'bad-action']);
  assert.ok(r.errors.some((e) => /L001-A5/.test(e.detail)));
});

test('a settled transcribed meeting needs its speakers confirmed', () => {
  const files = (extra) => ({ [D]: DECISION, 'log/2026-10-15-L002-meet.md': meeting('L002', '2026-10-15', { provenance: 'transcribed', extra }) });
  assert.deepEqual(types(check(files(''))), ['unconfirmed-speakers']);
  assert.deepEqual(check(files('speakers_confirmed: true\n')).errors, []);
});
