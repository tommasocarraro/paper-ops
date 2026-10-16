#!/usr/bin/env node
// build-log.mjs — render a project's logbook entries as one LaTeX document.
//
//   node build-log.mjs projects/{name} [--pdf]
//
// Writes projects/{name}/build/logbook.tex: the research questions as they
// stand (with their evidence and history), an index by type and by tag, then
// every entry in date order with its metadata, its body, plots found in its
// snapshot and the files recorded by hash only. Also writes build/changelog.md,
// one line per entry from the start of the project. Entries that were superseded,
// corrected or affected by a bug carry a notice naming the entry that did it.
// --pdf also runs latexmk -pdf in build/. Characters pdflatex cannot set
// (outside Latin-1, Latin Extended-A and the symbols mapped below) print as ?.
//
// Bodies are a restricted markdown: ## and ### headings, paragraphs, - * 1.
// lists, **bold**, *italic*, `code`, [links](url), fenced code, | tables |,
// and ![caption](path) images on a line of their own. Image paths resolve
// against log/, then against the entry's artifacts/{id}/results/.
// Exit 1 if an entry cannot be read or latexmk fails, 2 on usage errors.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  TYPES, RQ_CONTRACT, loadProject, loadQuestions, invalidations, questionHistory, evidenceFor, actionItems, section, asList, resultPaths, walk,
} from './log-lib.mjs';

const args = process.argv.slice(2);
const pdf = args.includes('--pdf');
const dir = args.find((a) => !a.startsWith('--'));
if (!dir || !existsSync(join(dir, 'project.yml'))) {
  console.error('usage: node build-log.mjs projects/{name} [--pdf]');
  process.exit(2);
}

const logDir = join(dir, 'log');
const { project, entries: all, problems } = loadProject(dir);
const entries = all.filter((e) => e.id).sort((a, b) => String(a.front.date).localeCompare(String(b.front.date)) || a.id.localeCompare(b.id, 'en', { numeric: true }));
const ids = new Set(entries.map((e) => e.id));
const invalid = invalidations(entries);
const { questions, problems: qProblems } = loadQuestions(dir);
problems.push(...qProblems);
const rqs = new Set(questions.map((q) => q.id));
const history = questionHistory(entries);
const evidence = evidenceFor(entries, invalid);
const actionsById = new Map(actionItems(entries).map((a) => [a.id, a]));
const evidenceOf = (e) => (Array.isArray(e.front.evidence) ? e.front.evidence : []).filter((x) => x && x.rq);

// --- Text ------------------------------------------------------------------

const UNICODE = {
  '→': '$\\rightarrow$', '←': '$\\leftarrow$', '↔': '$\\leftrightarrow$', '⇒': '$\\Rightarrow$',
  '×': '$\\times$', '≤': '$\\leq$', '≥': '$\\geq$', '±': '$\\pm$', '≈': '$\\approx$', '≠': '$\\neq$',
  '·': '$\\cdot$', '…': '\\ldots{}', '–': '--', '—': '---', 'μ': '$\\mu$',
  'α': '$\\alpha$', 'β': '$\\beta$', 'γ': '$\\gamma$', 'δ': '$\\delta$', 'ε': '$\\epsilon$',
  'λ': '$\\lambda$', 'σ': '$\\sigma$', 'θ': '$\\theta$', 'τ': '$\\tau$', 'Δ': '$\\Delta$',
  '✓': '$\\checkmark$', '✗': '$\\times$', '∞': '$\\infty$',
};
const esc = (s) => String(s ?? '')
  .replace(/[\\{}&%$#_~^<>]/g, (c) => ({
    '\\': '\\textbackslash{}', '{': '\\{', '}': '\\}', '&': '\\&', '%': '\\%', $: '\\$', '#': '\\#',
    _: '\\_', '~': '\\textasciitilde{}', '^': '\\textasciicircum{}', '<': '\\textless{}', '>': '\\textgreater{}',
  }[c]))
  .replace(/[^\u0000-\u017f‘’“”]/gu, (c) => UNICODE[c] ?? '?');
