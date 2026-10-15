# Mode: question — research questions

A research question lives for months and connects many entries. Its file, `questions/RQ{n}.md`, is the current version. Every change to it is a `question` entry in the log, so the log keeps the whole history. `check-log.mjs` fails if the file and its latest log entry disagree.

## Arguments

| Input | Does |
|-------|------|
| (none) | Table of all questions: status, evidence by stance, open entries serving each, and problems (below) |
| `new` | Draft and open a new question |
| `RQ{n}` | Show one question with its evidence and history, then offer: revise, answer, drop, replace, reopen |

## What a good research question has

A question is ready when the author could say in advance what result would answer it. Each file has:

```markdown
---
id: RQ2
status: open            # open | answered | partially-answered | dropped | reformulated
reformulated_as: null   # the RQ that replaced it, when status is reformulated
---

# {the question, one sentence}

## Why it matters
## Hypothesis
## What would answer it
## Scope
## Answer
```

- **Hypothesis**: the expected answer, written before the evidence. It stays even when the evidence goes against it; that is a result, not a mistake.
- **What would answer it**: the comparison, the metric, the data, and what outcome counts as yes, no and inconclusive. If this cannot be filled in, the question is not ready; keep sharpening.
- **Scope**: what is deliberately left out.
- **Answer**: empty until the question is answered; written by the author; cites the entries it rests on.

There is no Evidence section in the file. Evidence is computed from the `evidence:` blocks of log entries, so it cannot go stale; this mode, `digest` and `build` show it.

## `new` — drafting

1. Take the author's draft, however rough.
2. Ask, one block at a time, for what is missing: compared with what? measured how, on which data or slice? what result would mean yes, no, inconclusive? what is the expected answer? Propose options from the log and the conversation; **never fill in the usual comparison or metric from the field** on the author's behalf.
3. Point out a question that is really two (split it) or that no single experiment could answer (narrow it), and let the author decide.
4. Show the final file and the log entry. On approval, write `questions/RQ{n}.md` (next free number, never reused) and the entry:

```yaml
type: question
rq: RQ2
event: opened
status: done
provenance: stated
```

with `## Question` (the exact title line) and the four contract sections copied exactly from the file. Seal it.

## Changes after opening

Each change is a new entry with the question's `rq:`, then the file is updated to match. Never edit the file without the entry.

| Event | When | Entry sections | File after |
|-------|------|----------------|-----------|
| `revised` | Wording, why, hypothesis, criteria or scope changes | Question + the four contract sections as they now read + `What changed and why` | contract updated, status `open` |
| `answered` | The author considers it answered | `Answer` (cites entries) | `## Answer` identical, status `answered` |
| `partially-answered` | Some of it is answered | `Answer` | same, status `partially-answered` |
| `dropped` | No longer pursued | `Why` | status `dropped` |
| `replaced` | Superseded by a new question; also open the new one | `Why`; frontmatter `replaced_by: RQ{m}` | status `reformulated`, `reformulated_as: RQ{m}` |
| `reopened` | New evidence reopens an answered or dropped question | `Why` | status `open` |

When the hypothesis is revised after evidence exists, `check-log.mjs` warns (`hypothesis-after-evidence`). The revision is allowed, but say so to the author: a hypothesis rewritten to fit the results cannot be reported as the original one.

## Answering

Before writing `answered`, show the evidence: each entry with its stance, and entries that do not count because a bug, a correction or a later result invalidated them. If no valid evidence remains, or the stances disagree, say so and suggest `partially-answered` or another experiment. The Answer keeps the evidence's strength of claim: one seed is "on one seed".

## Status table (no argument)

```text
RQ1  answered            Does reranking help long-tail queries more…   3 supports · 1 inconclusive
RQ2  open                Is the gain explained by query length?        0 · open: L031 (running)
RQ3  reformulated → RQ4
```

Under it, list problems: open questions with no entry serving them, answered ones whose evidence was invalidated, `check-log` errors and warnings about questions.
