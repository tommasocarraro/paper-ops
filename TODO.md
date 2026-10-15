# TODO

## Planned

Order matters: the logbook comes first because the other skills write into it and `intake` reads from it.

- [x] **`/lab-log` skill — project logbook** (design: `docs/design/lab-log.md`)
  - One markdown entry per event in `projects/{project}/log/`; the PDF (`logbook.pdf`) is a build output, never edited
  - Entry types: experiment, decision, design, dataset, bug, dead-end, finding
  - Frontmatter: `id`, `type`, `date`, git commit, command, config, `results:` (a file **or a folder** with metrics, plots, tables), outcome, `supersedes:`, `paper:` (optional `library/{key}`, e.g. when reproducing or acting on something found in a paper)
  - Decision entries are short ADRs: context, options considered, choice, why
  - Modes: `record` (experiment run with Claude: capture commit/command/config/results directly), `ingest` (summaries the author drops in `inbox/` as txt/pdf; unverified content marked as the author's claim, gaps become questions), `build` (render the PDF), `digest [since]` (short weekly summary of everything done)
  - `intake` reads `log/`, so fact IDs can point at log entries
  - Supervisor meetings: `meeting` entries from a written report or a local transcription (`transcribe.py`), English report in the shape of the author's own, action items tracked with `actions:` / `resolves:`
  - Research questions: one file each in `questions/`, every change logged as a `question` entry, evidence collected from `evidence:` blocks with the author's stance

- [ ] **`/paper-read` skill — understand a paper**
  - One folder per paper in `library/{key}/`: `summary.md`, `notation.md`, `qa.md` (per paper), source PDF or arXiv LaTeX
  - Prefer arXiv LaTeX source over PDF text so equations come through exactly; check the official code when it exists
  - Answers labelled by provenance: the paper says / the code does / derivation / external source [link] / interpretation, unverified
  - Own trust rules: background knowledge and web search allowed, but always labelled. Never mixed with `paper-ops` source-of-truth rules
  - Modes: `read`, `ask`, `notation`, `compare` (against the author's idea from the project log or brief)

- [ ] **`/data-ops` skill — dataset processing**
  - Independent of any paper: the unit is a dataset in a project
  - Step-by-step pipeline checklist (filtering, deduplication, thresholds, splits, leakage, sampling, normalization), each step flagged *stated / code only / unspecified* when a reference paper is given
  - Optional `--paper {key}` to follow a pipeline described in a `library/` paper
  - Every choice the author makes is written to the logbook as a `decision` (or `dataset`) entry

- [ ] **`/lit-search` skill — find papers**
  - Semantic search via web search, Semantic Scholar API (search, recommendations) and arXiv API
  - Queries are written from what the author states in the conversation, never from `source/` or the log (confidentiality)
  - Output is a candidate list; nothing is cited until the author approves it and `related` fetches it

- [ ] **Restructure into `research-ops`**
  - `projects/{project}/{log/, inbox/, papers/{slug}/}` and a shared `library/`; update `.gitignore`
  - Slim `AGENTS.md` to the shared contract (user/system split, confidentiality, untrusted content) plus pointers; each skill carries its own trust rules
  - Repo rename optional

## Deferred

- [ ] **`/supervisor` skill — critical check of a paper before submission**
  - Gap finder: claims without an ablation, single-seed results, baselines not tuned, all checked against the log and `facts.md`
  - Notation consistency: `check-notation.mjs` flags one symbol used for two things, or one thing written two ways, across `sections/*.tex`
