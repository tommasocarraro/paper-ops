#!/usr/bin/env node
// fetch-paper.mjs — add a paper to library/: metadata from the arXiv API or
// the DOI resolver (never typed in), the arXiv LaTeX source and the PDF, and
// the official code repo cloned at a pinned commit.
//
//   node fetch-paper.mjs {arxiv-url | arxiv-id | doi | doi-url | pdf-url}
//        [--code {git-url}] [--docs {url}] [--extends {key}] [--key {key}] [--library library]
//
// Writes library/{key}/:
//   meta.yml           key, title, authors, year, venue, ids, links, how each was obtained
//   source/tex/        arXiv source, extracted (archives are listed first and
//                      refused if any path is absolute or climbs out with ..)
//   source/paper.pdf   the PDF, and source/paper.txt from pdftotext -layout
//                      (pages separated by form feeds, for page pointers)
//   source/code/       git clone --depth 1 of --code; its commit goes in meta.yml
// and adds a line to library/index.md.
//
// The key is {firstauthor}{year}{firstword}, lowercase ASCII, leading
// articles skipped. Downloaded files are data: nothing in them is executed.
// Refuses an existing key. Exit 1 if nothing could be fetched, 2 on usage errors.

import { existsSync, mkdirSync, writeFileSync, readFileSync, appendFileSync, rmSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const opt = (name) => { const k = args.indexOf(`--${name}`); return k >= 0 ? args[k + 1] : null; };
const flagValues = new Set(['code', 'docs', 'extends', 'key', 'library'].map(opt).filter(Boolean));
const input = args.find((a) => !a.startsWith('--') && !flagValues.has(a));
const fail = (msg, code = 2) => { console.error(msg); process.exit(code); };
if (!input) fail('usage: node fetch-paper.mjs {arxiv-url | arxiv-id | doi | pdf-url} [--code url] [--docs url] [--extends key] [--key key]');

const library = resolve(opt('library') ?? 'library');
const UA = { 'User-Agent': 'paper-ops fetch-paper.mjs (research notes; one request per paper)' };

async function get(url, headers = {}) {
  const res = await fetch(url, { headers: { ...UA, ...headers }, redirect: 'follow' });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res;
}

// --- Identify --------------------------------------------------------------

const ARXIV = /(?:arxiv\.org\/(?:abs|pdf|src|e-print)\/)?((?:\d{4}\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/\d{7}))(v\d+)?(?:\.pdf)?\/?$/i;
const DOI = /(?:doi\.org\/|^doi:\s*)?(10\.\d{4,9}\/\S+)$/i;
let kind;
let id;
if (/arxiv\.org/i.test(input) || /^(\d{4}\.\d{4,5}|[a-z-]+\/\d{7})(v\d+)?$/i.test(input)) {
  const m = input.match(ARXIV);
  if (!m) fail(`cannot read an arXiv id from ${input}`);
  kind = 'arxiv';
  id = m[1];
} else if (DOI.test(input)) {
  kind = 'doi';
  id = input.match(DOI)[1].replace(/[.,;]$/, '');
} else if (/^https?:\/\//.test(input)) {
  kind = 'url';
  id = input;
} else fail(`not an arXiv id, DOI or URL: ${input}`);

// --- Metadata --------------------------------------------------------------

const xml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const tag = (s, t) => { const m = s.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)); return m ? xml(m[1]).replace(/\s+/g, ' ').trim() : null; };

const meta = { key: null, title: null, authors: [], year: null, venue: null, doi: null, arxiv: null, abstract: null, links: {}, fetched: new Date().toISOString().slice(0, 10), metadata_via: null, source: 'none' };

