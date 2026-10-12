#!/usr/bin/env node
// check-numbers.mjs — every number in sections/*.tex and tables/*.tex must
// trace to the ledger, and to the facts its paragraph names.
//
//   node check-numbers.mjs papers/{slug} [--json]
//
// The ledger is read per entry. Only the statement of a facts.md entry counts
// (`- **F012** · p. 14 · statement`): IDs, page pointers and author-stated
// dates back nothing, and neither does a struck or superseded entry. brief.md
// (minus headings and dates) and figures/data/*.csv (whose provenance
// check-figures.mjs enforces) form a shared pool with no fact IDs.
//
// A paragraph is a run of lines between blank lines. Each of its numbers must
// be in a fact named by its `% facts: F012, F031` comment, or in the pool.
// tables/*.tex are generated and carry no comments, so any live fact backs
// them.
//
// Errors (exit 1):
//   unbacked          the number is nowhere in the ledger
//   wrong-fact        it is in the ledger, but not in the facts the paragraph names
//   no-facts-comment  it is in the ledger, but the paragraph names no facts
//   superseded        it appears only in a superseded entry
//   unknown-fact      a `% facts:` comment names an ID that facts.md does not have
//   superseded-fact   a `% facts:` comment names a superseded entry
// Exit 2 on usage errors.
//
// Numbers are compared by value, so 0.50 matches 0.5, 10,000 matches 10000 and
// 10k, 80\% matches 80%, and 3e-5 matches 3 \times 10^{-5}. Single-digit
// integers are ignored (section counts, top-5 style prose) unless they count
// something a paper must not invent: "3 seeds", "5-fold", "7 runs". The same
// holds for those counts written as words ("three seeds").

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const json = args.includes('--json');
const dir = args.find((a) => !a.startsWith('--'));

if (!dir || !existsSync(dir)) {
  console.error('usage: node check-numbers.mjs papers/{slug} [--json]');
  process.exit(2);
}

