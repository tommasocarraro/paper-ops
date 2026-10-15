# Mode: new — create a paper folder

1. Take the slug from the argument; if absent, ask for a short kebab-case name.
2. If `papers/{slug}/` exists, stop and say so. Never overwrite a paper folder.
3. Copy `templates/paper/` to `papers/{slug}/`.
4. If `projects/` holds any project, ask which one this paper comes from (or none) and write it to `paper.yml` as `project:`. One project per paper.
5. If `config/profile.yml` is missing, copy `config/profile.example.yml` to it and ask for name, affiliation and email once.
6. Tell the author to put the documentation in `papers/{slug}/source/` (PDF, markdown, notebooks, figures, result tables) and then run `intake`. If the paper has a project, its log is read too, so documentation already in the log need not be copied into `source/`.
