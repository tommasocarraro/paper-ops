# Mode: equations — why each formula is there

The deep pass: for each key equation (or the one the author asks about), enough explanation that the author never has to reverse-engineer it again. Writes `equations.md`.

## Which equations

All the ones listed under "Key equations" in `card.md`, or the one named (`E3`, `Eq. 7`, or the author pasting it). An equation the card does not list but the author asks about gets added to the card.

## For each equation

Use the block format in `templates/library/equations.md`:

1. **Copy it from the LaTeX source unchanged** (with `source: pdf`, from the page image, and say it was transcribed). `check-library.mjs` warns when a block is not verbatim.
2. **In words**: one or two sentences a reader could say aloud.
3. **Terms**: every symbol, with its meaning and shape, consistent with `notation.md`. Resolve macros the authors defined in the preamble.
4. **Why it is there**: first what the authors say (with location: often the paragraph before or after, a footnote, or an appendix); then, labelled `(interpretation)`, what role it plays if they do not say. If it comes from earlier work, follow the citation: fetch that paper's abstract or relevant section and cite it as `(external: url)`.
5. **Derivation or intuition**, labelled `(derivation)`: the steps from the paper's previous equations, a limiting case, a tiny numeric example with made-up values that are clearly marked as such, or what happens if a term is removed.
6. **In the code**: where it is computed (`path:line` at the pinned commit), and whether the code matches. Differences (a stabilising epsilon, a different normalisation, an operator replaced) are recorded here and in `code.md`; they are often the answer to "why does my reimplementation not match".
7. **Open points**: what remains unclear after all of the above. Do not paper over it.

## Web search

Use it to find where a formula originates or how others explain it. Queries use the paper's terms only, never the author's project. Cite every page used.

## After

Run `check-library.mjs`. Show the author the equations they asked about, in chat as well, and ask whether any step is still unclear; append the follow-up to `qa.md` if it does not fit the block.
