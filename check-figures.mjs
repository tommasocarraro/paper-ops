#!/usr/bin/env node
// check-figures.mjs — figures and tables are present, traceable and used.
//
//   node check-figures.mjs papers/{slug} [--json]
//
// Errors (exit 1):
//   missing-file     \includegraphics or \input{figures|tables/...} target absent
//   no-caption       a figure/table environment without \caption
//   no-label         a figure/table environment without \label
//   never-referenced a figure/table label no \ref points at
//   no-provenance    a CSV in figures/data/ with no manifest row naming its source
// Warnings (exit 0):
//   unused-file      a built figure or table that no section includes
//   not-built        a manifest row still planned or waiting-author
// Exit 2 on usage errors.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename, extname } from 'node:path';

const args = process.argv.slice(2);
const json = args.includes('--json');
const dir = args.find((a) => !a.startsWith('--'));

if (!dir || !existsSync(dir)) {
  console.error('usage: node check-figures.mjs papers/{slug} [--json]');
  process.exit(2);
}

const list = (sub, ext) => {
  const d = join(dir, sub);
  return existsSync(d) ? readdirSync(d).filter((f) => ext.includes(extname(f))).sort() : [];
};
const stripComments = (text) => text.split('\n').map((l) => l.replace(/(?<!\\)%.*$/, '')).join('\n');
const lineOf = (text, index) => text.slice(0, index).split('\n').length;

const texFiles = list('sections', ['.tex']).map((f) => `sections/${f}`);
if (existsSync(join(dir, 'main.tex'))) texFiles.push('main.tex');

const errors = [];
const warnings = [];
const included = new Set();
const labels = new Map();
const refs = new Set();
const IMAGE_EXTS = ['.pdf', '.png', '.jpg', '.jpeg', '.eps'];

for (const file of texFiles) {
  const text = stripComments(readFileSync(join(dir, file), 'utf8'));

  for (const m of text.matchAll(/\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g)) {
    const target = m[1].trim();
    const candidates = extname(target) ? [target] : IMAGE_EXTS.map((e) => target + e);
    const found = candidates.find((c) => existsSync(join(dir, c)));
    if (found) included.add(found);
    else errors.push({ type: 'missing-file', where: `${file}:${lineOf(text, m.index)}`, target });
  }
  for (const m of text.matchAll(/\\input\{((?:figures|tables)\/[^}]+)\}/g)) {
    const target = extname(m[1].trim()) ? m[1].trim() : `${m[1].trim()}.tex`;
    if (existsSync(join(dir, target))) included.add(target);
    else errors.push({ type: 'missing-file', where: `${file}:${lineOf(text, m.index)}`, target });
  }
  for (const m of text.matchAll(/\\begin\{(figure|table)(\*?)\}([\s\S]*?)\\end\{\1\2\}/g)) {
    const where = `${file}:${lineOf(text, m.index)}`;
    const label = m[3].match(/\\label\{([^}]+)\}/)?.[1];
    if (!/\\caption\s*[[{]/.test(m[3])) errors.push({ type: 'no-caption', where, env: m[1] });
    if (!label) errors.push({ type: 'no-label', where, env: m[1] });
    else labels.set(label, where);
  }
  for (const m of text.matchAll(/\\(?:[A-Za-z]*ref)\*?\{([^}]+)\}/g)) {
    for (const key of m[1].split(',')) refs.add(key.trim());
  }
}

for (const [label, where] of labels) {
  if (!refs.has(label)) errors.push({ type: 'never-referenced', where, label });
}

// Manifest rows: | Name | Kind | Message | Section | Width | Provenance | Path | Status |
const manifestPath = join(dir, 'figures', 'figures.md');
const manifest = new Map();
if (existsSync(manifestPath)) {
  for (const line of readFileSync(manifestPath, 'utf8').split('\n')) {
    if (!line.trim().startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 8 || cells[0] === 'Name' || /^-+$/.test(cells[0])) continue;
    manifest.set(cells[0].replace(/`/g, ''), { provenance: cells[5], status: cells[7] });
  }
}

for (const csv of list('figures/data', ['.csv'])) {
  const row = manifest.get(basename(csv, '.csv'));
  if (!row || !row.provenance || /^[-—]?$/.test(row.provenance)) {
    errors.push({ type: 'no-provenance', where: `figures/data/${csv}` });
  }
}
for (const [name, row] of manifest) {
  if (/^(planned|waiting-author)$/.test(row.status)) warnings.push({ type: 'not-built', name, status: row.status });
}

const built = [
  ...list('figures', ['.pdf', '.png', '.jpg', '.jpeg']).map((f) => `figures/${f}`),
  ...list('figures', ['.tex']).map((f) => `figures/${f}`),
  ...list('tables', ['.tex']).map((f) => `tables/${f}`),
];
for (const file of built) {
  if (!included.has(file)) warnings.push({ type: 'unused-file', where: file });
}

if (json) {
  console.log(JSON.stringify({ floats: labels.size, included: included.size, manifest: manifest.size, errors, warnings }, null, 2));
} else {
  console.log(`Labelled figures/tables: ${labels.size} · included files: ${included.size} · manifest rows: ${manifest.size}`);
  const say = {
    'missing-file': (e) => `${e.where}  ${e.target} does not exist`,
    'no-caption': (e) => `${e.where}  ${e.env} has no \\caption`,
    'no-label': (e) => `${e.where}  ${e.env} has no \\label`,
    'never-referenced': (e) => `${e.where}  ${e.label} is never referenced in the text`,
    'no-provenance': (e) => `${e.where}  has no manifest row naming where its numbers come from`,
    'unused-file': (e) => `${e.where}  is built but not included in any section`,
    'not-built': (e) => `${e.name}  is still "${e.status}" in figures/figures.md`,
  };
  if (errors.length) {
    console.log(`\n${errors.length} error(s):`);
    for (const e of errors) console.log(`  ${say[e.type](e)}`);
  }
  if (warnings.length) {
    console.log(`\n${warnings.length} warning(s):`);
    for (const w of warnings) console.log(`  ${say[w.type](w)}`);
  }
  if (!errors.length && !warnings.length) console.log('OK');
}

process.exit(errors.length ? 1 : 0);
