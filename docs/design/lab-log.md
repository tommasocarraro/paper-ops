# Design: `/lab-log` — project logbook

Status: implemented in `.claude/skills/lab-log/`, `modes/lab-log/`, `check-log.mjs`, `log-snapshot.mjs`, `build-log.mjs`. The open questions were settled with the defaults: separate code repo, 5 MB / 50 MB, LaTeX PDF, one project per paper.

## Purpose

A complete, chronological record of a research project from start to end: experiments, decisions, design, datasets, bugs, dead ends and findings from papers. It serves three readers:

1. **The author**, now: what has been done, what is running, what was decided and why (`digest`, `build`).
2. **The author**, months later: why a choice was made, which commit produced a number.
3. **`paper-ops intake`**: the log becomes a source, so facts in a paper trace to log entries instead of page numbers in a design document.

## Principles

- **Markdown entries are the source of truth.** The PDF is a build output and is never edited.
- **The log records; it does not invent.** Every number in an entry points to the result file it came from, or is marked as stated by the author. Claude's interpretation of a result is labelled as such and is separate from the author's.
- **Append-only once settled.** An entry may move through `planned → running → done | failed | abandoned`. After that it is never edited. A correction is a new entry with `corrects:`, and a replaced conclusion is a new entry with `supersedes:`.
- **Negative results and dead ends are first-class.** They get their own types, not a footnote in a success entry.
- **Confidential by default.** `projects/` is gitignored, and nothing from the log goes into a web search or any external service.

## Layout

```
projects/{project}/
  project.yml            # name, one-line description, code repo path(s), started
  log/
    2026-10-15-L014-lr-sweep.md
    artifacts/L014/      # snapshots of small result files (see "Results")
  inbox/                 # author-written summaries (txt, md, pdf) waiting for `ingest`
    done/                # processed inbox files, kept; entries point here
  digests/2026-10-15.md  # output of `digest`
  build/logbook.tex, logbook.pdf
```

`project.yml`:

```yaml
name: reranker-study
description: Does a cross-encoder reranker help long-tail queries?
started: 2026-09-01
code_repos:
  - path: /home/tommaso/code/reranker   # results paths and commits resolve here
```

## Entry format

One file per entry: `{date}-{id}-{short-slug}.md`. IDs are `L001`, `L002`, … with one sequence per project across all types, never renumbered. They are distinct from fact IDs (`F001`).

```markdown
---
id: L014
type: experiment
title: Learning-rate sweep for the reranker
date: 2026-10-15
status: done                     # planned | running | done | failed | abandoned
provenance: recorded             # recorded | ingested | stated
tags: [reranker, tuning]
paper: null                      # library/{key} when the entry comes from or reproduces a paper
related: [L009, L012]            # entries this builds on
supersedes: null                 # L0xx whose conclusion this replaces
corrects: null                   # L0xx this fixes an error in
run:
  repo: reranker
  commit: 3f2a9c1
  dirty: false                   # uncommitted changes when the run started; diff saved to artifacts if true
  command: python train.py --config configs/rerank.yaml --lr {1e-5,3e-5,1e-4}
  config: configs/rerank.yaml    # snapshotted into artifacts/
  started: 2026-10-15T10:02
  finished: 2026-10-15T14:40
results:                         # files or folders; paths relative to the code repo
  - runs/lr-sweep/               # folder: metrics, plots, tables
---

## Question
Which learning rate should the reranker use before the main comparison?

## Setup
Three learning rates, one seed each, validation split only.

## Result
| lr   | NDCG@10 | source |
|------|---------|--------|
| 1e-5 | 0.401   | runs/lr-sweep/1e-5/metrics.json |
| 3e-5 | 0.412   | runs/lr-sweep/3e-5/metrics.json |
| 1e-4 | 0.388   | runs/lr-sweep/1e-4/metrics.json |

## Author's reading
3e-5 is best; differences are small and single-seed.

## Claude's notes
Only one seed per setting, so the 0.011 gap to 1e-5 may be noise. *(interpretation, not verified)*

## Next
L015 uses 3e-5 for the main comparison.
```

### Types and their body sections