const NUMBER_RE = /(?<![A-Za-z\d.])(\d{1,3}(?:(?:,|\{,\}|\\,)\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)(k\b)?/g;
const WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
const WORD_RE = new RegExp(`\\b(${Object.keys(WORDS).join('|')})\\b`, 'gi');
// What follows a small number when it is a count the ledger has to hold.
const COUNT_RE = /^[ \t~-]*(?:(?:random|different|independent|distinct|separate|training|attention|hidden|encoder|decoder|transformer|human)[ \t~-]+){0,2}(?:seeds?|runs?|folds?|layers?|epochs?|trials?|repetitions?|iterations?|annotators?|raters?|participants?|heads?|GPUs?)\b/i;

function normalize(raw, kilo) {
  const plain = raw.replace(/\{,\}|\\,|,/g, '');
  return String(Number(kilo && !/e/i.test(plain) ? `${plain}e3` : plain));
}

// 3 \times 10^{-5} and 10^{-4} become 3e-5 and 1e-4. Never crosses a line.
function sci(text) {
  const exp = (e) => e.replace('−', '-');
  return text
    .replace(/(\d+(?:\.\d+)?)[ \t]*(?:\\times|\\cdot|×|\*|x)[ \t]*10[ \t]*\^[ \t]*\{?[ \t]*([-+−]?\d+)[ \t]*\}?/g, (_, m, e) => `${m}e${exp(e)}`)
    .replace(/(?<![\d.])10[ \t]*\^[ \t]*\{?[ \t]*([-+−]?\d+)[ \t]*\}?/g, (_, e) => `1e${exp(e)}`);
}

// Every number a piece of ledger text states, digits or words.
function ledgerNumbers(text) {
  const t = sci(text);
  const values = new Set();
  for (const m of t.matchAll(NUMBER_RE)) values.add(normalize(m[1], m[2]));
  for (const m of t.matchAll(WORD_RE)) values.add(String(WORDS[m[1].toLowerCase()]));
  return values;
}

// The numbers a piece of the paper claims, with their offsets.
function claimedNumbers(text) {
  const found = [];
  for (const m of text.matchAll(NUMBER_RE)) {
    const value = normalize(m[1], m[2]);
    if (/^\d$/.test(value) && !COUNT_RE.test(text.slice(m.index + m[0].length))) continue;
    found.push({ raw: m[0], value, index: m.index });
  }
  for (const m of text.matchAll(WORD_RE)) {
    if (!COUNT_RE.test(text.slice(m.index + m[0].length))) continue;
    found.push({ raw: m[0], value: String(WORDS[m[1].toLowerCase()]), index: m.index });
  }
  return found.sort((a, b) => a.index - b.index);
}

const factKey = (id) => `F${parseInt(id.slice(1), 10)}`;

// facts.md → key -> { id, superseded, numbers }
function parseFacts(text) {
  const entries = [];
  let current = null;
  for (const line of text.split('\n')) {
    const bullet = line.match(/^\s*[-*]\s+(~~)?\s*\*\*(F\d+)\*\*(.*)$/);
    const row = line.match(/^\s*\|\s*`?(F\d+)`?\s*\|(.*)\|\s*$/);
    if (bullet) {
      const parts = bullet[3].split('·').map((p) => p.trim());
      // parts[0] is what sits between the ID and the first separator; parts[1] is the pointer.
      const statement = parts.length >= 3 ? parts.slice(2).join(' ') : parts.slice(1).join(' ');
      current = { id: bullet[2], struck: Boolean(bullet[1]), statement };
      entries.push(current);
    } else if (row) {
      // Figure inventory row: | ID | Where | Kind | Shows | Numbers available from |
      current = null;
      entries.push({ id: row[1], struck: false, statement: row[2].split('|').slice(1).join(' ') });
    } else if (current && /^\s+\S/.test(line) && !/^\s*[-*]\s/.test(line)) {
      current.statement += ` ${line.trim()}`;
    } else {
      current = null;
    }
  }

  const facts = new Map();
  for (const e of entries) {
    const superseded = e.struck || (/~~/.test(e.statement) && /\bsuperseded\b/i.test(e.statement));
    const live = superseded ? e.statement : e.statement.replace(/~~[\s\S]*?~~/g, ' ');
    const key = factKey(e.id);
    const known = facts.get(key);
    const numbers = ledgerNumbers(live.replace(/\bF\d+\b/g, ' '));
    if (known) for (const n of numbers) known.numbers.add(n);
    else facts.set(key, { id: e.id, superseded, numbers });
  }
  return facts;
}

// Replace every match with blanks, keeping its line breaks so line numbers hold.
const blank = (text, re) => text.replace(re, (m) => ` ${m.replace(/[^\n]/g, '')}`);

function blankTodos(text) {
  let out = '';
  let from = 0;
  const open = /\\todo(?:\[[^\]]*\])?\{/g;
  for (let m = open.exec(text); m; m = open.exec(text)) {
    let depth = 1;
    let k = open.lastIndex;
    for (; k < text.length && depth > 0; k += 1) {
      if (text[k] === '\\') k += 1;
      else if (text[k] === '{') depth += 1;
      else if (text[k] === '}') depth -= 1;
    }
    out += text.slice(from, m.index) + text.slice(m.index, k).replace(/[^\n]/g, '');
    from = k;
    open.lastIndex = k;
  }
  return out + text.slice(from);
}

// Drop the parts of a LaTeX file that hold numbers which are not claims.
function stripLatex(text) {
  let t = text.replace(/(?<!\\)%.*$/gm, '');
  t = blankTodos(t);
  for (const re of [
    /\\(?:cite[a-z]*|[a-z]*ref|label|input|include|bibliography|bibliographystyle|url|href)\*?(?:\[[^\]]*\])*\{[^}]*\}/g,
    /\\includegraphics(?:\[[^\]]*\])?\{[^}]*\}/g,
    /\\begin\{(?:tabular|tabularx|array)\*?\}(?:\{[^}]*\})+/g,
    /\\(?:begin|end)\{[^}]*\}(?:\[[^\]]*\])?/g,
    /\\(?:vspace|hspace|setlength|addtolength)\*?(?:\{[^}]*\})+/g,
    /\d*\.?\d+[ \t]*\\(?:textwidth|linewidth|columnwidth|textheight)/g,
    /\d*\.?\d+(?:pt|em|ex|cm|mm|in|bp)\b/g,
    /\\\\\[[^\]]*\]/g,
  ]) t = blank(t, re);
  return sci(t);
}

// Paragraphs of a .tex file: runs of non-blank lines, with the facts they name.
function paragraphs(raw) {
  const rawLines = raw.split('\n');
  const cleanLines = stripLatex(raw).split('\n');
  const blocks = [];
  let block = null;
  rawLines.forEach((line, i) => {
    if (line.trim() === '') { block = null; return; }
    if (!block) { block = { start: i, lines: [], ids: [] }; blocks.push(block); }
    block.lines.push(cleanLines[i] ?? '');
    const comment = line.match(/(?<!\\)%.*?\bfacts?\s*:(.*)$/i);
    if (comment) for (const m of comment[1].matchAll(/\bF\d+\b/g)) block.ids.push({ id: m[0], line: i + 1 });
  });
  // A facts comment standing alone after a blank line belongs to the paragraph above it.
  const merged = [];
  for (const b of blocks) {
    const prev = merged[merged.length - 1];
    if (prev && b.ids.length && b.lines.every((l) => l.trim() === '')) prev.ids.push(...b.ids);
    else merged.push(b);
  }
  return merged;
}

