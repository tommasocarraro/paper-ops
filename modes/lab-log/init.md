# Mode: init — create a project

1. Take the name from the argument; if absent, ask for a short kebab-case name.
2. If `projects/{name}/` exists, stop and say so. Never overwrite a project.
3. Copy `templates/project/` to `projects/{name}/`.
4. Ask in one block, then write the answers to `project.yml`:
   - one line on what the project is trying to find out
   - the start date (offer today)
   - the code repo(s) where experiments run: a short name and the absolute path for each. If the session is running inside a git repo, offer its path.
5. Check each repo path exists and is a git repository (`git -C {path} rev-parse HEAD`). Report any that is not; do not guess another path.
6. Tell the author:
   - the log is the project's changelog: every experiment, research question, dataset, decision and piece of work gets an entry
   - a good first step is `question new` for each research question the project starts with
   - entries are written by `question`, `record`, `decide` and `note`, or by `ingest` from summaries dropped in `projects/{name}/inbox/`
   - to log from a session in the code repo, the skill must be installed at user level once: `ln -s {ROOT}/.claude/skills/lab-log ~/.claude/skills/lab-log`
   - optionally, one line in the code repo's `CLAUDE.md` makes Claude offer to record without being asked: `After running an experiment, offer /lab-log record.`
