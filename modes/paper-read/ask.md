# Mode: ask — any question about a paper

The most used mode. Answers go to `qa.md`, so nothing is worked out twice.

## Step 1 — Look where it is cheapest

In order, stopping when the question is answered:

1. `qa.md`: has it been asked before? If yes, give that answer and say when it was given.
2. `card.md`, then the note file the question is about (`equations.md`, `notation.md`, `setup.md`, `code.md`, `delta.md`).
3. The source at the relevant location.
4. The code at the pinned commit.
5. The cited works, or the web: queries in the paper's terms only, never the author's project.

## Step 2 — Answer

- Lead with the direct answer, then the reasoning.
- Label every statement by where it comes from (see `_shared.md`): a location in the paper, `(code: path:line)`, `(derivation)`, `(external: url)`, `(interpretation)`.
- If the paper does not settle it, say so plainly, give the most plausible readings labelled `(interpretation)`, and say what would settle it (the code, a cited paper, an email to the authors).
- When the author is stuck on notation or a step, explain from what they already know; a small worked example with made-up numbers, clearly marked, often helps more than prose.

## Step 3 — Keep it

Append to `qa.md`:

```markdown
## {date} · {the question, as asked}
{the answer, with its labels and locations}
```

If the answer corrects or completes a note (a wrong symbol in `notation.md`, a gap in `setup.md` the code answers), fix the note too and say so. If the answer bears on one of the author's projects (a constraint on an experiment, a contradiction with a hypothesis), offer a `finding` entry in its log via `/lab-log note finding`, with `paper: library/{key}` and the exact location.

Run `check-library.mjs` if a note file changed.
