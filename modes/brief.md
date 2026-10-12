# Mode: brief — the decisions only the author can make

The equivalent of the cover-letter prompts in career-ops: the ledger says what happened, the brief says what paper to write from it. Nothing is drafted until `brief.md` is complete.

Work through the blocks in order, one block per message. In every block, **propose options drawn from `facts.md` and let the author pick or write their own**. Write each answer to `brief.md` as soon as it is given. Skip any question `brief.md` or `config/profile.yml` already answers.

> DRAFT — the question set below is under discussion with the author and will change.

## Block 1 — Target

```text
1. Venue and track? (conference/journal, main/short/industry/workshop)
2. Deadline?
3. Page limit? (I will not guess a venue's rules; paste them or give me the call-for-papers link)
4. LaTeX template? Put the venue's author kit in venue-templates/ (or paste its download link) and I will install it with the `template` mode. Until then the paper builds with a generic article class.
5. Anonymous submission? (yes → I remove names, affiliations and self-identifying citations)
6. Does the venue have a policy on AI-assisted writing that needs a disclosure statement?
```

## Block 2 — Story

The source is a project log, not an argument. Offer framings the ledger can support:

```text
A. What is the one-sentence claim of this paper?
   Framings the documentation supports — pick one or write your own:
     1. {framing built from the strongest positive result}
     2. {framing built from the method as the contribution}
     3. {framing built from a negative or surprising finding}
     4. {framing built from where the documentation says the project is heading}

B. Contributions — pick two to four, or rewrite:
     • {candidate, with the fact IDs behind it}
     • ...

C. Who is the reader, and what do they believe before reading that this paper changes?

D. Research questions, if you state them explicitly: {candidates}
```

Never propose a framing the ledger cannot support. Next to each option, name the fact IDs it rests on.

## Block 3 — Scope

```text
Every experiment and result I found. Mark each: main / appendix / omit
  [ ] {experiment} — {one-line result} (F0xx)
  ...

Abandoned approaches and negative results. Mark each: report / mention briefly / omit
  [ ] {approach} — {what happened} (F0xx)
```

## Block 4 — Weaknesses

For each limitation the documentation itself admits, and each gap `intake` listed, ask directly. Do not choose for the author:

```text
[Weakness: {stated in the source, F0xx}]
  a) Address it openly in a Limitations paragraph
  b) Fix it — you will run something new and give me the result
  c) Reframe the claim so it no longer applies (tell me how)
  d) Leave it out

[Missing: {item a reviewer will expect}]
  a) You provide it now
  b) Leave a \todo and decide later
  c) The paper goes without it
```

## Block 5 — Confidentiality

```text
Has the employer or data owner cleared this work for publication? (yes / in progress / not asked)

Sensitive items found in the source. For each: name it / anonymise as … / relative numbers only / omit
  [ ] {company name}
  [ ] {dataset or internal system name}
  [ ] {absolute figures: users, traffic, revenue}
  [ ] {names of colleagues}
```

If clearance is "not asked", say once that drafting can proceed but the paper should not leave the machine until it is settled.

## Block 6 — Positioning

Needs `links.md`. If it is empty, ask for the links first (grouped by theme if the author can).

```text
For each group of related work:
  • In one sentence, how does your work differ from this group?
Which single paper is closest to yours, and what do you do that it does not?
Any work you want cited that you have no link for? (I can only cite what I can fetch)
```

## Block 7 — Form

```text
Authors, order and affiliations?
Terminology — the documentation uses several words for the same thing. Pick one each:
  • {term A} / {term B} / {term C}
Figures and tables: for each one in the inventory — keep / drop, and anything new you want that the documentation does not have
  (how each is built — regenerated, reused as an image, drawn — is worked out by the `figures` mode from what exists)
Do you have result files (CSVs, notebooks, logs) beyond the documentation? If so, put them in source/.
Which figure should open the paper?
Title: three candidates from me after the outline, or do you have one?
```

## Completion

`brief.md` is complete when Blocks 1 to 5 have an answer for every item (an explicit "decide later" counts and becomes a `\todo`). Blocks 6 and 7 can be completed during `related` and `outline`. Summarise the brief in a short list and ask the author to confirm before suggesting the next mode.
