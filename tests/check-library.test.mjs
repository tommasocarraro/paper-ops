// node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = join(dirname(fileURLToPath(import.meta.url)), '..', 'check-library.mjs');

const META = (status = 'added') => `key: smith2020logic\ntitle: "Logic for nets"\nauthors:\n  - "Ann Smith"\nyear: "2020"\nfetched: 2026-10-15\nmetadata_via: arxiv-api\nsource: tex\nstatus: ${status}\n`;
const TEX = '\\section{Results}\nWe reach 0.874 accuracy with $p=2$ over 5 seeds.\n% An earlier draft said 0.912.\n\\begin{equation}\nf(x) = \\sum_i w_i x_i\n\\end{equation}\n';

// A throwaway library with one paper; files maps path under the paper -> content.
function check(files, { indexed = true } = {}) {
  const lib = mkdtempSync(join(tmpdir(), 'library-'));
  const dir = join(lib, 'smith2020logic');
  try {
    for (const [path, content] of Object.entries({ 'meta.yml': META(), 'source/tex/main.tex': TEX, ...files })) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), content);
    }
    writeFileSync(join(lib, 'index.md'), indexed ? '- **smith2020logic** · Logic for nets (2020) · added\n' : '');
    const run = spawnSync(process.execPath, [script, dir, '--json'], { encoding: 'utf8' });
    return { status: run.status, ...JSON.parse(run.stdout).papers[0] };
  } finally {
    rmSync(lib, { recursive: true, force: true });
  }
}
const types = (r) => r.errors.map((e) => e.type);

test('pointed notes with numbers from the paper pass', () => {
  const r = check({ 'card.md': '# Card\n\n- Reaches 0.874 accuracy over 5 seeds (§4, Table 2).\n- Probably works on graphs too (interpretation).\n' });
  assert.deepEqual(r.errors, []);
});

test('a bullet with no location or label fails, except under Read status', () => {
  assert.deepEqual(types(check({ 'notes.md': '- The method is fast.\n' })), ['unpointed']);
  assert.deepEqual(check({ 'card.md': '## Read status\n\n- Verified: 19 statements re-checked.\n' }).errors, []);
  assert.deepEqual(types(check({ 'card.md': '## Read status\n\n- ok\n\n## Results\n\n- The method is fast.\n' })), ['unpointed']);
});

test('a number the paper does not contain fails unless labelled', () => {
  assert.deepEqual(types(check({ 'card.md': '- Reaches 0.91 accuracy (Table 2).\n' })), ['number-not-in-source']);
  assert.deepEqual(check({ 'card.md': '- Would reach 0.91 with tuning (interpretation).\n' }).errors, []);
});

test('numbers only in LaTeX comments are not in the paper', () => {
  assert.deepEqual(types(check({ 'card.md': '- Reached 0.912 in a draft (Table 2).\n' })), ['number-not-in-source']);
});

test('location numbers are not claims', () => {
  assert.deepEqual(check({ 'notes.md': '- Defined in §3.2, Eq. 14, p. 27, Table 9 and Fig. 11.\n' }).errors, []);
  assert.deepEqual(check({ 'notes.md': '- Derivatives are in the appendix (App. C).\n- Limits as p grows (App. B.5).\n- The running task (Example 12).\n' }).errors, []);
});

test('code pointers must exist at the pinned commit', () => {
  const files = { 'source/code/ltn/core.py': 'a\nb\nc\n', 'code.md': '| x | ltn/core.py:3 | yes |\n| y | ltn/core.py:40 | yes |\n| z | ltn/other.py:1 | no |\n' };
  const r = check(files);
  assert.deepEqual(types(r), ['bad-code-pointer', 'bad-code-pointer']);
});

test('equations not found verbatim in the LaTeX source warn', () => {
  const r = check({ 'equations.md': '### E1 (Eq. 1)\n$$\nf(x) = \\sum_i w_i x_i\n$$\n\n### E2\n$$\ng(x) = 1\n$$\n' });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings.map((w) => w.type), ['equation-not-verbatim']);
});

test('read status needs the note files; the index needs the paper; meta needs its fields', () => {
  assert.deepEqual(types(check({ 'meta.yml': META('read') })), ['missing-file', 'missing-file', 'missing-file', 'missing-file']);
  assert.deepEqual(types(check({}, { indexed: false })), ['not-indexed']);
  assert.deepEqual(types(check({ 'meta.yml': META().replace('year: "2020"\n', '') })), ['bad-meta']);
});
