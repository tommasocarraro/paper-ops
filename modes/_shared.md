# Shared rules -- all modes

`AGENTS.md` holds the binding rules (Source-of-Truth Boundary, Citation Integrity, Confidentiality). This file adds the working conventions every mode uses.

## Gates

Each mode checks its prerequisites first and stops with the name of the mode to run if one is missing. Never work around a missing prerequisite by inferring its content.

| Mode | Requires |
|------|----------|
| `intake` | at least one file in `source/` |
| `brief` | `facts.md` |
| `template` | a kit in `venue-templates/` or a download link from the author |
| `related` | `links.md` with at least one link; `brief.md` |
| `outline` | `facts.md`, `brief.md` |
| `figures` | at least one row in `figures/figures.md` |
| `draft` | approved `outline.md`, `voice-dna.md` |
| `review` | at least one file in `sections/` |

If `voice-dna.md` is missing at `draft` time, say so once and offer `style`. If the author declines, draft in a plain academic register and say the voice was not applied.

## Asking the author

- Propose, then ask. Where the source material suggests options, list them and let the author pick or write their own, instead of asking an open question.
- Ask one block of related questions at a time and wait for the answers.
- Record every answer in `brief.md` the moment it is given, so a later session does not ask again.
- Only ask what the files cannot answer. If `brief.md` or `config/profile.yml` already holds the answer, use it.

## Placeholders

Anything the paper needs that the ledger does not hold is written as `\todo{what is missing}`, never as plausible text. List all open `\todo` items at the end of every `draft` and `review` run.

## Traceability in LaTeX

- End each paragraph that states ledger content with a comment naming its facts: `% facts: F012, F031`.
- These comments are for the author and for `review`; they do not appear in the PDF.

## Language

Write the paper in English with the spelling variant set in `config/profile.yml` (`writing.english`). Talk to the author in the language they use.