// Paths and code: escaped, breakable after / . _ -
const code = (s) => `\\texttt{${esc(s).replace(/(\/|\\_|\.|-)/g, '$1\\allowbreak{}')}}`;
const idLink = (id) => (ids.has(id) || rqs.has(id) ? `\\hyperlink{${id}}{${id}}` : id);
const idList = (v) => asList(v).map(idLink).join(', ');

function inline(s) {
  const re = /`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|\*\*(.+?)\*\*|(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])|\b(L\d{3,}|RQ\d+)\b/g;
  let out = '';
  let i = 0;
  for (const m of s.matchAll(re)) {
    out += esc(s.slice(i, m.index));
    if (m[1] != null) out += code(m[1]);
    else if (m[2] != null) out += `\\href{${m[3].replace(/[%#\\]/g, '\\$&')}}{${inline(m[2])}}`;
    else if (m[4] != null) out += `\\textbf{${inline(m[4])}}`;
    else if (m[5] != null) out += `\\emph{${inline(m[5])}}`;
    else out += idLink(m[6]);
    i = m.index + m[0].length;
  }
  return out + esc(s.slice(i));
}

function imagePath(entry, p) {
  for (const candidate of [join(logDir, p), join(logDir, 'artifacts', entry.id, 'results', p)]) {
    if (existsSync(candidate)) return relative(logDir, candidate);
  }
  return null;
}

const figure = (path, caption, width = '0.8\\linewidth') =>
  `\\begin{center}\n\\includegraphics[width=${width},height=0.4\\textheight,keepaspectratio]{${path}}${caption ? `\\\\\n{\\small ${caption}}` : ''}\n\\end{center}`;

function table(rows) {
  const cells = (l) => l.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim());
  const sep = rows.length > 1 && /^\s*\|[\s:|-]+\|\s*$/.test(rows[1]);
  const head = sep ? cells(rows[0]) : null;
  const body = rows.slice(sep ? 2 : 0).filter((r) => !/^\s*\|[\s:|-]+\|\s*$/.test(r)).map(cells);
  const width = Math.max(head?.length ?? 0, ...body.map((r) => r.length));
  const align = sep
    ? cells(rows[1]).map((c) => (/^:-+:$/.test(c) ? 'c' : /-+:$/.test(c) ? 'r' : 'l'))
    : Array(width).fill('l');
  while (align.length < width) align.push('l');
  const line = (r) => `${Array.from({ length: width }, (_, k) => inline(r[k] ?? '')).join(' & ')} \\\\`;
  return [
    '\\begin{center}\\begin{adjustbox}{max width=\\linewidth}',
    `\\begin{tabular}{${align.join('')}}`, '\\toprule',
    ...(head ? [line(head), '\\midrule'] : []),
    ...body.map(line), '\\bottomrule', '\\end{tabular}', '\\end{adjustbox}\\end{center}',
  ].join('\n');
}

function markdown(entry, text, used) {
  const lines = text.split('\n');
  const out = [];
  const lists = [];
  const closeLists = (indent = -1) => {
    while (lists.length && lists.at(-1).indent > indent) out.push(`\\end{${lists.pop().env}}`);
  };
  let para = [];
  const flush = () => { if (para.length) { out.push(inline(para.join(' ')), ''); para = []; } };

  for (let k = 0; k < lines.length; k += 1) {
    const l = lines[k];
    if (/^\s*```/.test(l)) {
      flush(); closeLists();
      const block = [];
      for (k += 1; k < lines.length && !/^\s*```/.test(lines[k]); k += 1) block.push(lines[k]);
      out.push('\\begin{lstlisting}', ...block, '\\end{lstlisting}');
      continue;
    }
    if (l.trim() === '') { flush(); continue; }
    const h = l.match(/^(#{1,3})\s+(.+)$/);
    if (h) {
      flush(); closeLists();
      out.push(`\\${h[1].length === 3 ? 'subsubsection' : 'subsection'}*{${inline(h[2])}}`);
      continue;
    }
    if (/^\s*\|/.test(l)) {
      flush(); closeLists();
      const rows = [];
      for (; k < lines.length && /^\s*\|/.test(lines[k]); k += 1) rows.push(lines[k]);
      k -= 1;
      out.push(table(rows));
      continue;
    }
    const img = l.match(/^\s*!\[([^\]]*)\]\(([^)\s]+)\)\s*$/);
    if (img) {
      flush(); closeLists();
      const path = imagePath(entry, img[2]);
      if (path) { used.add(path); out.push(figure(path, inline(img[1]))); } else out.push(`\\textit{[image not found: ${code(img[2])}]}`, '');
      continue;
    }
    const item = l.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
    if (item) {
      flush();
      const indent = item[1].length;
      const env = /\d/.test(item[2]) ? 'enumerate' : 'itemize';
      closeLists(indent);
      if (!lists.length || lists.at(-1).indent < indent) {
        out.push(`\\begin{${env}}`);
        lists.push({ indent, env });
      }
      out.push(`\\item ${inline(item[3])}`);
      continue;
    }
    if (lists.length && /^\s+\S/.test(l)) { out.push(inline(l.trim())); continue; }
    closeLists();
    para.push(l.trim());
  }
  flush();
  closeLists();
  return out.join('\n');
}

// --- Entries ---------------------------------------------------------------

const KIND = { superseded: 'Superseded by', corrected: 'Corrected by', affected: 'Affected by bug' };

function meta(entry) {
  const f = entry.front;
  const run = f.run ?? {};
  const rows = [
    ['Date', esc(f.date)], ['Type', esc(f.type)], ['Status', esc(f.status)], ['Provenance', esc(f.provenance)],
    ['Tags', esc(asList(f.tags).join(', '))], ['Paper', f.paper ? code(f.paper) : ''],
    ['Related', idList(f.related)], ['Supersedes', idList(f.supersedes)], ['Corrects', idList(f.corrects)],
    ['Affects', idList(f.affects)],
    ['Question', f.type === 'question' ? `${idLink(String(f.rq))}: ${esc(f.event)}${f.replaced_by ? ` by ${idLink(String(f.replaced_by))}` : ''}` : ''],
    ['Attendees', esc(asList(f.attendees).join(', '))],
    ['Speakers', f.provenance === 'transcribed' ? (f.speakers_confirmed === true ? 'confirmed by the author' : '\\textcolor{red!70!black}{not confirmed}') : ''],
    ['Actions', (Array.isArray(f.actions) ? f.actions : []).filter((a) => a && a.id).map((a) => {
      const st = actionsById.get(String(a.id));
      const who = st?.who ?? a.who;
      const due = st?.due ?? a.due;
      const upd = st?.updatedBy?.length ? `, updated in ${st.updatedBy.map(idLink).join(', ')}` : '';
      return `${esc(a.id)}: ${inline(String(st?.what ?? a.what ?? ''))}${who ? ` (${esc(who)}${due ? `, ${esc(due)}` : ''}${upd})` : ''} \\textperiodcentered{} ${st?.resolvedBy ? `resolved in ${idLink(st.resolvedBy)}` : '\\textbf{open}'}`;
    }).join('\\newline ')],
    ['Resolves', asList(f.resolves).map(esc).join(', ')],
    ['Evidence', evidenceOf(entry).map((x) => `${idLink(String(x.rq))}: ${esc(x.stance ?? 'stance pending')}`).join(', ')],
    ['Code', run.commit ? `${esc(run.repo ?? '')} @ ${code(run.commit)}${run.dirty === true ? ' (uncommitted changes, diff in artifacts)' : ''}` : ''],
    ['Command', run.command ? code(run.command) : ''],
    ['Config', asList(run.config).map(code).join(', ')],
    ['Ran', run.started ? `${esc(run.started)}${run.finished ? ` -- ${esc(run.finished)}` : ''}` : ''],
    ['Results', resultPaths(f).map(code).join('\\newline ')],
  ].filter(([, v]) => v);
  return [
    '{\\small\\begin{tabular}{@{}>{\\bfseries}p{2.2cm}p{0.78\\linewidth}@{}}',
    ...rows.map(([k, v]) => `${k} & ${v} \\\\`),
    '\\end{tabular}}', '',
  ].join('\n');
}

function snapshotParts(entry, used) {
  const out = [];
  const results = join(logDir, 'artifacts', entry.id, 'results');
  const plots = walk(results).map((p) => relative(logDir, p)).filter((p) => /\.(png|jpe?g|pdf)$/i.test(extname(p)) && !used.has(p));
  if (plots.length) {
    out.push('\\subsection*{Plots in the snapshot}');
    for (const p of plots.slice(0, 12)) out.push(figure(p, code(relative(join('artifacts', entry.id, 'results'), p)), '0.6\\linewidth'));
    if (plots.length > 12) out.push(`\\textit{${plots.length - 12} more image(s) in ${code(`artifacts/${entry.id}/results/`)}.}`, '');
  }
  const manifestPath = join(logDir, 'artifacts', entry.id, 'manifest.json');
  if (existsSync(manifestPath)) {
    const skipped = (JSON.parse(readFileSync(manifestPath, 'utf8')).files ?? []).filter((x) => !x.copied);
    if (skipped.length) {
      out.push('\\subsection*{Recorded by hash only}', '\\begin{itemize}');
      for (const s of skipped) out.push(`\\item ${code(s.path)} (${(s.size / 1024 / 1024).toFixed(1)} MB, sha256 ${code(s.sha256.slice(0, 16))}\\ldots)`);
      out.push('\\end{itemize}');
    }
  }
  return out.join('\n');
}

function renderEntry(entry) {
  const used = new Set();
  const notices = (invalid.get(entry.id) ?? []).map((x) => `\\noindent\\fcolorbox{red!70!black}{red!5}{\\parbox{\\dimexpr\\linewidth-2\\fboxsep-2\\fboxrule}{\\textbf{${KIND[x.kind]} ${idLink(x.by)}.} Do not use this entry's conclusions as they stand.}}\\par\\medskip`);
  const body = markdown(entry, entry.body, used);
  return [
    `\\section[${entry.id} ${esc(entry.front.title)}]{\\hypertarget{${entry.id}}{}${entry.id} \\textperiodcentered{} ${esc(entry.front.title)}}`,
    ...notices, meta(entry), body, snapshotParts(entry, used), '\\clearpage',
  ].join('\n');
}

function questionsPart() {
  if (!questions.length) return '';
  const out = ['\\section*{Research questions}', '\\addcontentsline{toc}{section}{Research questions}'];
  for (const q of questions) {
    out.push(`\\subsection*{\\hypertarget{${q.id}}{}${q.id} \\textperiodcentered{} ${inline(q.title ?? '')}}`);
    out.push(`\\textbf{Status:} ${esc(q.front.status)}${q.front.reformulated_as ? ` as ${idLink(String(q.front.reformulated_as))}` : ''}\n`);
    for (const name of [...RQ_CONTRACT, 'Answer']) {
      const s = section(q.sections, name);
      if (s && s.text.trim()) out.push(`\\paragraph{${esc(name)}}`, markdown({ id: q.id }, s.text, new Set()));
    }
    const ev = evidence.get(q.id) ?? [];
    if (ev.length) {
      out.push('\\paragraph{Evidence}', '\\begin{itemize}[nosep]');
      for (const x of ev) {
        const flags = x.invalid.map((v) => `${v.kind} by ${v.by}`).join('; ');
        out.push(`\\item ${idLink(x.id)} ${esc(x.date)} \\textperiodcentered{} ${esc(x.title)} \\textperiodcentered{} \\textbf{${esc(x.stance ?? 'stance pending')}}${flags ? ` \\textcolor{red!70!black}{(${esc(flags)}; does not count)}` : ''}`);
      }
      out.push('\\end{itemize}');
    }
    const h = history.get(q.id) ?? [];
    if (h.length) out.push('\\paragraph{History}', h.map((e) => `${idLink(e.id)} ${esc(e.front.date)} ${esc(e.front.event)}`).join(' \\textperiodcentered{} '), '');
  }
  return out.join('\n');
}

function indexes() {
  const out = ['\\section*{Index by type}', '\\addcontentsline{toc}{section}{Index by type}'];
  for (const type of Object.keys(TYPES)) {
    const of = entries.filter((e) => e.front.type === type);
    if (!of.length) continue;
    out.push(`\\subsection*{${esc(type)} (${of.length})}`, '\\begin{itemize}[nosep]');
    for (const e of of) {
      const flags = (invalid.get(e.id) ?? []).map((x) => `${x.kind} by ${x.by}`).join('; ');
      out.push(`\\item ${idLink(e.id)} \\textperiodcentered{} ${esc(e.front.title)} \\hfill {\\small ${esc(e.front.date)}, ${esc(e.front.status)}${flags ? `, \\textcolor{red!70!black}{${esc(flags)}}` : ''}}`);
    }
    out.push('\\end{itemize}');
  }
  const tags = new Map();
  for (const e of entries) for (const t of asList(e.front.tags)) tags.set(t, [...(tags.get(t) ?? []), e.id]);
  if (tags.size) {
    out.push('\\section*{Index by tag}', '\\addcontentsline{toc}{section}{Index by tag}', '\\begin{description}[nosep]');
    for (const [t, list] of [...tags].sort(([a], [b]) => a.localeCompare(b))) out.push(`\\item[${esc(t)}] ${list.map(idLink).join(', ')}`);
    out.push('\\end{description}');
  }
  return out.join('\n');
}

const today = new Date().toISOString().slice(0, 10);
const tex = [
  '% Generated by build-log.mjs from log/*.md. Do not edit; rebuild instead.',
  '\\documentclass[10pt]{article}',
  '\\usepackage[margin=2cm]{geometry}',
  '\\usepackage[T1]{fontenc}',
  '\\usepackage[utf8]{inputenc}',
  '\\usepackage{lmodern,textcomp}',
  '\\usepackage{amssymb,graphicx,booktabs,adjustbox,array,xcolor,listings,enumitem}',
  '\\usepackage[hidelinks]{hyperref}',
  '\\graphicspath{{../log/}}',
  '\\lstset{basicstyle=\\ttfamily\\small,breaklines=true,columns=fullflexible,frame=single}',
  '\\setlength{\\parindent}{0pt}\\setlength{\\parskip}{4pt}',
  `\\title{Logbook: ${esc(project.name ?? '')}}`,
  `\\author{${esc(project.description ?? '')}}`,
  `\\date{${project.started ? `Started ${esc(project.started)} \\textperiodcentered{} ` : ''}built ${today} \\textperiodcentered{} ${entries.length} entries}`,
  '\\begin{document}',
  '\\maketitle',
  '\\tableofcontents',
  '\\clearpage',
  questionsPart(),
  entries.length ? indexes() : 'No entries yet.',
  '\\clearpage',
  ...entries.map(renderEntry),
  '\\end{document}',
  '',
].join('\n');

const buildDir = join(dir, 'build');
mkdirSync(buildDir, { recursive: true });
writeFileSync(join(buildDir, 'logbook.tex'), tex);
const changelog = [
  `# Changelog: ${project.name ?? ''}`, '',
  `Generated by build-log.mjs from log/ on ${today}. One line per entry, oldest first.`, '',
  ...entries.map((e) => {
    const f = e.front;
    const what = f.type === 'question' ? `question ${f.rq} ${f.event}` : f.type;
    const ev = evidenceOf(e).map((x) => `${x.rq}: ${x.stance ?? 'pending'}`).join(', ');
    const flags = (invalid.get(e.id) ?? []).map((x) => `${x.kind} by ${x.by}`).join('; ');
    return `- ${f.date} **${e.id}** ${what} · ${f.title} · ${f.status}${ev ? ` · ${ev}` : ''}${flags ? ` · _${flags}_` : ''}`;
  }),
  '',
].join('\n');
writeFileSync(join(buildDir, 'changelog.md'), changelog);
console.log(`Wrote ${join(buildDir, 'logbook.tex')} and changelog.md (${entries.length} entries, ${questions.length} questions).`);
for (const p of problems) console.log(`  skipped ${p.file}: ${p.detail}`);

if (pdf) {
  const r = spawnSync('latexmk', ['-pdf', '-interaction=nonstopmode', '-halt-on-error', 'logbook.tex'], { cwd: buildDir, encoding: 'utf8' });
  if (r.status !== 0) {
    console.log((r.stdout ?? '').split('\n').filter((l) => /^!|^l\.\d+/.test(l)).slice(0, 20).join('\n') || r.stderr);
    console.log(`latexmk failed; see ${join(buildDir, 'logbook.log')}`);
    process.exit(1);
  }
  console.log(`Wrote ${join(buildDir, 'logbook.pdf')}.`);
}
process.exit(problems.length ? 1 : 0);
