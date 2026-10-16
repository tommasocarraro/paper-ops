# Mode: compare — the paper and a project

Writes `library/{key}/relation/{project}.md`: how this paper relates to one of the author's projects. Read locally; nothing from the project goes into a search or fetch.

## Inputs

- The paper: `card.md`, `notes.md`, `setup.md`, `delta.md` if present.
- The project: `projects/{project}/project.yml` (description), `questions/RQ*.md`, and the log entries that matter (designs, decisions, datasets, findings). If the project has no questions or entries yet, ask the author to describe the idea in a few lines and use that, saying so in the file.

## The file

```markdown
# {key} and {project}

As of {date}, against: {RQ IDs and entries read, or "the author's description of {date}"}

## What the paper already covers
## Where the project differs
## What the project can reuse      ← definitions, operators, code modules, datasets, protocol
## What it would need to cite, match or beat
## Tensions                         ← where the paper's results or assumptions bear on a hypothesis
## Open questions for the author
```

- Every paper-side statement has its location; every project-side statement names its RQ or entry.
- Claims about novelty are the author's to make. Write "the paper does not address X (searched: §…)" rather than "X is novel".
- Where a tension bears on a research question, offer a `finding` entry with `evidence:` for that question; the stance is the author's.

Run `check-library.mjs` and report.
