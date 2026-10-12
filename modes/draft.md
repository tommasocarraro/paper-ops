# Mode: draft — write sections

Writes `sections/{name}.tex` from the approved outline. `/paper-ops draft` drafts the next undrafted section; `/paper-ops draft method` drafts one by name; `/paper-ops draft all` runs them in order, pausing after each.

## Step 0 — Gate

`outline.md` must carry `**Approved:**`. `brief.md` Blocks 1 to 5 must be complete.

## Order

Method → Experimental setup → Results → Discussion and limitations → Introduction → Conclusion → Abstract. Related Work comes from the `related` mode. The introduction and abstract are written last because they summarise sections that must exist first.

## Per section

1. Read `modes/_writing.md`, `voice-dna.md`, the section's outline, the facts it names, and the already drafted sections it must agree with.
2. Write paragraph by paragraph following the outline. Each paragraph uses only the facts and citations listed for it. If the paragraph cannot be written without something else, write `\todo{...}` and move on.
3. Apply `brief.md`: fixed terminology, confidentiality wording, anonymity.
4. Numbers exactly as in the ledger. Result statements keep the ledger's strength.
5. End each paragraph with `% facts: F0xx, ...`.
6. Figures and tables come from the `figures` mode. Include the ones the manifest marks `built` or `done` for this section, each referenced in the text before it appears and discussed: say what the reader should see in it, not only that it exists. For a row not built yet, write `\todo{figure: name}` and suggest running `figures`. Never type a results table by hand.
7. Reread against the litmus test in `voice-dna.md` and its section 6. Rewrite what fails.
8. Check the length against the outline budget; if it is over, say by how much and what could be cut. Do not cut content silently.

## After each section

Run the checks and show their output unedited:

```bash
node check-numbers.mjs papers/{slug}
node check-citations.mjs papers/{slug}
node check-figures.mjs papers/{slug}
```

If `latexmk` is available, build the PDF (`latexmk -pdf -interaction=nonstopmode -halt-on-error main.tex` in the paper folder) and report the page count against the limit.

Then report: the file written, word count against budget, open `\todo` items, and any sentence where the voice profile and accuracy pulled in different directions (accuracy won; say where).

Ask the author to read the section before continuing to the next. Their edits to a `.tex` file are theirs: when revising later, change only what they ask, and treat recurring edits as a signal to update `voice-dna.md` (offer it; do not do it unasked).

## Abstract and introduction

- The contributions list is the one in `brief.md`, in the author's format from `voice-dna.md`.
- Every claim in the abstract must already be made, with its evidence, in the body.
- Headline numbers in the abstract only if the author's samples do that or the brief asks for it.
