# Writing rules -- paper prose

Applies to everything written into `sections/*.tex`.

## Precedence

1. **Accuracy.** The ledger and the `refs/` notes decide what is said. Style never changes a number, a result or the strength of a claim.
2. **`brief.md`.** Terminology, person, confidentiality wording and the venue's limits.
3. **`voice-dna.md`.** How the author writes: section moves, sentence shape, vocabulary, LaTeX habits.
4. **The defaults below**, only where `voice-dna.md` is silent.

## Applying the voice

- Read the whole of `voice-dna.md` before writing a section, and the section-specific moves for the section at hand.
- Imitate structure and habits, not sentences. Never copy a sentence from `writing-samples/` into a new paper; reusing published text is self-plagiarism.
- An idiosyncratic habit recorded in `voice-dna.md` is the author's voice. Keep it; do not correct it toward generic academic English.
- After a section is drafted, reread it against the litmus test in `voice-dna.md`. Rewrite what fails.

## Defaults when the voice file is silent

- One idea per paragraph, stated in its first sentence.
- Define a term once, then use the same term every time. Use the terms fixed in `brief.md`.
- Say what was done and what was found. No claims of novelty or importance that the paper does not demonstrate.
- Strength of claim matches the evidence: "improves" needs a ledger result; "significantly" needs a recorded test.
- No signposting that restates the section title ("In this section we describe...") unless the author's samples do it.
- No lists of three adjectives, no inflated verbs ("leverage", "delve", "showcase"), no "It is worth noting that".
- Figures and tables are referenced in the text before they appear, and every one is discussed.

## LaTeX

- Citations with the commands recorded for the template in `brief.md`; if none is recorded, the style in `voice-dna.md` (default `\cite{}`). Keys from `references.bib` only.
- Non-breaking space before `\cite` and `\ref`.
- Numbers exactly as in the ledger; do not change precision.
- New macros go in `main.tex`, not in section files.
