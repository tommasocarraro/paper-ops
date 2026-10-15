---
name: lab-log
description: >-
  Project logbook and changelog -- record experiments, research questions,
  supervisor meetings (from written reports or local transcription of
  recordings, with action items tracked), decisions, design, datasets, bugs, dead ends, findings and other work as
  append-only entries with provenance; draft and track research questions with
  their evidence; ingest the author's experiment summaries; write a weekly
  digest; build the logbook PDF. Use when the user wants to log or record an
  experiment, a meeting, a decision or any project work, write or update a research
  question, ingest notes into the log, get a summary of recent work, or build
  the logbook.
arguments: mode
user-invocable: true
argument-hint: "[init | question | meeting | record | decide | note | ingest | digest | build] [project]"
---

# lab-log -- Router

## Project Root Resolution

This skill may be reached through a symlink in `~/.claude/skills/`, from a session in an experiment repo. Derive `ROOT` from the **real path** of this `SKILL.md` (`realpath`), walking upward until the nearest directory containing both `AGENTS.md` and `modes/`. Resolve every path below against `ROOT`, and run its scripts as `node $ROOT/{script}.mjs`.

## Mode Routing

| Input | Mode file |
|-------|-----------|
| (empty) | status: see below |
| `init {project}` | `modes/lab-log/init.md` |
| `question [new or RQ{n}]` | `modes/lab-log/question.md` |
| `meeting` | `modes/lab-log/meeting.md` |
| `record` | `modes/lab-log/record.md` |
| `decide` | `modes/lab-log/decide.md` |
| `note {type}` | `modes/lab-log/note.md` |
| `ingest` | `modes/lab-log/ingest.md` |
| `digest [since]` | `modes/lab-log/digest.md` |
| `build` | `modes/lab-log/build.md` |

## Active project

Every mode except `init` acts on one project in `ROOT/projects/`. Resolve it as: the name given as an argument; else the project whose `code_repos` path contains the current working directory; else the only folder in `projects/`; else ask which one.

## Context Loading

Before executing any mode, read in this order:

1. `modes/lab-log/_shared.md`
2. `modes/_custom.md` if it exists (house rules; may override workflow defaults, never adds content)
3. `modes/lab-log/{mode}.md`

## Status (no arguments)

Run `node $ROOT/check-log.mjs projects/{project}` and show:

```
lab-log · {project}

  /lab-log question  → Draft, revise or answer a research question; see its evidence
  /lab-log meeting   → Supervisor meeting from your written report or a recording
  /lab-log record    → Log an experiment: question before the run, results after
  /lab-log decide    → Record a decision: options, choice, why
  /lab-log note      → design | dataset | bug | dead-end | finding | work
  /lab-log ingest    → Turn your summaries in inbox/ into entries
  /lab-log digest    → What happened since a date (default: last 7 days)
  /lab-log build     → Render the logbook PDF

{n} entries: {counts by type} · open: {planned/running IDs} · inbox: {n files} · last digest: {date | never}
Questions: {RQ1 answered (3 evidence), RQ2 open (0), …}
Action items: {open ones, overdue first}
{check-log problems, if any}
```

If `projects/` holds no project, offer `init`.
