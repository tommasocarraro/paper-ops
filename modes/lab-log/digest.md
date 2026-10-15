# Mode: digest — what happened since a date

A short summary for the author or a supervisor meeting. Reads the log only.

## Step 1 — Range

`since` from the argument (a date, `7d`, `2w`, or `last-meeting`: the day after the most recent `meeting` entry); default: 7 days ago, or the day after the last file in `digests/` if that is more recent. The range covers entries whose `date` falls in it, plus entries still `planned` or `running` from any date.

## Step 2 — Read

Run `node $ROOT/check-log.mjs projects/{p} --json` for status and invalidations, then read every entry in range.

## Step 3 — Write

`digests/{today}.md`, and show it in chat. At most a page. Every line ends with the entry IDs it summarises; nothing is stated that the entries do not say.

```markdown
# {project} · {since} → {today}

## Research questions
- RQ{n} {short title}: {opened | revised | answered | …} this period; new evidence {L0xx supports, L0yy inconclusive}; {status now} (L0xx)

## Results
- {one line per experiment: question, outcome in the entry's own strength of claim, key number with its metric, research question it served} (L0xx)

## Decisions
- {decision}: {one-line why} (L0xx)

## Dead ends and failed runs
- … (L0xx)

## Bugs
- {bug}; invalidates L0xx, L0yy; rerun {done in L0zz | still needed} (L0xx)

## Datasets, design and other work
- … (L0xx)

## Still open
- {planned and running entries, with how long they have been open} (L0xx)
- {open research questions with no entry serving them}

## Action items
- {open ones, overdue first: id, who, due, what} · {closed this period, and by which entry}

## Questions waiting for the author
- {entries with `not recorded` fields, unsealed settled entries, unprocessed inbox files}
```

With `last-meeting`, the digest is meeting prep: add `## To raise` at the end and ask the author what goes in it.

Omit empty headings. Do not add recommendations or next steps the entries do not contain; if the author wants them, offer separately and label them as suggestions.
