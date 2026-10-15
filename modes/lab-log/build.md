# Mode: build — the logbook PDF

1. Run `node $ROOT/check-log.mjs projects/{p}` and report its output. Errors do not block the build, but say that the PDF reflects a log that fails its checks.
2. Run `node $ROOT/build-log.mjs projects/{p} --pdf`. It writes `build/changelog.md` (one line per entry since the start of the project), `build/logbook.tex` and `build/logbook.pdf`: the research questions as they stand with their evidence and history, an index by type and by tag, then each entry in date order with its metadata, body, the plots in its snapshot, and files recorded by hash only. Invalidated entries carry a red notice naming the entry responsible.
3. If latexmk fails, read `build/logbook.log` and fix the cause in `build-log.mjs`'s input: usually an entry's markdown outside the supported subset (see the script header). Never edit `logbook.tex` by hand, and never edit a sealed entry to make it build; report it instead.
4. Render the first entry pages (`pdftoppm -png -r 80 -f 1 -l 4 build/logbook.pdf`) and look at them: tables cut off, missing images, `?` where a character could not be set. Report what you see.
5. Give the author the PDF path.
