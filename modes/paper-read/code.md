# Mode: code — the official repo

Writes `code.md`: how the code at the pinned commit (`source/code/`, commit in `meta.yml`) implements the paper. Never runs it.

## Steps

1. **Layout**: read the README, the package structure, the entry points and the configs. A short tree with one line per important module.
2. **Paper concept → code**: for every definition, equation (E-numbers from `equations.md` if it exists), operator, loss, model component and training step the paper describes, find where it is implemented. One table row each, with the paper location, `path:line` and whether it matches.
3. **Where code and paper differ**: defaults that differ from the paper's stated values, extra terms, things the paper describes that the code lacks, and code features the paper does not mention.
4. **Documentation**: if `links.docs` is set, fetch the pages that explain the core concepts and the API, and note where they add to or disagree with the paper, citing each as `(external: url)`. The docs describe the current version; say so if the pinned commit may differ.
5. **How to run it**: the documented install and the example commands, from the README or docs only. Do not run anything.
6. If `extends:` names a paper whose code is also in the library, add a section **Relative to {key}**: which modules are reused, wrapped, or changed.

Every `path:line` is checked by `check-library.mjs`; line numbers refer to the pinned commit.
