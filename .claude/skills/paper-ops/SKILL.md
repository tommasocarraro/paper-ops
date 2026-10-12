---
name: paper-ops
description: >-
  Research paper writing pipeline -- capture the author's writing style from
  past papers, extract a claims ledger from project documentation, build
  Related Work from supplied links, outline, draft and review a paper. Use when
  the user wants to write, outline, draft or review a research paper, build a
  related-work section, or run any paper-ops mode.
arguments: mode
user-invocable: true
argument-hint: "[style | new | intake | brief | template | related | outline | figures | draft | review] [paper-slug]"
---

# paper-ops -- Router

## Project Root Resolution

Derive `PROJECT_ROOT` from this `SKILL.md`: walk upward until the nearest directory containing both `AGENTS.md` and `modes/`. Resolve every path against it.

## Mode Routing

| Input | Mode file |
|-------|-----------|
| (empty) | discovery: show the menu and the status below |
| `style` | `modes/style.md` |
| `new {slug}` | `modes/new.md` |
| `intake` | `modes/intake.md` |
| `brief` | `modes/brief.md` |
| `template [name]` | `modes/template.md` |
| `related` | `modes/related.md` |
| `outline` | `modes/outline.md` |
| `figures [name]` | `modes/figures.md` |
| `draft [section]` | `modes/draft.md` |
| `review` | `modes/review.md` |

## Active paper

Modes other than `style` and `new` act on one paper. Resolve it as: the slug given as the second argument; else the only folder in `papers/`; else ask which one.

## Context Loading

Before executing any mode, read in this order:

1. `modes/_shared.md`
2. `modes/_custom.md` if it exists (house rules; may override workflow and style defaults, never adds facts)
3. `config/profile.yml` if it exists
4. `modes/{mode}.md`

Modes that produce paper prose (`related`, `figures` for captions, `draft`) and `review` also read `modes/_writing.md` and `voice-dna.md`.

## Discovery (no arguments)

Show the menu, then a status line per paper built from which files exist:

```
paper-ops

  /paper-ops style     → Capture your writing style from writing-samples/
  /paper-ops new       → Create a paper folder
  /paper-ops intake    → Extract the claims ledger from source/
  /paper-ops brief     → The decisions only you can make (venue, story, scope)
  /paper-ops template  → Install a venue's LaTeX template from venue-templates/
  /paper-ops related   → Fetch your links, build references.bib and Related Work
  /paper-ops outline   → Section plan mapped to facts and citations
  /paper-ops figures   → Build plots, diagrams and tables; render and check each one
  /paper-ops draft     → Write sections in your voice
  /paper-ops review    → Reviewer simulation + number and citation checks

Voice: {voice-dna.md present | missing — run style}
{slug}: source ✓ · facts ✓ · brief ✗ · template generic · refs 0 · outline ✗ · figures 0/5 · sections 0/8 → next: brief
```
