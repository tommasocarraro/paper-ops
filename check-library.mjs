#!/usr/bin/env node
// check-library.mjs — a paper's notes point back to the paper, their numbers
// are in it, their code pointers exist, and their equations are quoted from it.
//
//   node check-library.mjs library/{key} [--json]
//   node check-library.mjs library [--json]          every paper, plus index.md
//
// Errors (exit 1):
//   bad-meta            meta.yml is unreadable, misses key/title/authors/year/
//                       fetched/metadata_via/source/status, or its key is not the folder
//   not-indexed         library/index.md has no line for the paper
//   missing-file        status read or verified, but card.md, notes.md,
//                       notation.md or setup.md is missing or empty
//   unpointed           a bullet in card.md, notes.md, notation.md, setup.md or
//                       delta.md (outside a "## Read status" section) names no location (§, Eq., p., Table, Fig.,
//                       Alg., Def., Thm., Example, App., Abstract, file:line, a URL) and no label
//   number-not-in-source  a number in those files does not occur in the paper's
//                       text (LaTeX source, PDF text, abstract, meta.yml); dates
//                       are not claims; labelled lines
//                       (interpretation, derivation, external, code) are exempt
//   bad-code-pointer    a path:line pointer names a file missing from
//                       source/code/ or a line past its end
// Warnings (exit 0):
//   equation-not-verbatim  a $$ … $$ block in equations.md does not occur in the
//                       LaTeX source once spaces are removed (macros may explain it)
// Exit 2 on usage errors.

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { parseYaml } from './log-lib.mjs';

const args = process.argv.slice(2);
const json = args.includes('--json');
const target = args.find((a) => !a.startsWith('--'));
if (!target || !existsSync(target)) {
  console.error('usage: node check-library.mjs library/{key} | library [--json]');
  process.exit(2);
}

const isPaper = (d) => existsSync(join(d, 'meta.yml'));
const papers = isPaper(target)
  ? [target]
  : readdirSync(target).map((f) => join(target, f)).filter((d) => statSync(d).isDirectory() && isPaper(d)).sort();
const libraryDir = isPaper(target) ? join(target, '..') : target;
const index = existsSync(join(libraryDir, 'index.md')) ? readFileSync(join(libraryDir, 'index.md'), 'utf8') : '';

const NOTE_FILES = ['card.md', 'notes.md', 'notation.md', 'setup.md'];
const CHECKED = [...NOTE_FILES, 'delta.md'];
const STATUSES = ['added', 'read', 'verified'];
const POINTER = /§\s*\d|\b(?:sec(?:tion)?s?\.?|eqs?\.|equations?|pp?\.|pages?|tables?|tab\.|fig(?:ure)?s?\.?|alg(?:orithm)?s?\.?|def(?:inition)?s?\.?|thm\.?|theorems?|prop(?:osition)?s?\.?|lemmas?|corollary|ex(?:ample)?s?\.?|remarks?|app(?:endix)?\.?|abstract|footnote)\s*[A-Z]?\d|\bapp(?:endix)?\.?\s*[A-Z](?:\.\d+)?\b|\babstract\b|[\w./-]+\.\w+:\d+|https?:\/\//i;
const LABEL = /\((?:interpretation|derivation|external|code|run|author|not (?:stated|specified)[^)]*)\b/i;
const CODE_POINTER = /([\w./-]+\.(?:py|ipynb|js|ts|c|cc|cpp|h|hpp|java|jl|r|m|rs|go|sh|yaml|yml|toml|cfg|json|md|txt)):(\d+)(?:-(\d+))?/g;

const num = (s) => String(Number(s.replace(/,/g, '')));
// Numbers a note claims: not pointers, IDs, list markers or markdown syntax.
function claimed(line) {
  const t = line
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/, ' ')
    .replace(CODE_POINTER, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
    .replace(/§\s*[\d.]+|\b(?:sec(?:tion)?s?\.?|eqs?\.|equations?|pp?\.|pages?|tables?|tab\.|fig(?:ure)?s?\.?|alg(?:orithm)?s?\.?|def(?:inition)?s?\.?|thm\.?|theorems?|prop(?:osition)?s?\.?|lemmas?|corollary|ex(?:ample)?s?\.?|remarks?|app(?:endix)?\.?|footnote)\s*[A-Z]?[\d.,–-]+(?:\s*(?:and|,|–|-)\s*[\d.]+)*/gi, ' ')
    .replace(/\b[A-Z]{1,3}\d+\b/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/\$[^$]*\$/g, ' ');
  return [...t.matchAll(/(?<![\w.])\d{1,3}(?:,\d{3})+(?:\.\d+)?|(?<![\w.])\d+(?:\.\d+)?(?:e-?\d+)?/gi)].map((m) => m[0]);
}

function sourceText(dir) {
  let text = '';
  const tex = join(dir, 'source', 'tex');
  if (existsSync(tex)) {
    for (const f of readdirSync(tex, { recursive: true })) {
      const p = join(tex, String(f));
      if (!/\.(tex|bbl|txt|csv|dat)$/i.test(p) || !statSync(p).isFile()) continue;
      const raw = readFileSync(p, 'utf8');
      // Commented-out LaTeX is not part of the published paper.
      text += `\n${/\.tex$/i.test(p) ? raw.replace(/(?<!\\)%.*$/gm, '') : raw}`;
    }
  }
  for (const f of ['paper.txt', 'abstract.txt']) if (existsSync(join(dir, 'source', f))) text += `\n${readFileSync(join(dir, 'source', f), 'utf8')}`;
  // Fetched metadata (venue, volume, IDs) is a source too.
  if (existsSync(join(dir, 'meta.yml'))) text += `\n${readFileSync(join(dir, 'meta.yml'), 'utf8')}`;
  return text;
}

