# Mode: review — a critical read before submission

Writes `review.md`. Reports problems; changes nothing in `sections/` unless the author asks.

## Step 1 — Mechanical checks

```bash
node check-numbers.mjs papers/{slug}
node check-citations.mjs papers/{slug}
node check-figures.mjs papers/{slug}
```

Include the output as it is.

## Step 2 — Traceability audit

For every paragraph in `sections/`:
- Does each statement of fact follow from the facts named in its `% facts:` comment? Flag any that is stronger than the ledger entry.
- Does each statement about a cited work follow from that work's `refs/` note? Flag statements that go beyond a `metadata-only` note.
- Is anything in the confidentiality table of `brief.md` exposed?
- If the submission is anonymous: any name, affiliation, repository link or "our previous work" phrasing?

## Step 3 — Reviewer simulation

Read the paper as a reviewer for the venue in `brief.md` would, using only the paper text. Write:

- Summary of the paper in three sentences, as the reviewer understood it. (If it differs from the claim in `brief.md`, the paper is not saying what the author intends.)
- Strengths
- Weaknesses, most serious first, each with the section it concerns
- Questions the reviewer would ask
- Which claimed contribution is least supported by the evidence shown

Where the venue's review form or criteria were supplied in `brief.md`, follow them. Do not predict an acceptance score.

## Step 4 — Voice audit

Compare each section with `voice-dna.md`: list sentences that match section 6 (AI patterns), and paragraphs whose structure departs from the author's section moves.

## Step 5 — Figures

Render each page that holds a figure or table (`pdftoppm -png -r 110 main.pdf`) and look at it as a reader would: is every figure legible at printed size, does the text around it say what its manifest message promises, do colours and method names match across figures, and does any reused screenshot show something the confidentiality table forbids?

## Step 6 — Consistency

Terminology against `brief.md`; notation used before it is defined; figures and tables never referenced; numbers that differ between abstract, introduction and results; open `\todo` items; page count against the limit if the PDF was built.

## Output

`review.md` with one heading per step, and a short prioritised list in chat: what must be fixed before submission, what should be, what is optional. Offer to apply fixes one group at a time.