| Type | When | Body sections |
|------|------|---------------|
| `experiment` | A run or set of runs | Question · Setup · Result · Author's reading · Claude's notes · Next |
| `decision` | A choice between options (ADR) | Context · Options considered · Decision · Why · Consequences · Revisit if |
| `design` | A component or architecture is defined or changed | What · Why · Alternatives · Affects |
| `dataset` | Data obtained, filtered, split or changed | Source · Processing steps · Resulting statistics · Known issues |
| `bug` | A bug that affected results | What was wrong · Which entries it affects · Fix (commit) · Rerun needed |
| `dead-end` | An approach given up after one or more entries | What was tried (entry IDs) · Why it was dropped · What would change that |
| `finding` | Something learned from a paper, a reproduction, or analysis | What · Source (`paper:` or entry IDs) · Consequence for the project |

Rules that apply to all types:
- Every number in a body has a pointer: a result file, an artifact, or `(author)`.
- `Claude's notes` is optional and always labelled as interpretation. It never contains numbers absent from the Result section.
- A `bug` entry lists the entries whose results it invalidates in `affects:`. Those entries are invalid from then on (a fix does not repair results produced before it; reruns are new entries), and the build, the digest and `intake` say so.
- A `decision` entry is required whenever the author picks between alternatives. Claude offers to write one when a choice like that comes up during any mode.

### Provenance

| Value | Meaning | Numbers come from |
|-------|---------|-------------------|
| `recorded` | Claude was present for the run | result files, read after the run (never from memory of terminal output) |
| `ingested` | Built from an author summary in `inbox/` | the summary, cited as `inbox/done/{file}`, plus result files if the summary names them and they exist |
| `stated` | The author said it in conversation | marked `(author, {date})` |

### Results and snapshots

Result files in the code repo get overwritten by later runs, which would break provenance. So when an entry is closed:
- `log-snapshot.mjs {project} {id}` copies files up to 5 MB each (metrics, CSVs, plots, small tables) into `log/artifacts/{id}/results/`, keeping their code-repo paths, smallest first, up to 50 MB per entry. Limits are set in `project.yml` under `snapshot:`.
- Larger files (checkpoints, predictions) are recorded by path, size and sha256 only. Everything is listed in `artifacts/{id}/manifest.json`.
- `log-snapshot.mjs {project} {id} --start`, before the run, prints the commit and dirty flag, saves `git diff HEAD` as `artifacts/{id}/uncommitted.diff` when dirty, and copies the config to `artifacts/{id}/config/`.
- Sealing (`check-log.mjs --seal`) hashes the entry together with its artifacts into `log/.sealed.json`.

## Modes

| Mode | Does |
|------|------|
| `init {project}` | Creates `projects/{project}/` with `project.yml`, asks once for description and code repo path(s) |
| `record` | Experiment run with Claude. **Before** the run: a `planned`/`running` entry with the question, so the hypothesis is written before the result is known. **After**: reads result files, fills Result, snapshots, asks the author for their reading, sets the status |
| `decide` | Writes a `decision` entry from the conversation. Proposes options and consequences from what was discussed; the author confirms the Why |
| `note {type}` | Any other type (`design`, `dataset`, `bug`, `dead-end`, `finding`) from the conversation |
| `ingest` | Each file in `inbox/` becomes one or more entries (`provenance: ingested`). Claims not checkable against result files stay marked `(author)`. Missing essentials (commit, config, seeds, split) become questions, never guesses. Processed files move to `inbox/done/` |
| `digest [since]` | Short summary since a date (default: 7 days): what ran and what came out, decisions taken, dead ends, bugs and the entries they affect, entries still running, open questions. Every line cites entry IDs. Written to `digests/` and shown in chat |
| `build` | `build-log.mjs` renders all entries into `build/logbook.tex` (chronological, plus an index by type and by tag, with plots from artifacts embedded), then `latexmk` |
| (no argument) | Status: entry counts by type, entries still `running`, unprocessed inbox files, date of last digest |

Gates (in the style of `modes/_shared.md`): every mode except `init` requires `project.yml`. `ingest` requires a file in `inbox/`. `build` requires at least one entry.

### Active project

Resolved in order: an explicit argument; else the project whose `code_repos` path contains the current working directory; else the only folder in `projects/`; else ask.

## Scripts

