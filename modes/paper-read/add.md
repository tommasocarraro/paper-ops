# Mode: add — fetch a paper into the library

## Step 1 — Fetch

The author supplies the link: an arXiv or DOI link, a PDF URL, or a PDF dropped somewhere local. Optionally the official code repo, documentation, and the paper it extends.

```bash
node $ROOT/fetch-paper.mjs {link} [--code {repo-url}] [--docs {docs-url}] [--extends {key}]
```

Run from `ROOT`. Report its output as it is. Then:

- **Not on arXiv, no open PDF:** ask the author to put the PDF in `library/{key}/source/paper.pdf`, then run `pdftotext -layout` on it into `source/paper.txt`.
- **`metadata_via: none`:** fill `meta.yml` from the fetched page (title, authors, year, venue as the page states them) and change `metadata_via` to `page`. Never from memory.
- **A journal version and an arXiv version:** fetch the arXiv one for the source and the PDF; the journal DOI is recorded in `meta.yml` if the arXiv record has it. If they differ in content, say which one the notes follow.
- **Documentation:** recorded in `meta.yml` under `links.docs`. Fetch pages from it on demand during `code` or `ask`; cite them as `(external: url)`.
- **Code:** the clone is pinned at the commit in `meta.yml`. If the repo is very large, say its size and ask before keeping it.

## Step 2 — The card

Read the abstract, introduction, conclusion, and the headings and captions of everything in between (from `source/tex/` if present, else `source/paper.txt`). Copy `templates/library/card.md` and fill it: what problem, what the authors claim, the method in a few lines, the main results, the limitations they state, each bullet with its location. Leave "Key equations" and "Read status" for `read`.

Status stays `added`. Run `check-library.mjs` and report.

## Step 3 — Offer

Offer `read` (the full pass). If `extends:` names a paper not yet in the library, offer to add it first: the delta notes need both.