const factsPath = join(dir, 'facts.md');
const facts = existsSync(factsPath) ? parseFacts(readFileSync(factsPath, 'utf8')) : new Map();

const pool = new Set();
const briefPath = join(dir, 'brief.md');
if (existsSync(briefPath)) {
  const brief = readFileSync(briefPath, 'utf8')
    .replace(/^\s*#.*$/gm, '')
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
    .replace(/\bF\d+\b/g, ' ');
  for (const n of ledgerNumbers(brief)) pool.add(n);
}
const dataDir = join(dir, 'figures', 'data');
if (existsSync(dataDir)) {
  for (const f of readdirSync(dataDir).filter((n) => n.endsWith('.csv'))) {
    for (const n of ledgerNumbers(readFileSync(join(dataDir, f), 'utf8'))) pool.add(n);
  }
}

const files = [];
for (const sub of ['sections', 'tables']) {
  const d = join(dir, sub);
  if (!existsSync(d)) continue;
  for (const f of readdirSync(d).filter((n) => n.endsWith('.tex')).sort()) files.push(`${sub}/${f}`);
}

const holders = (value, superseded) =>
  [...facts.values()].filter((f) => f.superseded === superseded && f.numbers.has(value)).map((f) => f.id);

const errors = [];
let checked = 0;
for (const file of files) {
  const raw = readFileSync(join(dir, file), 'utf8');
  const rawLines = raw.split('\n');
  const generated = file.startsWith('tables/');

  for (const block of paragraphs(raw)) {
    const cited = [];
    for (const { id, line } of block.ids) {
      const fact = facts.get(factKey(id));
      if (!fact) errors.push({ type: 'unknown-fact', file, line, fact: id, text: rawLines[line - 1].trim() });
      else if (fact.superseded) errors.push({ type: 'superseded-fact', file, line, fact: id, text: rawLines[line - 1].trim() });
      else cited.push(fact);
    }

    const text = block.lines.join('\n');
    for (const n of claimedNumbers(text)) {
      checked += 1;
      if (cited.some((f) => f.numbers.has(n.value)) || pool.has(n.value)) continue;
      const live = holders(n.value, false);
      if (generated && live.length) continue;
      const dead = holders(n.value, true);
      const line = block.start + text.slice(0, n.index).split('\n').length;
      const base = { file, line, number: n.raw, text: rawLines[line - 1].trim() };
      if (live.length) {
        errors.push({ ...base, type: block.ids.length ? 'wrong-fact' : 'no-facts-comment', in: live, cites: block.ids.map((c) => c.id) });
      } else if (dead.length) {
        errors.push({ ...base, type: 'superseded', in: dead });
      } else {
        errors.push({ ...base, type: 'unbacked' });
      }
    }
  }
}

const some = (ids) => (ids.length > 3 ? `${ids.slice(0, 3).join(', ')}, …` : ids.join(', '));
const say = {
  unbacked: (e) => `${e.number} is not in facts.md, brief.md or figures/data/`,
  'wrong-fact': (e) => `${e.number} is in ${some(e.in)}, but the paragraph names ${some(e.cites)}`,
  'no-facts-comment': (e) => `${e.number} is in ${some(e.in)}, but the paragraph has no % facts: comment`,
  superseded: (e) => `${e.number} appears only in superseded ${some(e.in)}`,
  'unknown-fact': (e) => `% facts: names ${e.fact}, which is not in facts.md`,
  'superseded-fact': (e) => `% facts: names ${e.fact}, which is superseded`,
};

if (json) {
  console.log(JSON.stringify({ files: files.length, facts: facts.size, checked, errors }, null, 2));
} else if (files.length === 0) {
  console.log('No sections/*.tex or tables/*.tex files yet.');
} else if (errors.length === 0) {
  console.log(`OK: ${checked} numbers in ${files.length} files, all backed by the facts their paragraphs name.`);
} else {
  console.log(`${errors.length} problem(s) across ${checked} numbers in ${files.length} files:\n`);
  for (const e of errors) {
    console.log(`  ${e.file}:${e.line}  ${say[e.type](e)}`);
    console.log(`      ${e.text.slice(0, 110)}`);
  }
  console.log('\nRemove the number, replace it with \\todo{...}, name the fact that states it, or ask the author for the source.');
}

process.exit(errors.length ? 1 : 0);
