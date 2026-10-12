#!/usr/bin/env node
// check-numbers.mjs — every number in sections/*.tex and tables/*.tex must
// appear in the ledger.
//
//   node check-numbers.mjs papers/{slug} [--json]
//
// Ledger = facts.md + brief.md + figures/data/*.csv (whose provenance
// check-figures.mjs enforces). Numbers are compared by value, so 0.50 matches
// 0.5, 10,000 matches 10000 and 10k, and 80\% matches 80%. Single-digit
// integers are ignored (section counts, "two modules", top-5 style prose).
// Exit 0 when every number is backed, 1 otherwise, 2 on usage errors.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const json = args.includes('--json');
const dir = args.find((a) => !a.startsWith('--'));

if (!dir || !existsSync(dir)) {
  console.error('usage: node check-numbers.mjs papers/{slug} [--json]');
  process.exit(2);
}

const NUMBER_RE = /(?<![A-Za-z\d.])(\d{1,3}(?:(?:,|\{,\})\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)(k\b)?/g;

function normalize(raw, kilo) {
  const value = parseFloat(raw.replace(/\{,\}|,/g, ''));
  return String(kilo ? value * 1000 : value);
}

function numbersIn(text) {
  const found = [];
  for (const m of text.matchAll(NUMBER_RE)) {
    found.push({ raw: m[0], value: normalize(m[1], m[2]) });
  }
  return found;
}

// Drop the parts of a LaTeX line that hold numbers which are not claims.
function stripLatex(line) {
  return line
    .replace(/(?<!\\)%.*$/, '')
    .replace(/\\(?:cite[a-z]*|[a-z]*ref|label|input|include|bibliography|bibliographystyle)\*?(?:\[[^\]]*\])*\{[^}]*\}/g, '')
    .replace(/\\includegraphics(?:\[[^\]]*\])?\{[^}]*\}/g, '')
    .replace(/\\begin\{(?:tabular|tabularx|array)\*?\}(?:\{[^}]*\})+/g, '')
    .replace(/\\(?:begin|end)\{[^}]*\}(?:\[[^\]]*\])?/g, '')
    .replace(/\\(?:vspace|hspace|setlength|addtolength)\*?(?:\{[^}]*\})+/g, '')
    .replace(/\d*\.?\d+\s*\\(?:textwidth|linewidth|columnwidth|textheight)/g, '')
    .replace(/\d*\.?\d+\s*(?:pt|em|ex|cm|mm|in)\b/g, '')
    .replace(/\\\\\[[^\]]*\]/g, '')
    .replace(/\\todo\{[^}]*\}/g, '');
}

const ledger = new Set();
for (const name of ['facts.md', 'brief.md']) {
  const path = join(dir, name);
  if (!existsSync(path)) continue;
  for (const n of numbersIn(readFileSync(path, 'utf8'))) ledger.add(n.value);
}

const dataDir = join(dir, 'figures', 'data');
if (existsSync(dataDir)) {
  for (const f of readdirSync(dataDir).filter((n) => n.endsWith('.csv'))) {
    for (const n of numbersIn(readFileSync(join(dataDir, f), 'utf8'))) ledger.add(n.value);
  }
}

const files = [];
for (const sub of ['sections', 'tables']) {
  const d = join(dir, sub);
  if (!existsSync(d)) continue;
  for (const f of readdirSync(d).filter((n) => n.endsWith('.tex')).sort()) files.push(`${sub}/${f}`);
}

const unbacked = [];
let checked = 0;
for (const file of files) {
  const lines = readFileSync(join(dir, file), 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const n of numbersIn(stripLatex(line))) {
      if (/^\d$/.test(n.value)) continue;
      checked += 1;
      if (!ledger.has(n.value)) {
        unbacked.push({ file, line: i + 1, number: n.raw, text: line.trim() });
      }
    }
  });
}

if (json) {
  console.log(JSON.stringify({ files: files.length, checked, unbacked }, null, 2));
} else if (files.length === 0) {
  console.log('No sections/*.tex or tables/*.tex files yet.');
} else if (unbacked.length === 0) {
  console.log(`OK: ${checked} numbers in ${files.length} files, all found in the ledger.`);
} else {
  console.log(`${unbacked.length} of ${checked} numbers are not in facts.md, brief.md or figures/data/:\n`);
  for (const u of unbacked) {
    console.log(`  ${u.file}:${u.line}  ${u.number}`);
    console.log(`      ${u.text.slice(0, 110)}`);
  }
  console.log('\nRemove them, replace with \\todo{...}, or ask the author for the source.');
}

process.exit(unbacked.length ? 1 : 0);
