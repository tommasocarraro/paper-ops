# Mode: outline — the section plan

Writes `outline.md`: for each section, the paragraphs it will contain, each tied to the facts and citations it uses. This is where the author steers the paper cheaply, before any prose exists.

## Step 1 — Build

Read `facts.md`, `brief.md`, `refs/`, and section 1 of `voice-dna.md` (the author's section moves decide the paragraph order inside each section).

For each section in the venue's expected structure:

```markdown
## 3 Method  (budget: ~1.5 pages)

1. Overview of the pipeline and where the two modules sit — F008, F009 · Fig. 1
2. Selecting positive and negative items: why selection matters — F014, F015
3. ...
```

- Each paragraph line: its single point, the fact IDs behind it, cite keys, and any figure or table.
- Split the page limit from `brief.md` across sections and show the budget.
- Include only what `brief.md` Block 3 marked main; list appendix items under `## Appendix`.
- Plan figures and tables in `figures/figures.md`, one row each: a short name, its kind, the **one message** a reader should take from it, the section it belongs to, single-column or full width, and where its numbers come from. Leave Path and Status for the `figures` mode. A figure with no message is cut. Prefer one figure per contribution in `brief.md`; flag a contribution that no figure or table supports.

## Step 2 — Coverage report

```text
Facts marked main but not placed: F0xx, ...
Contributions from the brief and the paragraph that supports each:
  • {contribution} → §4 ¶2, §5 ¶1
  • {contribution} → NOT SUPPORTED by any planned paragraph
Paragraphs with no facts behind them: {list — these will be \todo or cut}
```

A contribution with no supporting paragraph is raised with the author, never papered over.

## Step 3 — Approval

Show the outline, the figure plan and the coverage report. Offer three title candidates if the brief asks for them. Ask the author to approve or edit.

When approved, add `**Approved:** {date}` at the top of `outline.md`. `draft` refuses to run without it. If the author edits the outline later, the approval stands; if the agent changes it, ask again.
