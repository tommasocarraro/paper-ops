# paper-ops

Write a research paper from documentation you already have, in your own voice.

1. Drop papers you wrote without AI into `writing-samples/`, then run `/paper-ops style`.
2. `/paper-ops new my-paper` creates `papers/my-paper/`.
3. Put the project documentation in `papers/my-paper/source/`, then run `/paper-ops intake`.
4. `/paper-ops brief` asks you the decisions only you can make.
5. Put the venue's LaTeX kit in `venue-templates/`, then run `/paper-ops template`.
6. Put your related-work links in `papers/my-paper/links.md`, then run `/paper-ops related`.
7. `/paper-ops outline`, then `/paper-ops figures`, then `/paper-ops draft`, then `/paper-ops review`.

The paper is plain LaTeX in `papers/my-paper/`: one file per section under `sections/`, `main.tex`, `references.bib`. Build it with `latexmk -pdf main.tex` or upload the folder to Overleaf.

Rules the agent follows are in `AGENTS.md`. Your own house rules go in `modes/_custom.md`.
