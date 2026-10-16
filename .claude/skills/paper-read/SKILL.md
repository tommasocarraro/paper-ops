---
name: paper-read
description: >-
  Read and understand research papers -- fetch a paper with its LaTeX source
  and official code, write a one-page card, section notes, a notation table,
  the experimental setup, deep explanations of equations mapped to the code,
  a repo map, and answers to questions, all pointing back to the paper and
  verified against it; compare a paper with a project. Use when the user wants
  to read, summarise or understand a paper, asks why a formula is there or
  what the authors mean, wants a paper's setup or code explained, or wants to
  know how a paper relates to their project.
arguments: mode
user-invocable: true
argument-hint: "[add | read | equations | code | ask | compare] [paper-key]"
---

# paper-read -- Router

## Project Root Resolution

Derive `ROOT` from the **real path** of this `SKILL.md` (`realpath`), walking upward until the nearest directory containing both `AGENTS.md` and `modes/`. Resolve every path below against `ROOT`, and run its scripts as `node $ROOT/{script}.mjs`.

## Mode Routing

| Input | Mode file |
|-------|-----------|
| (empty) | status: see below |
| `add {link}` | `modes/paper-read/add.md` |
| `read [key]` | `modes/paper-read/read.md` |
| `equations [key] [E{n} or Eq. n]` | `modes/paper-read/equations.md` |
| `code [key]` | `modes/paper-read/code.md` |
| `ask [key] {question}` | `modes/paper-read/ask.md` |
| `compare [key] [project]` | `modes/paper-read/compare.md` |

A question about a paper with no mode named is `ask`.

## Active paper

Resolve it as: the key given; else the paper the conversation is about; else the only paper in `library/`; else show `library/index.md` and ask.

## Context Loading

Before executing any mode, read in this order:

1. `modes/paper-read/_shared.md`
2. `modes/_custom.md` if it exists
3. `modes/paper-read/{mode}.md`

## Status (no arguments)

Run `node $ROOT/check-library.mjs library` and show `library/index.md` with the check's result per paper, then:

```
  /paper-read add {link}   → Fetch a paper (and its code) into the library
  /paper-read read         → Card, notes, notation, setup; verified against the paper
  /paper-read equations    → Every key equation explained and mapped to the code
  /paper-read code         → Map of the official repo: paper concept → code
  /paper-read ask          → Any question about a paper, answered with sources
  /paper-read compare      → How a paper relates to one of your projects
```