const results = [];
for (const dir of papers) {
  const key = basename(dir);
  const errors = [];
  const warnings = [];
  const e = (type, file, line, detail) => errors.push({ type, file, line, detail });

  let meta = {};
  try {
    meta = parseYaml(readFileSync(join(dir, 'meta.yml'), 'utf8'));
    for (const k of ['key', 'title', 'authors', 'year', 'fetched', 'metadata_via', 'source', 'status']) {
      if (meta[k] == null || meta[k] === '' || (Array.isArray(meta[k]) && !meta[k].length)) e('bad-meta', 'meta.yml', null, `${k} is missing`);
    }
    if (meta.key && meta.key !== key) e('bad-meta', 'meta.yml', null, `key ${meta.key} is not the folder name ${key}`);
    if (meta.status && !STATUSES.includes(meta.status)) e('bad-meta', 'meta.yml', null, `status "${meta.status}" is not one of ${STATUSES.join(', ')}`);
  } catch (err) {
    e('bad-meta', 'meta.yml', null, err.message);
  }
  if (!new RegExp(`\\*\\*${key}\\*\\*`).test(index)) e('not-indexed', 'index.md', null, `no line for ${key}`);

  if (['read', 'verified'].includes(meta.status)) {
    for (const f of NOTE_FILES) {
      if (!existsSync(join(dir, f)) || !readFileSync(join(dir, f), 'utf8').trim()) e('missing-file', f, null, `required once status is ${meta.status}`);
    }
  }

  const source = sourceText(dir);
  const sourceNumbers = new Set([...source.matchAll(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d*\.?\d+(?:e-?\d+)?/gi)].map((m) => num(m[0])));
  const codeDir = join(dir, 'source', 'code');

  const files = [...CHECKED, 'equations.md', 'code.md', 'qa.md'].filter((f) => existsSync(join(dir, f)));
  for (const f of files) {
    const lines = readFileSync(join(dir, f), 'utf8').split('\n');
    let fence = false;
    let math = false;
    let status = false;
    lines.forEach((line, k) => {
      if (/^#{1,6}\s/.test(line)) status = /^#{1,6}\s+read status\b/i.test(line);
      if (/^\s*```/.test(line)) { fence = !fence; return; }
      if (/^\s*\$\$/.test(line) && !/^\s*\$\$.*\$\$\s*$/.test(line)) { math = !math; return; }
      if (fence || math) return;
      for (const m of line.matchAll(CODE_POINTER)) {
        const file = join(codeDir, m[1]);
        if (!existsSync(codeDir)) { e('bad-code-pointer', f, k + 1, `${m[0]}: no source/code/ clone`); continue; }
        if (!existsSync(file)) { e('bad-code-pointer', f, k + 1, `${m[1]} is not in source/code/`); continue; }
        const n = readFileSync(file, 'utf8').split('\n').length;
        if (Number(m[3] ?? m[2]) > n) e('bad-code-pointer', f, k + 1, `${m[1]} has ${n} lines, pointer says ${m[3] ?? m[2]}`);
      }
      // "## Read status" records how the paper was read, not what it says.
      if (!CHECKED.includes(f) || status) return;
      const item = /^\s*(?:[-*+]|\d+\.)\s+\S/.test(line) || (/^\s*\|/.test(line) && !/^\s*\|[\s:|-]+\|\s*$/.test(line) && !/^\s*\|[\s:|-]+\|\s*$/.test(lines[k + 1] ?? ''));
      const labelled = LABEL.test(line);
      if (item && !labelled && !POINTER.test(line) && !/^\s*\|/.test(line)) e('unpointed', f, k + 1, line.trim().slice(0, 100));
      if (labelled || /^\s*#/.test(line)) return;
      for (const n of claimed(line)) {
        if (!sourceNumbers.has(num(n))) e('number-not-in-source', f, k + 1, `${n}: ${line.trim().slice(0, 90)}`);
      }
    });
  }

  if (existsSync(join(dir, 'equations.md')) && meta.source === 'tex') {
    const flat = source.replace(/\s+/g, '');
    const text = readFileSync(join(dir, 'equations.md'), 'utf8');
    for (const m of text.matchAll(/\$\$([\s\S]+?)\$\$/g)) {
      const eq = m[1].replace(/\s+/g, '');
      if (eq.length > 3 && !flat.includes(eq)) {
        warnings.push({ type: 'equation-not-verbatim', file: 'equations.md', line: text.slice(0, m.index).split('\n').length, detail: m[1].trim().slice(0, 80) });
      }
    }
  }
  results.push({ key, status: meta.status ?? null, errors, warnings });
}

const total = results.reduce((n, r) => n + r.errors.length, 0);
if (json) console.log(JSON.stringify({ papers: results }, null, 2));
else {
  for (const r of results) {
    if (!r.errors.length && !r.warnings.length) { console.log(`OK: ${r.key} (${r.status})`); continue; }
    console.log(`${r.key} (${r.status}): ${r.errors.length} problem(s)${r.warnings.length ? `, ${r.warnings.length} warning(s)` : ''}`);
    for (const x of r.errors) console.log(`  ${x.file}${x.line ? `:${x.line}` : ''}  ${x.type}  ${x.detail}`);
    for (const x of r.warnings) console.log(`  ${x.file}:${x.line}  ${x.type}  ${x.detail}`);
  }
}
process.exit(total ? 1 : 0);
