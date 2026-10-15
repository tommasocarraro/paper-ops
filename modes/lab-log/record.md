# Mode: record — an experiment run with Claude

Two halves: the entry is opened **before** the run, so the question is written down before the result is known, and closed after it. If the run already happened, skip to Step 3 and say that the question was written after the result.

## Step 1 — Open the entry (before the run)

Propose, from the conversation, and let the author correct:

```text
L0xx · {title}
Question:  {what this run is meant to find out}
Setup:     {what varies, what is fixed, data split, seeds}
Command:   {command}
Config:    {config file(s)}
Results:   {where the run will write: files or folders}
Related:   {earlier entries it builds on}
Serves:    {research questions it bears on, e.g. RQ2; or none}
Paper:     {library/{key} if it reproduces or follows a paper}
```

Write the entry with `status: running` (or `planned` if it will run later), `provenance: recorded`, `## Question` and `## Setup`, and `evidence:` with each research question it serves and no stance yet. If it serves none, ask whether it should: an experiment with no research question is fine for exploration, but say so. If the run is meant to answer something not yet written as a question, offer `question new` first.

## Step 2 — Capture the code state

```bash
node $ROOT/log-snapshot.mjs projects/{p} L0xx --start
```

Copy `commit` and `dirty` from its output into `run:`, with `started:`. If the tree is dirty, say so: the diff is saved in `artifacts/L0xx/uncommitted.diff`, but suggest committing first so the run is reproducible from a commit.

Then run the experiment as agreed.

## Step 3 — Close the entry (after the run)

1. Set `run.finished`, then snapshot the results:
   ```bash
   node $ROOT/log-snapshot.mjs projects/{p} L0xx
   ```
   Report which files were copied and which recorded by hash only.
2. **Read the result files**, not the terminal output, and write `## Result`: every number with its file path on the same line, at the precision the file has. Include plots the run wrote as `![caption](path)`. If the run crashed, Result says how and where (log file and line), and the status is `failed`.
3. Ask the author for their reading in one line, and write it verbatim (lightly cleaned) under `## Author's reading`. Never write this section yourself.
4. Optionally add `## Claude's notes`: caveats you see (one seed, small differences, a metric that moved against the others), labelled as interpretation, with no number that Result does not hold.
5. For each research question in `evidence:`, show its hypothesis and ask the author for the stance: supports, contradicts, inconclusive, or setup. Write what they say; never choose it.
6. Ask whether anything follows (`## Next`), and whether the run settled a choice: if so, offer `decide`. If the evidence now looks enough to answer a question, offer `question RQ{n}`.
7. Set `status` (`done`, `failed` or `abandoned`), run `node $ROOT/check-log.mjs projects/{p}`, fix what it reports, then seal with `--seal` once the author is happy with the entry.

## Several runs

A sweep or a set of seeds launched together is one entry. Separate questions are separate entries, even when they run in one session.
