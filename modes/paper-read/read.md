# Mode: read — the full pass

Turns a fetched paper into notes a later session can rely on without rereading the paper.

## Step 0 — Gate

`library/{key}/meta.yml` exists (else `add`). Source is `tex` or `pdf`; with `abstract-only`, stop and ask for the PDF.

## Step 1 — Read everything

- With LaTeX source: find the main file (the one with `\documentclass`) and read it following its `\input`/`\include` order, including appendices. Read `paper.txt` alongside for page numbers (pages are separated by form feeds).
- Without: read `paper.txt`, and look at pages with figures, tables and equations as images (`pdftoppm -png -r 110 -f N -l N`), since text extraction mangles them.
- Read every section. Do not sample. A long paper is read in several passes, writing notes as you go.

## Step 2 — Write the notes

From `templates/library/`, fill:

- **`notes.md`** — section by section, in the paper's order. Definitions, every design choice and the reason given for it, every result with its condition, every caveat. One bullet per point, with its location.
- **`notation.md`** — every symbol and operator the paper uses, where it is defined, its type or shape. Note symbols used before they are defined, and symbols used for two things.
- **`setup.md`** — datasets and their statistics, preprocessing, splits, models, baselines, hyperparameters, protocol, hardware. Then **Not specified in the paper**: what a reproduction would need that the paper does not give. If `source/code/` exists, look up each such gap there and note the answer as `(code: path:line)`.
- **`card.md`** — complete "Key equations" (one line each, E1, E2, … with location) and refine the rest now that the whole paper is read.
- **`delta.md`** — only if `extends:` names a paper in the library: what this paper adds, changes or drops relative to it (definitions, equations, operators, training, code paths), each point with locations **in both** papers.

## Step 3 — Verify

1. Run `node $ROOT/check-library.mjs library/{key}`; fix every error from the source.
2. Re-open the source for a sample of at least ten statements across the notes, chosen from the ones that matter most (contributions, definitions, results), and check each against its location. Fix what was wrong, and say how many needed fixing.
3. Write the outcome under "Read status" in `card.md`: date, what was read (sections, appendices, code or not), how many statements were re-checked, and anything left uncertain.
4. Set `status: verified` in `meta.yml` if the check passes and the re-check found nothing it could not fix; otherwise `status: read` and say what is open. Update the paper's line in `library/index.md` to the new status.

## Step 4 — Report and offer

Give the author the card. Offer `equations` (the deep pass) and `code` if there is a repo; offer `compare` if a project exists in `projects/`.