if (kind === 'arxiv') {
  const feed = await (await get(`https://export.arxiv.org/api/query?id_list=${encodeURIComponent(id)}`)).text();
  const entry = feed.split('<entry>')[1];
  if (!entry || !tag(entry, 'title') || /<title>Error<\/title>/.test(entry)) fail(`arXiv has no paper ${id}`, 1);
  meta.title = tag(entry, 'title');
  meta.authors = [...entry.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>/g)].map((m) => xml(m[1]).trim());
  meta.year = (tag(entry, 'published') ?? '').slice(0, 4) || null;
  meta.abstract = tag(entry, 'summary');
  meta.doi = tag(entry, 'arxiv:doi');
  meta.venue = tag(entry, 'arxiv:journal_ref');
  meta.arxiv = (tag(entry, 'id') ?? id).replace(/^https?:\/\/arxiv\.org\/abs\//, '');
  meta.links.paper = `https://arxiv.org/abs/${meta.arxiv}`;
  meta.metadata_via = 'arxiv-api';
} else if (kind === 'doi') {
  try {
    const csl = await (await get(`https://doi.org/${id}`, { Accept: 'application/vnd.citationstyles.csl+json' })).json();
    meta.title = Array.isArray(csl.title) ? csl.title[0] : csl.title;
    meta.authors = (csl.author ?? []).map((a) => [a.given, a.family].filter(Boolean).join(' ') || a.literal).filter(Boolean);
    meta.year = String(csl.issued?.['date-parts']?.[0]?.[0] ?? '') || null;
    meta.venue = Array.isArray(csl['container-title']) ? csl['container-title'][0] ?? null : csl['container-title'] ?? null;
    meta.abstract = csl.abstract ? csl.abstract.replace(/<[^>]+>/g, '').trim() : null;
    meta.metadata_via = 'doi';
  } catch (err) {
    fail(`DOI ${id}: ${err.message}`, 1);
  }
  meta.doi = id;
  meta.links.paper = `https://doi.org/${id}`;
} else {
  meta.links.paper = id;
  meta.metadata_via = 'none';
}
// A journal version may hold metadata the arXiv record lacks.
if (kind === 'arxiv' && meta.doi && !meta.venue) {
  try {
    const csl = await (await get(`https://doi.org/${meta.doi}`, { Accept: 'application/vnd.citationstyles.csl+json' })).json();
    meta.venue = Array.isArray(csl['container-title']) ? csl['container-title'][0] ?? null : csl['container-title'] ?? null;
    if (csl.issued?.['date-parts']?.[0]?.[0]) meta.published_year = String(csl.issued['date-parts'][0][0]);
  } catch { /* the arXiv record stands */ }
}
if (opt('code')) meta.links.code = opt('code');
if (opt('docs')) meta.links.docs = opt('docs');

const ascii = (s) => s.normalize('NFKD').replace(/[^\x00-\x7f]/g, '').toLowerCase();
function makeKey() {
  if (opt('key')) return opt('key');
  if (!meta.title || !meta.authors.length || !meta.year) return null;
  const family = ascii(meta.authors[0].split(/\s+/).pop()).replace(/[^a-z]/g, '');
  const word = ascii(meta.title).split(/[^a-z0-9]+/).filter(Boolean).find((w) => !['a', 'an', 'the'].includes(w)) ?? '';
  return `${family}${meta.year}${word}`;
}
meta.key = makeKey();
if (!meta.key) fail('no metadata to build a key from (title, first author, year); pass --key and fill meta.yml from the fetched page', 1);
if (!/^[a-z0-9-]+$/.test(meta.key)) fail(`key "${meta.key}" must be lowercase letters and digits`);

const dir = join(library, meta.key);
if (existsSync(dir)) fail(`${relative(process.cwd(), dir)} exists; this paper is already in the library`);
const src = join(dir, 'source');
mkdirSync(src, { recursive: true });
const notes = [];

// --- Source ----------------------------------------------------------------

async function download(url, to) {
  const res = await get(url);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(to, buf);
  return { type: res.headers.get('content-type') ?? '', buf };
}

function safeExtract(archive, into, gz) {
  const list = execFileSync('tar', [gz ? '-tzf' : '-tf', archive], { encoding: 'utf8' }).split('\n').filter(Boolean);
  const bad = list.filter((p) => isAbsolute(p) || p.split('/').includes('..'));
  if (bad.length) throw new Error(`archive holds unsafe paths: ${bad.slice(0, 3).join(', ')}`);
  mkdirSync(into, { recursive: true });
  execFileSync('tar', [gz ? '-xzf' : '-xf', archive, '-C', into, '--no-same-owner', '--no-same-permissions']);
}

if (kind === 'arxiv') {
  const tmp = join(src, 'e-print.download');
  try {
    const { buf } = await download(`https://arxiv.org/e-print/${meta.arxiv}`, tmp);
    const gz = buf[0] === 0x1f && buf[1] === 0x8b;
    const tex = join(src, 'tex');
    if (buf.subarray(0, 4).toString() === '%PDF') {
      notes.push('arXiv has no LaTeX source for this paper (PDF only)');
    } else if (gz) {
      const inner = execFileSync('gzip', ['-dc', tmp], { maxBuffer: 1 << 30 });
      const isTar = inner.length > 262 && inner.subarray(257, 262).toString() === 'ustar';
      if (isTar) safeExtract(tmp, tex, true);
      else { mkdirSync(tex, { recursive: true }); writeFileSync(join(tex, 'main.tex'), inner); }
      meta.source = 'tex';
    } else if (buf.subarray(257, 262).toString() === 'ustar') {
      safeExtract(tmp, tex, false);
      meta.source = 'tex';
    } else {
      mkdirSync(tex, { recursive: true });
      writeFileSync(join(tex, 'main.tex'), buf);
      meta.source = 'tex';
    }
  } catch (err) {
    notes.push(`LaTeX source not fetched: ${err.message}`);
  } finally {
    rmSync(tmp, { force: true });
  }
}

