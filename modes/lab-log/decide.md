# Mode: decide — record a decision

A short decision record: the context, the options, the choice and why. These entries become the methods section and the answers to reviewers months later, so the Why is the part that matters.

## Step 1 — Draft from the conversation

Propose the entry from what was discussed:

```text
L0xx · Decision: {title}
Context:      {the situation that forced a choice; entries that led here}
Options:      1. {option} — {for / against, as discussed}
              2. {option} — {…}
Decision:     {the option chosen}
Why:          {the author's reasons}
Consequences: {what this commits the project to; what it rules out}
Revisit if:   {what would reopen it, if the author has a view}
```

Only options that were actually considered go in the list. If the conversation did not discuss alternatives, ask the author which ones they weighed; do not supply the usual alternatives from the field.

## Step 2 — Confirm the Why

Ask the author to confirm or rewrite **Why** in their own words. Reasons Claude offered during the discussion stay only if the author adopts them.

## Step 3 — Write

`type: decision`, `status: done`, `provenance: stated`, `date:` the day the decision was taken (ask if it was not today), `related:` the entries that informed it. Run `check-log.mjs`, then seal.

If the decision replaces an earlier one, set `supersedes:` to it and say in Context what changed.
