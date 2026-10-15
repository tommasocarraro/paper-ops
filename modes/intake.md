# Mode: intake — build the claims ledger

Reads everything in `source/`, and the project log if `paper.yml` names a project, and writes `facts.md`: the only place the paper's content may come from.

## Step 1 — Read the source

- PDFs: `pdftotext -layout` for text; then read the pages that contain figures or tables as images, since extracted text loses them. Read every page; do not sample.
- Notebooks, CSVs, logs: read them for numbers the prose does not state.
- Keep page or file pointers for everything.

### The project log

If `paper.yml` names a project, run `node check-log.mjs projects/{project} --json` first. If it reports errors, list them and ask the author whether to fix the log first (with `/lab-log`) or go on without the failing entries.

Then read `projects/{project}/log/`:
- Use only settled entries (`done`, `failed`, `abandoned`). Entries still `planned` or `running` are listed as open work.
- Skip every entry the check marks `invalid` (superseded, corrected, or affected by a bug); list each under "Not used" with the entry responsible. Read the correcting or superseding entry instead.
- `## Claude's notes` are never facts. `## Author's reading` is the author's claim and keeps its wording.
- A number marked `(author, {date})` in the log becomes a fact with pointer `L0xx (author)`.
- Research questions in `projects/{project}/questions/` with status `answered` or `partially-answered` feed **Problem and motivation** (the question, its hypothesis) and **Results** (the Answer, pointer `RQ{n}`, plus the evidence entries it cites). Open and dropped questions go to **Open questions and future work**. A hypothesis revised after evidence (check-log warns) is recorded as revised, never as the original.
- `meeting` entries are never a source of facts. Decisions taken in a meeting reach the ledger through their own `decision` entries; numbers said in a meeting through the entries that measured them.
- `decision` entries feed **Method** (with their Why); `dataset` entries feed **Data**; failed experiments and `dead-end` entries feed **Negative results and abandoned approaches**; `finding` entries with `paper:` are noted for `related`, never cited from the log.

## Step 2 — Extract into `facts.md`

One entry per atomic fact, restating what the source says without interpretation. Group them under the headings in the template:

- **Problem and motivation** — what the project set out to do and why
- **Method** — every component, design decision, and the reason given for it
- **Data** — datasets, sizes, filters, splits, preprocessing
- **Experimental setup** — models, baselines, hyperparameters, metrics, protocol, hardware
- **Results** — every reported number, with metric, condition and the table or figure it comes from
- **Negative results and abandoned approaches** — what was tried and did not work
- **Limitations stated by the author** — weaknesses the document itself admits
- **Open questions and future work**
- **Figures and tables** — an inventory of every image and table in the source: its kind (plot, table, diagram, example), what it shows, where it is, and where its numbers can be had: a result file in `source/`, values stated in the text (give the fact IDs), a table screenshot with legible digits, or the image alone. Do not estimate values from a plot image; record that only the image exists.

Entry format:

```markdown
- **F012** · p. 14 · Reranker NDCG@10 is 0.412 against 0.431 for the retriever on the full test set.
- **F013** · L014 · With lr 3e-5 the reranker reaches NDCG@10 0.412 on the validation split (one seed).
```

The pointer is a page (`p. 14`), a source file, or a log entry ID (`L014`).

Rules:
- Copy numbers exactly, with the precision the source uses.
- Keep the source's own strength of claim. If it says "seems to help", the entry says "seems to help".
- If two places in the source disagree, record both entries and add the pair to the Conflicts list.
- Never renumber IDs. On a re-run after the source changed, append new IDs and mark superseded ones `~~struck~~ superseded by F0xx`.

## Step 3 — Report what a paper will need that the source lacks

Compare the ledger against what a paper of this kind normally reports and list the gaps, without filling them:

```text
Not found in the source:
  • number of runs or seeds, variance, significance tests
  • dataset statistics table
  • {…}

Conflicts in the source:
  • F020 vs F047: {…}

Sensitive items I noticed (decide in brief):
  • {company, internal system, dataset or person names; absolute business figures}
```

Not used from the log:
  • L018: affected by bug L023
  • …

Write these lists to the end of `facts.md` as well, so `brief` can pick them up.

## Step 4 — Confirm

Give the author the entry counts per heading and the three lists, and ask them to skim `facts.md` for anything misread. Corrections from the author are applied to the ledger with `· author-stated {date}` in place of the page pointer.
