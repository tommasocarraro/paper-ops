// node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = join(dirname(fileURLToPath(import.meta.url)), '..', 'check-numbers.mjs');

const FACTS = `# Claims ledger

## Results

- **F012** · p. 14 · Reranker NDCG@10 is 0.412 against 0.431 for the retriever.
- **F013** · author-stated 2026-10-12 · ~~Accuracy is 91.3~~ superseded by F020
- **F020** · p. 15 · Accuracy is 90.8, averaged over 3 seeds.
- **F021** · p. 16 · Learning rate is 3e-5 with weight decay 10^-4,
  trained on 10,000 users.

## Figures and tables

| ID | Where | Kind | Shows | Numbers available from |
|----|-------|------|-------|------------------------|
| F030 | p. 17 | plot | Recall at cutoff 20 | image only |
`;

// Runs the check on a throwaway paper folder; files maps relative path -> content.
function check(files) {
  const dir = mkdtempSync(join(tmpdir(), 'paper-ops-'));
  try {
    for (const [path, content] of Object.entries({ 'facts.md': FACTS, ...files })) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), content);
    }
    const run = spawnSync(process.execPath, [script, dir, '--json'], { encoding: 'utf8' });
    return { status: run.status, ...JSON.parse(run.stdout) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const section = (tex, extra = {}) => check({ 'sections/results.tex': tex, ...extra });
const types = (result) => result.errors.map((e) => e.type);

test('numbers in the facts the paragraph names pass', () => {
  const r = section('The reranker reaches 0.412 against 0.431.\n% facts: F012\n');
  assert.equal(r.status, 0);
  assert.equal(r.checked, 2);
});

test('page pointers, dates and fact IDs back nothing', () => {
  const r = section('We train 14 models in 2026 with 15 or 16 settings. % facts: F012, F013, F020, F021\n');
  assert.deepEqual(r.errors.filter((e) => e.type === 'unbacked').map((e) => e.number), ['14', '2026', '15', '16']);
});

test('a superseded entry backs nothing and cannot be named', () => {
  const r = section('Accuracy reaches 91.3. % facts: F013\n');
  assert.deepEqual(types(r), ['superseded-fact', 'superseded']);
});

test('a number from a fact the paragraph does not name is an error', () => {
  const r = section('Accuracy is 90.8. % facts: F012\n');
  assert.deepEqual(types(r), ['wrong-fact']);
  assert.deepEqual(r.errors[0].in, ['F020']);
});

test('a ledger number in a paragraph with no facts comment is an error', () => {
  assert.deepEqual(types(section('Accuracy is 90.8.\n')), ['no-facts-comment']);
});

test('a facts comment naming an unknown ID is an error', () => {
  assert.deepEqual(types(section('Some prose. % facts: F099\n')), ['unknown-fact']);
});

test('scientific notation is compared by value', () => {
  const ok = section('Learning rate $3 \\times 10^{-5}$, decay 1e-4, on 10k users. % facts: F021\n');
  assert.equal(ok.status, 0);
  assert.equal(ok.checked, 3);
  const bad = section('Learning rate 5e-5 and decay $10^{-3}$. % facts: F021\n');
  assert.deepEqual(bad.errors.map((e) => e.number), ['5e-5', '1e-3']);
});

test('single digits are ignored unless they count seeds, runs, folds...', () => {
  assert.equal(section('We keep the top-5 items in 2 stages.\n').checked, 0);
  assert.equal(section('Averaged over 3 seeds. % facts: F020\n').status, 0);
  assert.equal(section('Averaged over three random seeds. % facts: F020\n').status, 0);
  assert.deepEqual(types(section('Averaged over 5 seeds with 5-fold validation. % facts: F020\n')), ['unbacked', 'unbacked']);
  assert.deepEqual(types(section('Averaged over five runs. % facts: F020\n')), ['unbacked']);
});

test('paragraphs are separated by blank lines; a lone facts comment joins the one above', () => {
  const r = section('First reaches 0.412.\n% facts: F012\n\nSecond reaches 0.431\nand 90.8.\n\n% facts: F020\n');
  assert.deepEqual(r.errors.map((e) => [e.type, e.number, e.line]), [['wrong-fact', '0.431', 4]]);
});

test('todo blocks, comments, refs and lengths are not claims', () => {
  const r = section([
    '\\todo{dataset size, maybe',
    'around 5000 users}',
    '% an old note about 777 items',
    'See \\cite{smith2019deep} and Table~\\ref{tab:r12} \\vspace{12pt} \\includegraphics[width=0.48\\linewidth]{figures/f77}.',
  ].join('\n'));
  assert.equal(r.status, 0);
  assert.equal(r.checked, 0);
});

test('brief.md and figures/data back any paragraph, minus headings and dates', () => {
  const extra = {
    'brief.md': '## 12. Target\n\n- **Deadline:** 2027-01-15\n- **Page limit:** 11\n',
    'figures/data/main.csv': 'model,recall@20\nours,0.733\n',
  };
  assert.equal(section('Recall is 0.733 within 11 pages.\n', extra).status, 0);
  assert.deepEqual(section('We ran 12 jobs in 2027.\n', extra).errors.map((e) => e.number), ['12', '2027']);
});

test('generated tables are backed by any live fact, never by a superseded one', () => {
  const ok = check({ 'tables/main.tex': '\\begin{tabular}{lc}\nOurs & 0.412 \\\\\nBase & 90.8 \\\\\n\\end{tabular}\n' });
  assert.equal(ok.status, 0);
  const bad = check({ 'tables/main.tex': '\\begin{tabular}{lc}\nOurs & 91.3 \\\\\nBase & 55.5 \\\\\n\\end{tabular}\n' });
  assert.deepEqual(types(bad), ['superseded', 'unbacked']);
});

test('the figure inventory backs what it shows, not where it is', () => {
  assert.equal(section('Recall at cutoff 20 is plotted. % facts: F030\n').status, 0);
  assert.deepEqual(types(section('We plot 17 curves. % facts: F030\n')), ['unbacked']);
});
