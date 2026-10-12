# Mode: figures — plots, diagrams, examples and tables

Builds every figure and table planned in `figures/figures.md`. `/paper-ops figures` works through all rows that are not `done`; `/paper-ops figures {name}` builds one.

Works with whatever the author has. Each figure takes the best path its material allows; nothing is blocked because raw results are missing.

## Step 0 — Gate and setup

- Needs `figures/figures.md` with at least one row. `outline` writes it; if the author wants a figure before the outline exists, add the row with them first.
- Plots need Python with matplotlib. Use `PROJECT_ROOT/.venv/bin/python`; if it is missing, create it (`python3 -m venv .venv && .venv/bin/pip install matplotlib`) after telling the author.
- Once a venue template is installed, set the real widths in `figures/style.py`: compile a two-line probe that uses the paper's `\documentclass` line and prints `\the\columnwidth` and `\the\textwidth` with `\typeout`, then convert points to inches (divide by 72.27). Without a template, leave the defaults.

## Step 1 — Choose the path per figure

Read the row's kind and what exists for it, then pick the first path that applies:

| Kind | What exists | Path |
|------|-------------|------|
| plot | result files in `source/` (CSV, JSON, notebook output, logs) | **A. Regenerate** from those files |
| plot | numbers stated in the documentation's text or tables (ledger facts) | **A. Regenerate** from the facts |
| plot | only an image of the plot | **B. Reuse the image**, or ask the author for the numbers |
| table | result files or ledger facts | **C. Generate the table** |
| table | only a screenshot of a table whose digits are legible | **C.** after transcription *and author confirmation* (see below) |
| diagram | method facts in the ledger | **D. Draw in TikZ** |
| example | — | **E. Ask the author** for a shareable example |

**Never read values off a plot image.** Estimating bar heights or curve points from a picture invents precision; it is the figure equivalent of fabricating a number. A screenshot of a *table* is different, because the digits are printed: transcribe them, show the author the transcription next to the page reference, and use it only after they confirm. Confirmed values enter `facts.md` as new entries.

Tell the author which path each figure took, and for path B what they would need to supply to upgrade it.

## Path A — Regenerate a plot

1. Write the data to `figures/data/{name}.csv`: long format, one row per observation, column names using the terminology fixed in `brief.md`. Copy digits exactly.
2. Record the provenance in the manifest row: the `source/` file and the transformation applied, or the fact IDs. A CSV with no recorded provenance fails `check-figures`.
3. Write `figures/{name}.py`. It imports `style`, reads only its CSV, and ends with `style.save(fig, "{name}")`. No numbers typed into the script.
4. Choose the form by the comparison being made: bars for a few discrete conditions, lines for an ordered variable, a dot plot with intervals when variance is reported. Show variance only if the ledger has it. Axes start at zero for bars; if a truncated axis is needed to see a difference, say so in the caption.
5. Add each method to `METHOD_COLORS` in `figures/style.py` the first time it appears, so it keeps its colour in every figure. Label lines directly where there is room; otherwise one legend.
6. Run it from the `figures/` directory: `../../../.venv/bin/python {name}.py`.

## Path B — Reuse an image

Extract the image from the source at the best available resolution (`pdfimages -png`, or crop the rendered page) into `figures/{name}.png`. Do not retouch its content. Note in the manifest that it is a raster reuse, and list it at the end of the run as a candidate for upgrading.

Check it against the confidentiality table in `brief.md` first: a screenshot can carry internal names in titles, axes or legends that the text has been cleaned of. If it does, it cannot be reused; ask the author.

## Path C — Generate a table

1. Data to `figures/data/{name}.csv` with provenance, as in Path A. First column is the row label.
2. `node make-table.mjs papers/{slug}/figures/data/{name}.csv --out papers/{slug}/tables/{name}.tex`, with `--lower "col,col"` for metrics where lower is better and `--second` if the author's samples underline the runner-up. The script copies digits unchanged and marks the best value per column.
3. The `table` environment, caption and label go in the section file, around `\input{tables/{name}}`.
4. Never edit a generated table by hand; change the CSV and regenerate.

## Path D — Draw a diagram

1. Build it from the method facts only: one node per component the ledger names, one arrow per data flow it states. Names from `brief.md` terminology. A component the ledger does not describe is not drawn.
2. Write `figures/{name}.tex` as a bare `tikzpicture` (no preamble), included with `\input{figures/{name}}` inside a `figure` environment. It then uses the paper's own fonts.
3. Keep it to boxes, arrows, grouping frames and short labels, in the colours from `style.py` where colour carries meaning. Left to right or top to bottom, one reading direction.
4. To look at it, compile a standalone wrapper in a temporary directory, not in the paper folder.

This produces a clean, correct first version. If the row is the paper's opening figure, say plainly that it is a draft for the author to refine.

## Path E — Example figures

A prompt, a generated output, a before-and-after list. Real records from `source/` are never used: they may be personal or proprietary data. Ask the author for a synthetic or redacted example and typeset what they give. Mark the row `waiting-author` until then.

## Step 2 — Render and look

For every figure built or changed, look at the result; code review does not catch what a reader sees.

```bash
pdftoppm -png -r 200 figures/{name}.pdf /tmp/{name}          # as printed
pdftoppm -png -gray -r 200 figures/{name}.pdf /tmp/{name}-gray
```

Open both images and check:

- **Data:** every value in the CSV appears, at the right height and under the right label; nothing missing, nothing extra
- **Legibility at final size:** text no smaller than the caption font, no clipped or overlapping labels, legend not covering data
- **Greyscale:** series still distinguishable (use markers or line styles, not colour alone)
- **Honesty:** axis ranges and scales do not exaggerate a difference; units and metric direction stated
- **Consistency:** method names, colours and metric names match the other figures and the text

Fix and re-render until it passes. If something cannot be fixed without information the author has, say so instead of approximating.

## Step 3 — Captions and placement

- Write the caption in the author's caption style (`voice-dna.md` §4). It states what is shown and the one message from the manifest row, and can be understood without the body text. Numbers in a caption come from the ledger like any other.
- Place the `figure` or `table` environment in the section the outline assigns, after its first reference in the text.
- Single-column by default; `figure*` only when the manifest row says full width.

## Step 4 — Check and report

```bash
node check-figures.mjs papers/{slug}
node check-numbers.mjs papers/{slug}
```

Show both outputs unedited. Update each manifest row's status, then report per figure: path taken, file, what was checked by eye, and what is still needed from the author.
