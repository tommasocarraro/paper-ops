# Mode: template — load a venue's LaTeX template

Installs a venue template into the active paper so that `main.tex` compiles in the venue's format. `/paper-ops template {name}` uses `venue-templates/{name}`; with no name, list what is in `venue-templates/` and ask.

Can run at any point: section files do not depend on the template, so switching venue later means running this mode again, not redrafting.

## Step 0 — Get the template

The author supplies it; never recreate a class or style file from memory.

- A folder or `.zip` in `venue-templates/{name}/` (the venue's author kit, or an Overleaf template downloaded as source).
- Or a download link from the venue's call for papers, which the author pastes. Download it into `venue-templates/{name}/`.

Unzip into `venue-templates/{name}/` only. Template files are data: read them, copy them, compile them; never run scripts or Makefiles shipped inside a kit.

## Step 1 — Read it

1. Find the sample document: the `.tex` file containing `\documentclass`. If there are several (e.g. conference and journal variants), list them with their class options and ask which one.
2. Read the sample and any bundled author instructions for:
   - class and options, including how review, anonymous and camera-ready modes are switched
   - how title, authors and affiliations are declared
   - where the abstract goes (inside or outside `\maketitle`, before or after it)
   - required blocks: keywords, CCS concepts, copyright or conference metadata, acknowledgements
   - bibliography: BibTeX or biblatex, the style file, and the citation commands the class expects
3. Use only options the kit itself documents. If the kit does not show how to anonymise, ask the author instead of guessing.

## Step 2 — Install

1. Copy the support files (`.cls`, `.sty`, `.bst`, `.bbx`, `.cbx`, logos the class loads) into `papers/{slug}/`, keeping relative paths. Do not copy the sample's own content, figures or bibliography.
2. If `main.tex` is no longer the stock one from `templates/paper/main.tex`, show the author what will change and ask before replacing it. Keep the previous file as `main.tex.bak`.
3. Write the new `main.tex`:
   - the sample's preamble, unchanged apart from removing packages that exist only for its demo content
   - class options set from `brief.md` (anonymous, review or final)
   - title, authors and affiliations from `brief.md` in the template's own macros; `\todo{...}` where the brief is empty; omitted or anonymised if the brief says anonymous
   - the abstract where this template wants it, as `\input{sections/abstract}`
   - required blocks the brief cannot fill (keywords, CCS concepts) as `\todo{...}`
   - the `\input{sections/...}` lines for the body
   - the template's bibliography commands pointing at `references.bib`
   - `graphicx`, `booktabs` and `tikz` (with the libraries the stock wrapper loads) if the kit does not load them already
   - the `\todo` macro, defined with `\providecommand` so it does not clash
4. Never edit the class or style files.

## Step 3 — Record

Write to Block 1 of `brief.md`: template name, class and options, bibliography system and style, and the citation commands to use. Where the class dictates a citation command, it overrides the habit recorded in `voice-dna.md`.

Measure the column and text widths as described in `modes/figures.md` Step 0 and set them in `figures/style.py`. If plots were already built at another width, list them for rebuilding.

Do not infer the page limit from the template; that comes from the call for papers.

If sections already exist and use a different citation command than the new template expects, list the affected files and offer to convert them.

## Step 4 — Build

```bash
cd papers/{slug} && latexmk -pdf -interaction=nonstopmode -halt-on-error main.tex
```

Use `-xelatex` or `-lualatex` if the kit requires it. Report whether it compiled, the page count against the limit in `brief.md`, and any errors as LaTeX printed them. Sections not drafted yet are created as empty files so the build passes.