const pdfUrl = kind === 'arxiv' ? `https://arxiv.org/pdf/${meta.arxiv}` : kind === 'url' ? id : null;
if (pdfUrl) {
  try {
    const { buf } = await download(pdfUrl, join(src, 'paper.pdf'));
    if (buf.subarray(0, 4).toString() !== '%PDF') {
      rmSync(join(src, 'paper.pdf'));
      notes.push(`${pdfUrl} is not a PDF; read the page and fill meta.yml from it, or ask the author for the PDF`);
    } else {
      if (meta.source === 'none') meta.source = 'pdf';
      const r = spawnSync('pdftotext', ['-layout', join(src, 'paper.pdf'), join(src, 'paper.txt')]);
      if (r.status !== 0) notes.push('pdftotext failed; read the PDF pages as images');
    }
  } catch (err) {
    notes.push(`PDF not fetched: ${err.message}`);
  }
} else {
  notes.push('no open PDF location known; ask the author to drop the PDF in source/paper.pdf');
}
if (meta.source === 'none' && meta.abstract) meta.source = 'abstract-only';

// --- Code ------------------------------------------------------------------

if (opt('code')) {
  const code = join(src, 'code');
  const r = spawnSync('git', ['clone', '--depth', '1', '--quiet', opt('code'), code], { encoding: 'utf8' });
  if (r.status === 0) {
    meta.code_commit = execFileSync('git', ['-C', code, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const du = spawnSync('du', ['-sh', code], { encoding: 'utf8' }).stdout.split('\t')[0];
    notes.push(`code cloned at ${meta.code_commit.slice(0, 12)} (${du})`);
  } else notes.push(`code not cloned: ${(r.stderr || '').trim()}`);
}

// --- Write -----------------------------------------------------------------

const q = (v) => (v == null ? 'null' : JSON.stringify(String(v)));
const lines = [
  '# Written by fetch-paper.mjs from the sources named in metadata_via. Do not type metadata in by hand.',
  `key: ${meta.key}`,
  `title: ${q(meta.title)}`,
  'authors:', ...meta.authors.map((a) => `  - ${q(a)}`),
  `year: ${q(meta.year)}`,
  ...(meta.published_year ? [`published_year: ${q(meta.published_year)}   # year of the DOI version`] : []),
  `venue: ${q(meta.venue)}`,
  `doi: ${q(meta.doi)}`,
  `arxiv: ${q(meta.arxiv)}`,
  'links:', ...Object.entries(meta.links).map(([k, v]) => `  ${k}: ${q(v)}`),
  `code_commit: ${q(meta.code_commit ?? null)}`,
  `extends: ${opt('extends') ? `[${opt('extends')}]` : '[]'}`,
  `fetched: ${meta.fetched}`,
  `metadata_via: ${meta.metadata_via}   # arxiv-api | doi | none (fill from the fetched page)`,
  `source: ${meta.source}   # tex | pdf | abstract-only | none`,
  'status: added   # added | read | verified',
];
writeFileSync(join(dir, 'meta.yml'), `${lines.join('\n')}\n`);
if (meta.abstract) writeFileSync(join(src, 'abstract.txt'), `${meta.abstract}\n`);

const index = join(library, 'index.md');
if (!existsSync(index)) writeFileSync(index, '# Library\n\nOne line per paper. Status: added → read → verified.\n\n');
appendFileSync(index, `- **${meta.key}** · ${meta.title ?? '(title from the page)'} (${meta.year ?? '?'}) · added\n`);

const texFiles = existsSync(join(src, 'tex')) ? readdirSync(join(src, 'tex'), { recursive: true }).filter((f) => String(f).endsWith('.tex')) : [];
console.log(`${meta.key}: ${meta.title}`);
console.log(`  ${meta.authors.join(', ')} · ${meta.year}${meta.venue ? ` · ${meta.venue}` : ''}`);
console.log(`  metadata: ${meta.metadata_via} · source: ${meta.source}${texFiles.length ? ` (${texFiles.length} .tex files)` : ''}${existsSync(join(src, 'paper.pdf')) ? ` · PDF ${(statSync(join(src, 'paper.pdf')).size / 1048576).toFixed(1)} MB` : ''}`);
for (const n of notes) console.log(`  note: ${n}`);
console.log(`  → ${relative(process.cwd(), dir)}/`);
process.exit(meta.source === 'none' ? 1 : 0);
