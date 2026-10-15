# Mode: note — design, dataset, bug, dead-end, finding, work

For entries that are not an experiment run or a decision. Take the type from the argument; if absent, propose one from the conversation.

| Type | Use for | Watch for |
|------|---------|-----------|
| `design` | A component or the architecture is defined or changed | Alternatives: only those actually considered |
| `dataset` | Data obtained, filtered, split, versioned or changed | Every statistic with a pointer: the file or script output it comes from, or `(author, {date})`. Processing steps in order, with the script and commit that ran them |
| `bug` | A bug that affected results | `affects:` lists every entry whose results it invalidates; ask the author to confirm the list. `Rerun needed` names which runs must be repeated. Offer `record` for each rerun later |
| `dead-end` | An approach given up after one or more entries | `What was tried` cites the entries; `Why it was dropped` is the author's reason; `What would change that` keeps the door open honestly |
| `finding` | Something learned from a paper, a reproduction or an analysis | `paper:` set to `library/{key}` when it comes from a paper; `Source` says where exactly (section, equation, table, or entry IDs) |
| `work` | Anything done that fits no other type: code written, a refactor, a meeting that changed direction | Short. Decisions taken in it get their own `decision` entries |

Any of these can carry `evidence:` when it bears on a research question (a `dataset` entry that changes what an RQ can test, a `finding` that contradicts a hypothesis). The stance is the author's.

Steps:

1. Draft the entry from the conversation in the type's sections and show it.
2. Ask for whatever the sections need that the conversation did not give. Unknowns stay `not recorded`.
3. Write it with `provenance: stated` (or `recorded` when Claude observed it, e.g. a bug found while running code together) and the right `status`.
4. Run `check-log.mjs`; seal once settled.

A `bug` entry marks its `affects:` entries as invalid in the build, the digest, and in `paper-ops intake`, without editing them.
