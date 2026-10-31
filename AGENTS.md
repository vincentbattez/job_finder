# AGENTS.md

## Coding standards

Before writing or reviewing code, read `CODING_STANDARDS.md`.

Everything is in English (code, docs, commits, issues), with the vocabulary of `GLOSSARY.md`; user-facing copy goes only through i18next and its FR/EN resources. See the Code section of `CODING_STANDARDS.md`.

### Coding when no spec

When I ask for a code change outside `/implement-spec`, keep that workflow's discipline, scaled to the change: load the `domain-modeling` and `tdd` skills to start; when finished, run `code-review` with my request as the spec, fix what it raises, then `commit`.

## Agent skills

### Issue tracker

Issues live in GitHub Issues (`vincentbattez/job_finder`, via `gh`), with no labels at all. Read `docs/agents/issue-tracker.md` before creating any issue.

### Triage labels

None: this repo uses no labels. Triage state lives in open/closed status and the assignee. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Database access

The live database is `data/job_finder.sqlite`; query it directly with `sqlite3`. Writes are allowed for data fixes, after a backup copy of the file.
