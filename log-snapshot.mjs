#!/usr/bin/env node
// log-snapshot.mjs — capture what a logbook entry's run used and produced, so
// later runs overwriting the code repo cannot break the entry's provenance.
//
//   node log-snapshot.mjs projects/{name} L014 --start   before the run
//   node log-snapshot.mjs projects/{name} L014           after the run
//
// Paths resolve against the entry's code repo: `run.repo` matched against
// project.yml `code_repos` by name or folder name; with one repo it is used.
//
// --start prints {commit, dirty} as JSON for the entry's `run:` block, saves
// `git diff HEAD` to artifacts/{id}/uncommitted.diff when the tree is dirty,
// and copies `run.config` file(s) to artifacts/{id}/config/.
//
// Without --start, every file under the entry's `results:` paths (files or
// folders) is hashed. Files up to snapshot.max_file_mb (default 5) are copied
// to artifacts/{id}/results/{same path}, smallest first, until the entry holds
// snapshot.max_entry_mb (default 50); the rest are recorded by size and
// sha256 only. All of it goes to artifacts/{id}/manifest.json.
//
// Refuses a sealed entry. Exit 1 if a results path is missing, 2 on usage errors.

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, statSync, rmSync } from 'node:fs';
import { join, dirname, relative, resolve, isAbsolute } from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadProject, codeRepo, asList, resultPaths, walk, sha256File } from './log-lib.mjs';

const args = process.argv.slice(2);
const start = args.includes('--start');
const [dir, id] = args.filter((a) => !a.startsWith('--'));
const fail = (msg, code = 2) => { console.error(msg); process.exit(code); };

if (!dir || !id || !existsSync(join(dir, 'project.yml'))) fail('usage: node log-snapshot.mjs projects/{name} L014 [--start]');

const { project, entries } = loadProject(dir);
const entry = entries.find((e) => e.id === id);
if (!entry) fail(`${id}: no entry with this ID in ${dir}/log/`);
const sealsPath = join(dir, 'log', '.sealed.json');
if (existsSync(sealsPath) && JSON.parse(readFileSync(sealsPath, 'utf8'))[id]) {
  fail(`${id} is sealed; its snapshot cannot change. Write a new entry instead.`);
}

const run = entry.front.run ?? {};
const repo = codeRepo(project, run.repo);
if (!repo) fail(`${id}: cannot resolve the code repo${run.repo ? ` "${run.repo}"` : ''}; set run.repo to a code_repos name in project.yml`);
const repoPath = String(repo.path);
const inRepo = (p) => {
  const abs = isAbsolute(p) ? p : resolve(repoPath, p);
  const rel = relative(repoPath, abs);
  if (rel.startsWith('..')) fail(`${p} is outside the code repo ${repoPath}`);
  return { abs, rel };
};
const art = join(dir, 'log', 'artifacts', id);

if (start) {
  const git = (...a) => execFileSync('git', ['-C', repoPath, ...a], { encoding: 'utf8' });
  let commit;
  try {
    commit = git('rev-parse', 'HEAD').trim();
  } catch {
    fail(`${repoPath} is not a git repository with a commit`);
  }
  const dirty = git('status', '--porcelain', '--untracked-files=no').trim() !== '';
  const saved = [];
  mkdirSync(art, { recursive: true });
  rmSync(join(art, 'uncommitted.diff'), { force: true });
  if (dirty) {
    writeFileSync(join(art, 'uncommitted.diff'), git('diff', 'HEAD'));
    saved.push(relative(dir, join(art, 'uncommitted.diff')));
  }
  for (const c of asList(run.config)) {
    const { abs, rel } = inRepo(c);
    if (!rel) fail('run.config must name files, not the whole repo');
    if (!existsSync(abs)) fail(`config ${c} does not exist in ${repoPath}`, 1);
    for (const f of walk(abs)) {
      const to = join(art, 'config', relative(repoPath, f));
      mkdirSync(dirname(to), { recursive: true });
      copyFileSync(f, to);
      saved.push(relative(dir, to));
    }
  }
  console.log(JSON.stringify({ commit: commit.slice(0, 12), dirty, saved }, null, 2));
  process.exit(0);
}

const paths = resultPaths(entry.front);
if (!paths.length) fail(`${id} lists no results:`, 1);
const missing = [];
const files = [];
for (const p of paths) {
  const { abs } = inRepo(p);
  if (!existsSync(abs)) { missing.push(p); continue; }
  for (const f of walk(abs)) files.push({ abs: f, path: relative(repoPath, f), size: statSync(f).size });
}
if (missing.length) fail(`Missing in ${repoPath}: ${missing.join(', ')}`, 1);

const mb = (key, fallback) => Number(project.snapshot?.[key] ?? fallback) * 1024 * 1024;
const maxFile = mb('max_file_mb', 5);
const maxEntry = mb('max_entry_mb', 50);

rmSync(join(art, 'results'), { recursive: true, force: true });
let used = 0;
const record = [];
for (const f of [...files].sort((a, b) => a.size - b.size || a.path.localeCompare(b.path))) {
  const sha256 = await sha256File(f.abs);
  let copied = false;
  let reason = null;
  if (f.size > maxFile) reason = 'over max_file_mb';
  else if (used + f.size > maxEntry) reason = 'over max_entry_mb';
  else {
    const to = join(art, 'results', f.path);
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(f.abs, to);
    used += f.size;
    copied = true;
  }
  record.push({ path: f.path, size: f.size, sha256, copied, ...(reason ? { reason } : {}) });
}
record.sort((a, b) => a.path.localeCompare(b.path));
mkdirSync(art, { recursive: true });
writeFileSync(join(art, 'manifest.json'), `${JSON.stringify({
  created: new Date().toISOString(), repo: repo.name ?? repoPath, results: paths, files: record,
}, null, 2)}\n`);

const kept = record.filter((r) => r.copied);
const skipped = record.filter((r) => !r.copied);
console.log(`${id}: ${kept.length} file(s) copied (${(used / 1024 / 1024).toFixed(1)} MB), ${skipped.length} recorded by hash only.`);
for (const s of skipped) console.log(`  not copied (${s.reason}): ${s.path} ${(s.size / 1024 / 1024).toFixed(1)} MB`);
