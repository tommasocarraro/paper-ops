# Mode: meeting — supervisor meetings

A meeting is one `meeting` entry, plus the entries it gives rise to: decisions, new research questions, notes. Two inputs: a report the author wrote, or a recording. The report is always written in English, whatever language was spoken or written.

## The report's shape: `projects/{p}/meeting-template.md`

There is no fixed structure. The shape comes from how the author writes reports:

- **No template yet and the author has written reports** (in `inbox/` or pasted): read them and infer the template: the sections they use and in what order, how much detail goes in each, whether they write bullets or prose, how they phrase action items. Write it as a short file: one `## ` heading per section, each followed by one line saying what goes there. Show it; the author edits or approves; save it.
- **No template and no written report yet:** start from `## Discussed`, `## Feedback`, `## Decisions`, `## Action items`, and replace it with an inferred one once the author has written a report or two.
- **Template exists:** follow it, but loosely. Skip sections the meeting did not touch; add one when something does not fit. If the author's reports drift from the template, offer to update it.

Whatever the template says, two things are not optional because other modes depend on them:

```yaml
actions:                  # every action item, also listed in the body as the template prefers
  - id: L040-A1           # {this entry's ID}-A{n}
    what: Rerun the sweep with three seeds
    who: author
    due: 2026-10-27       # only if one was said
resolves: [L031-A2]       # action items from earlier meetings this meeting closed (done or dropped; the body says which)
```

## Before the meeting (offered, not required)

`digest last-meeting` prepares it: what was done since the last meeting, open action items, stuck research questions. Ask the author what they want to raise and add it as an agenda.

## Path A — a written report

1. Read it (in `inbox/` or pasted). It may be in Italian or English, in any shape.
2. Write the entry in the template's shape, in English, keeping the author's content and strength of claim. Translation is faithful: no smoothing a "maybe" into a plan.
3. `provenance: stated`, `source: inbox/done/{file}` if it came from a file. Move the file to `inbox/done/` afterwards.

## Path B — a recording

1. **Consent.** The first time, remind the author once that the supervisor should agree to the recording. Do not repeat it at every meeting.
2. Assign the entry ID, then transcribe locally in the background. It takes roughly as long as the recording or longer on CPU:
   ```bash
   .venv/bin/python -I $ROOT/transcribe.py {audio} --out projects/{p}/log/artifacts/L0xx/ --language it
   ```
   Never send audio or transcript to any online service, transcription API or translator.
3. Read `transcript.it.txt`. The Italian transcript is the record; the report is written from it in English.
4. Every decision, feedback item and action item in the report ends with the timestamp it comes from: `[12:40]`.
5. **Who said what.** The transcript does not separate speakers. Infer from context, but mark every inferred attribution `(inferred)`; a suggestion from the supervisor and a choice by the author must never be confused.
6. **Unsure passages.** Segments marked `[?]`, technical terms, names and numbers heard in speech: copy what the transcript says, flag them `(unclear [mm:ss])`, and ask. Never guess a term from context.
7. `provenance: transcribed`, `source:` the audio file name. Show the report and the list of inferred attributions and unclear passages in one block; apply the author's corrections, remove the `(inferred)` marks they confirmed, then set `speakers_confirmed: true`. `check-log.mjs` will not pass a settled transcribed entry without it.
8. Ask what to do with the audio: keep it (moved to `inbox/done/`) or delete it. Do neither without the answer. If the author gives a standing answer, record it in `project.yml` as `meetings: {keep_audio: true|false}` and stop asking.

## After either path

Go through the report and offer, one block:

```text
From this meeting:
  Decisions → decision entries?     1. Use three seeds from now on [08:15]   2. …
  Suggestions not (yet) adopted:    keep in the report only, or decide now?
  New research questions?           "is the gain explained by query length?" [31:02] → question new?
  Action items closed:              L031-A2 (rerun done in L047) → resolves
  Open action items still open:     L031-A1 (ablation, due 2026-10-20, overdue)
```

- **A supervisor suggestion is not a decision.** It becomes a `decision` entry only if the author adopts it, and the Why says it came from the meeting (`related: [L0xx]`).
- New questions go through `question new`; never open one from a meeting alone.
- Numbers said in a meeting are not results. They stay in the report with their timestamp, and never reach a paper through it; a result needs its own entry with a file pointer.

Write the entry with `type: meeting`, `status: done`, `attendees: [...]`, `actions:`, `resolves:`; any decisions as their own entries; run `check-log.mjs`; seal once the author approves.
