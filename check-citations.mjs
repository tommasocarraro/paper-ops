#!/usr/bin/env node
// check-citations.mjs — every citation must trace to a fetched reference.
//
//   node check-citations.mjs papers/{slug} [--json]
//
// Errors (exit 1):
//   missing-bib    a \cite key that is not in references.bib
//   no-ref-note    a cited key with no refs/{key}.md (never fetched)
//   bad-status     a cited key whose refs note is not verified / metadata-only
// Warnings (exit 0):
//   metadata-only  cited from the abstract alone
//   unused         in references.bib but never cited
// Exit 2 on usage errors.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const json = args.includes('--json');
const dir = args.find((a) => !a.startsWith('--'));

if (!dir || !existsSync(dir)) {
  console.error('usage: node check-citations.mjs papers/{slug} [--json]');
  process.exit(2);
}

const CITE_RE = /\\(?:[A-Za-z]*cite[A-Za-z]*)\*?(?:\[[^\]]*\])*\{([^}]*)\}/g;
const stripComment = (line) => line.replace(/(?<!\\)%.*$/, '');

// key -> first place it is cited
const cited = new Map();
const texFiles = [];
const sectionsDir = join(dir, 'sections');
if (existsSync(sectionsDir)) {
  for (const f of readdirSync(sectionsDir).filter((n) => n.endsWith('.tex')).sort()) {
    texFiles.push(`sections/${f}`);
  }
}
if (existsSync(join(dir, 'main.tex'))) texFiles.push('main.tex');

for (const file of texFiles) {
  readFileSync(join(dir, file), 'utf8').split('\n').forEach((line, i) => {
    for (const m of stripComment(line).matchAll(CITE_RE)) {
      for (const key of m[1].split(',').map((k) => k.trim()).filter(Boolean)) {
        if (!cited.has(key)) cited.set(key, `${file}:${i + 1}`);
      }
    }
  });
}

const bibKeys = new Set();
const bibPath = join(dir, 'references.bib');
if (existsSync(bibPath)) {
  for (const m of readFileSync(bibPath, 'utf8').matchAll(/^\s*@(\w+)\s*\{\s*([^,\s]+)\s*,/gm)) {
    if (!['comment', 'string', 'preamble'].includes(m[1].toLowerCase())) bibKeys.add(m[2]);
  }
}

// key -> status, from the frontmatter of refs/*.md
const notes = new Map();
const refsDir = join(dir, 'refs');
if (existsSync(refsDir)) {
  for (const f of readdirSync(refsDir).filter((n) => n.endsWith('.md'))) {
    const front = readFileSync(join(refsDir, f), 'utf8').match(/^---\n([\s\S]*?)\n---/);
    if (!front) continue;
    const key = front[1].match(/^key:\s*(\S+)/m)?.[1];
    const status = front[1].match(/^status:\s*(\S+)/m)?.[1] ?? 'missing';
    if (key) notes.set(key, status);
  }
}

const errors = [];
const warnings = [];
for (const [key, where] of cited) {
  if (!bibKeys.has(key)) errors.push({ type: 'missing-bib', key, where });
  const status = notes.get(key);
  if (status === undefined) errors.push({ type: 'no-ref-note', key, where });
  else if (status === 'metadata-only') warnings.push({ type: 'metadata-only', key, where });
  else if (status !== 'verified') errors.push({ type: 'bad-status', key, where, status });
}
for (const key of bibKeys) {
  if (!cited.has(key)) warnings.push({ type: 'unused', key });
}

if (json) {
  console.log(JSON.stringify({ cited: cited.size, bib: bibKeys.size, notes: notes.size, errors, warnings }, null, 2));
} else {
  console.log(`Cited keys: ${cited.size} · references.bib: ${bibKeys.size} · refs notes: ${notes.size}`);
  const say = {
    'missing-bib': (e) => `${e.where}  \\cite{${e.key}} is not in references.bib`,
    'no-ref-note': (e) => `${e.where}  ${e.key} has no refs/ note: it was never fetched`,
    'bad-status': (e) => `${e.where}  ${e.key} has refs status "${e.status}"`,
    'metadata-only': (e) => `${e.where}  ${e.key} is cited from its abstract only`,
    unused: (e) => `${e.key} is in references.bib but never cited`,
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
