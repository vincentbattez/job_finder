# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues in `vincentbattez/job_finder`. Use the `gh` CLI for all operations.

## No labels

This repo uses **no labels at all**: no triage labels, no type labels, no `wayfinder:*` labels.
Never pass `--label` / `--add-label`, and never create labels. Where a skill asks for a label,
use the substitute given below (title prefix, assignee, open/closed state) or skip it.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments with `jq`.
- **List issues**: `gh issue list --state open --json number,title,body,comments --jq '[.[] | {number, title, body, comments: [.comments[].body]}]'` with the appropriate `--state` filter.
- **Make an issue a sub-issue of a parent**: `gh issue create --parent <parent> ...`, or `gh issue edit <parent> --add-sub-issue <child>` afterwards (`gh` 2.94+). Older `gh`: `gh api --method POST repos/<owner>/<repo>/issues/<parent>/sub_issues -F sub_issue_id=<child-db-id>` (database id, as in **Blocking** below). Without sub-issues, put `Part of #<parent>` at the top of the child body.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v`; `gh` does this automatically when run inside a clone.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

When set to `yes`, PRs run through the same states as issues, using the `gh pr` equivalents:

- **Read a PR**: `gh pr view <number> --comments` and `gh pr diff <number>` for the diff.
- **List external PRs for triage**: `gh api --paginate 'repos/{owner}/{repo}/pulls?state=open' --jq '.[] | select(.author_association | IN("OWNER","MEMBER","COLLABORATOR") | not) | {number, title, author: .user.login, author_association}'`.
- **Comment / close**: `gh pr comment`, `gh pr close`.

GitHub shares one number space across issues and PRs, so a bare `#42` may be either: resolve with `gh pr view 42` and fall back to `gh issue view 42`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue whose title starts with `[Map] `, holding the Notes / Decisions-so-far / Fog body.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue (see **Make an issue a sub-issue of a parent**). Where sub-issues aren't enabled, add the child to a task list in the map body and put `Part of #<map>` at the top of the child body. The ticket type goes in a title prefix instead of a label: `[research]`, `[prototype]`, `[grilling]` or `[task]`. Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: GitHub's **native issue dependencies**, the canonical, UI-visible representation. Add an edge with `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where `<blocker-db-id>` is the blocker's numeric **database id** (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`, _not_ the `#number` or `node_id`). GitHub reports `issue_dependencies_summary.blocked_by` (open blockers only, the live gate). Where dependencies aren't available, fall back to a `Blocked by: #<n>, #<n>` line at the top of the child body. A ticket is unblocked when every blocker is closed.
- **Frontier query**: list the map's open children (`gh issue list --state open`, scoped to the map's sub-issues / task list), drop any with an open blocker (`issue_dependencies_summary.blocked_by > 0`, or an open issue in the `Blocked by` line) or an assignee; first in map order wins.
- **Claim**: `gh issue edit <n> --add-assignee @me`, the session's first write.
- **Resolve**: `gh issue comment <n> --body "<answer>"`, then `gh issue close <n>`, then append a context pointer (gist + link) to the map's Decisions-so-far.

## Mirror new work to Things 3

New work created for this repo is also mirrored as a task in the user's Things 3 to-do list,
using the `things3` skill (`things` CLI). Do it in the same run, right after the issue is
created.

The point is that nothing gets forgotten: everything the user has to do surfaces in Things 3.
Only the parent surfaces there — never the details.

**Mirror the root of a work item, never its children.** A feature broken into 10
implementation tickets stays a single Things task, the one named after the feature.

- A spec, feature, or parent issue is published (`/to-spec`) → create the task.
- A standalone issue with no parent — feature, bug, chore, whatever it is → create the task.
- Children — `/to-tickets` slices, sub-issues, any ticket under a spec → create nothing. The
  parent already has its task.

Fields:

- **Project**: `💼 New job()` — pass the emoji, it is part of the title.
- **Title**: `[#<number>] <feature in French>` — short and direct (~35 characters total). The
  Things title column is narrow: no trailing punctuation.
- **Notes**: `#<number> — <one-line French summary>` on the first line, the issue URL on the second.
- **Tags**: `--tags="🤖 IA: Ready to auto-implement"` (a Things tag; the "no labels" rule above
  applies to GitHub only)
- **Checklist**: the manual acceptance checks the user will run themselves once the issue is
  done. One `--checklist-item` per check, 3–6 items. See below.

```bash
things add "[#12] Système de notifications" --list "💼 New job()" \
  --tags="🤖 IA: Ready to auto-implement" \
  --notes "#12 — Notifications in-app et système, avec réglages par projet
https://github.com/vincentbattez/job_finder/issues/12" \
  --checklist-item "Recevoir une notif système avec l'app en arrière-plan" \
  --checklist-item "Couper les notifs d'un projet → plus rien pour ce projet" \
  --checklist-item "Cliquer la notif → ouvre la bonne session"
```

### Checklist: what the user verifies by hand

The task carries a short list of things **the user** checks personally once the issue is closed
— the app-level verification an agent can't do (visual, feel, real data, real device).

- Derive it from the issue's acceptance criteria, one item per observable behaviour.
- Phrase each item as an action with its expected result: "Ouvrir X → Y s'affiche".
- 3–6 items max. Skip anything already covered by an automated test — the point is what only a
  human eye catches.
- Same rule as the task itself: only the root work item gets a checklist, never the children.

Check for an existing task first to avoid duplicates. `--project` requires a `--query`;
`title:/./` is the catch-all:

```bash
things search --query=title:/./ --project="💼 New job()" --select="uuid,title,notes" --json
```

The first result is the project row itself (its title, empty notes), not a duplicate.
