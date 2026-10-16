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

## Reading papers

`/paper-read` turns a paper into notes you can rely on later, in `library/{key}/`, shared across projects.

1. `/paper-read add {arxiv-or-doi-link}` fetches the metadata, the LaTeX source, the PDF and (with the code repo's link) the official code at a pinned commit, and writes a one-page card.
2. `/paper-read read` writes section notes, a notation table and the experimental setup (with what the paper leaves unspecified), then re-checks them against the paper.
3. `/paper-read equations` explains each key formula: what every term is, why it is there, how it is derived, and where the code computes it.
4. `/paper-read ask {question}` answers anything about the paper, saying where each statement comes from (the paper, the code, a derivation, the web), and keeps the answer in `qa.md`.
5. `/paper-read code` maps the repo; `/paper-read compare` relates the paper to one of your projects.

`node check-library.mjs library` checks that every note points to the paper and every number in it occurs in the paper.

## Project logbook

`/lab-log` keeps the changelog of the project behind the paper, from the first day: research questions, experiments, decisions, design, datasets, bugs, dead ends, findings and other work, one markdown entry each in `projects/{name}/log/`. Each research question also has a file, `projects/{name}/questions/RQ{n}.md`, holding its current version; every change to it is logged, and its evidence is collected from the entries that point to it.

1. `/lab-log init my-project` creates `projects/my-project/` and asks where your code repo is.
2. To log from a Claude session in the code repo, install the skill at user level once: `ln -s "$PWD/.claude/skills/lab-log" ~/.claude/skills/lab-log`.
3. `/lab-log question new` for each research question; `/lab-log record` around an experiment, `/lab-log decide` for a decision, `/lab-log note bug` (or `design`, `dataset`, `dead-end`, `finding`, `work`) for the rest.
4. Experiments you ran alone: drop your summaries in `projects/my-project/inbox/` and run `/lab-log ingest`.
5. `/lab-log meeting` after a supervisor meeting: give it your written report, or a recording (transcribed locally; install once with `.venv/bin/pip install faster-whisper`). The report is written in English, in the shape of your own past reports, and action items are tracked until closed. `/lab-log digest last-meeting` prepares the next one.
6. `/lab-log digest` for the last week, `/lab-log build` for the PDF and a one-line-per-entry changelog (`projects/my-project/build/`).

A paper created with `/paper-ops new` can name the project, and `intake` then reads the log as well as `source/`.

Rules the agent follows are in `AGENTS.md`. Your own house rules go in `modes/_custom.md`.