| Script | Enforces |
|--------|----------|
| `node check-log.mjs projects/{p}` | Frontmatter has the required fields per type; IDs unique and sequential; `related`/`supersedes`/`corrects`/`affected` targets exist; no edits to settled entries (hash stored in `log/.settled`); snapshot hashes match; every number in Result sections has a pointer |
| `node log-snapshot.mjs projects/{p} L014 [--start]` | Code state before the run; results snapshot and manifest after it |
| `node build-log.mjs projects/{p} [--pdf]` | Restricted markdown (headings, paragraphs, lists, bold/italic, inline code, code blocks, tables, images) → LaTeX, built with pdflatex. No dependencies, since pandoc is not installed |

## Research questions (added after the first version)

The log is the project's complete changelog; research questions are the one thing with a living file next to it.

- `questions/RQ{n}.md` holds the current version: `# question`, Why it matters, Hypothesis, What would answer it, Scope, Answer; frontmatter `status` (open, answered, partially-answered, dropped, reformulated) and `reformulated_as`.
- Every change is a `question` entry with `rq:` and `event:` (opened, revised, answered, partially-answered, dropped, replaced, reopened). `opened` and `revised` entries copy the question and its contract sections; `answered` entries copy the Answer. `check-log.mjs` fails when the file and the latest entry disagree, so the log holds every version.
- Entries of any other type bear on questions through `evidence: [{rq, stance}]`; the stance (supports, contradicts, inconclusive, setup) is the author's and may wait until the entry settles. Evidence is computed, never written into the question file, and invalidated entries stop counting.
- `check-log.mjs` warns when a hypothesis is revised after evidence existed, and when a question is answered with no valid evidence.
- A `work` type covers anything done that fits no other type, so the changelog misses nothing.
- `build` adds a research-question section to the PDF and writes `build/changelog.md`, one line per entry.

## Meetings (added after the first version)

- `meeting` entries have no fixed sections; `projects/{p}/meeting-template.md` is inferred from the author's own written reports and approved by them.
- Two inputs: a written report (any language; the entry is English), or a recording transcribed locally by `transcribe.py` (faster-whisper, `large-v3-turbo`, CPU int8). The Italian transcript with timestamps is kept in the entry's artifacts as the record; the report cites `[mm:ss]` for every decision, feedback item and action item.
- Speaker attributions inferred from a transcript are marked and confirmed by the author; `check-log.mjs` requires `speakers_confirmed: true` on a settled `transcribed` entry.
- `actions:` items (`{entry}-A{n}`, what, who, due) stay open until a later entry lists them in `resolves:`; overdue ones are warned about and shown in status, digest and the next meeting.
- A supervisor suggestion becomes a `decision` entry only if the author adopts it. Meeting entries are never a source of facts for `intake`.
- The audio is never copied into the log; the author decides per meeting (or once, in `project.yml`) whether to keep or delete it.

## Integration with `paper-ops`

- `new` asks which project the paper comes from and writes `project: {name}` to `papers/{slug}/paper.yml`.
- `intake` reads `projects/{project}/log/` as a source next to `source/`. A fact from a log entry uses the entry ID as its pointer: `- **F012** · L014 · Reranker NDCG@10 is 0.412 at lr 3e-5 on the validation split.` `check-numbers.mjs` already ignores pointers, so it needs no change.
- Entries that are superseded, corrected, or listed in a bug's `affects:` are not extracted as facts. `intake` lists them under "Not used" with the reason.
- `dead-end` and failed `experiment` entries feed the ledger's "Negative results and abandoned approaches" heading.
- `decision` entries feed "Method" with their Why, which is what reviewers ask for.

## Running from the experiment repo

Experiments usually run from a Claude session in the code repo, not in this one, so the skill must be reachable from there:
- Install by symlinking `.claude/skills/lab-log` into `~/.claude/skills/lab-log`. `SKILL.md` resolves the research-ops root as the real path of its own directory, walking upward to `AGENTS.md`.
- The active project is then found from the current working directory through `code_repos`.
- Optional: one line in the code repo's `CLAUDE.md` ("after running an experiment, offer `/lab-log record`") so Claude offers to record without being asked.

## Not in scope for v1

- Automatic capture by hooks on every command (too noisy; `record` is explicit)
- Experiment trackers (W&B, MLflow) as sources; possible later as an `ingest` source
- Linking entries to `library/` notes beyond the `paper:` field, until `/paper-read` exists
