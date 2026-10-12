# Mode: style — capture the author's writing voice

Reads the author's own papers in `writing-samples/` and writes `voice-dna.md`. Run once, and again whenever samples are added.

## Step 0 — Gate

List the files in `writing-samples/` (skip `README.md`). If there are none, stop and ask the author to add papers they wrote without AI assistance. PDF, `.tex`, `.md` and `.txt` all work; `.tex` is best because it also shows LaTeX habits.

## Step 1 — Ask about the samples

Papers are co-authored and edited, so ask before trusting a sample as the author's voice:

```text
I found these samples:
  1. {file} — {title if readable}
  ...

For each one:
  a) Which sections did you write yourself? (all / list them / mostly the co-authors)
  b) Was it written without AI assistance?
  c) Is it the kind of paper you want to sound like now? (yes / it is early work, weight it less)
```

Use only the sections the author wrote. Exclude any sample they say was AI-assisted. Record the answers in the Provenance section of `voice-dna.md`.

## Step 2 — Extract

Extract text with `pdftotext -layout` for PDFs. Ignore reference lists, author blocks, acknowledgements and anything inside tables.

Describe only what is demonstrably present in at least two samples, or repeatedly within one. For each item give the pattern and how often it holds.

**Section moves** — how each section is built, sentence by sentence:
- Abstract: order of moves (context, gap, method, result, implication), length, whether numbers appear
- Introduction: how the first paragraph opens, how the gap is stated, how contributions are presented (bulleted list, prose, numbered), whether a paper-outline paragraph closes it
- Related Work: organised by theme or chronology, how a paragraph closes (does it state the difference from the present work?), how cited work is introduced (author-led "X et al. propose" or idea-led)
- Method: intuition before formalism or the reverse, how notation is introduced, use of running examples
- Experiments and results: research questions stated explicitly or not, order of setup items, how a result is read out (number first or interpretation first), how negative or mixed results are worded
- Conclusion: restates or extends, how limitations and future work are handled

**Sentences and paragraphs**
- Typical sentence length and its spread; typical paragraph length
- Active vs passive; "we" vs impersonal; tense by section
- How sentences open; preferred connectives; connectives never used
- Hedging: which hedges, and where

**Vocabulary**
- Verbs the author reaches for when presenting their own work, and when describing others' work
- Recurrent short phrases (five words or fewer)
- Common academic words that never appear in the samples

**Notation and LaTeX habits** (from `.tex` samples, or from PDF where visible)
- Citation command and placement, `\emph` vs `\textit`, how terms are introduced, footnote use
- Notation conventions: sets, vectors, users and items, metric names
- Caption style for figures and tables

## Step 3 — Rules for the extraction

- Store abstract descriptors and short recurrent phrases only. Do not store whole sentences from the samples.
- Do not store content: no results, claims or topic-specific statements.
- An unconventional habit is the author's voice. Record it without correcting it.
- Where samples conflict, prefer the ones the author marked as how they want to sound now.

## Step 4 — Write `voice-dna.md`

Fill `voice-dna.template.md` and write it to the project root. Keep the template's section 6 (AI patterns to avoid) unless the author's samples contain one of the listed patterns as a real habit; in that case remove that item and note it.

## Step 5 — Calibration test

Show the author a summary of the profile in ten lines or fewer. Then write one neutral paragraph (a generic method description on a topic unrelated to their samples) in the extracted voice and ask:

```text
Does this read like you? Tell me what is off and I will correct the profile.
```

Apply corrections to `voice-dna.md`. The author's correction always wins over what the samples suggested.
