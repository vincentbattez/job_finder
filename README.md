# job_finder

Job Posting watch and Application preparation. Vocabulary: `GLOSSARY.md`. Decisions: `docs/adr/`. Code rules: `CODING_STANDARDS.md`.

## Installation

```bash
mise install                                   # Node 26, lefthook, gitleaks, then npm install (and prisma generate) and the git hooks
mise run init                                  # fills dev-data/ with fake data; the Candidates of data/ are created in the front
jf                                             # shows the help
jf detect                                      # looks for the new Postings of each Watch
jf import offre.md lea                         # imports a Markdown Job Description found elsewhere: the worker extracts its fields with Claude, then queues its Research; --wait waits for the extraction
jf run extraction import-1a2b3c4d5e            # runs the field extraction of an imported Posting again, after a failure
jf list lea                                    # lists a Candidate's Postings, with their Status and the Expired ones
jf apply 2026-2445600                          # makes a Posting Applied, which freezes its Letter for good: Applied is never undone
jf archive 2026-2445600                        # archives a Posting, Applied or not; jf apply makes it Applied again if it was, otherwise jf to-apply makes it To Apply again
jf run research 2026-2445600                   # queues a new Version of a Posting's Research; --wait waits for the worker to produce it
jf run letter 2026-2445600                     # queues a new Version of the Letter, on the Chosen Version of the Research
jf run brief 2026-2445600                      # queues a new Version of the Interview Brief, on the Chosen Research, and the Chosen Letter if there is one
jf run visualization 2026-2445600              # queues a new Version of the Visualization, an HTML page drawn from the Chosen Interview Brief
jf recipients 2026-2445600                     # shows whom to address the application to, according to the Chosen Letter
jf versions 2026-2445600 research              # lists the Versions of an Artifact, each with the origin of its Instructions: default or the Candidate's
jf choose 2026-2445600 research 1              # changes the Chosen Version
jf edit 2026-2445600 research                  # corrects the Chosen Version of an Artifact with Claude Code, except the Visualization, which is run again; with no argument, offers the Postings then the Artifact
jf instructions lea                            # says, for each module, whether the Candidate follows the default Instructions or their own
jf instructions lea letter                     # shows the Instructions the Letter follows; "default" shows the default ones
jf instructions lea letter replace < c.md      # replaces the Letter's Instructions with those of the file; "delete" goes back to the default ones
```

`jf` is on the `PATH` as soon as mise is active in the repo folder.

## Front

The front, lpm service `web` declared in `.lpm.yml` (`mise run web`), serves the Postings of `data/` on port 5180, without authentication: it is only reachable on the LAN and through WireGuard, never from the internet (ADR-0002). It is opened through the Mac mini's IP address or its `.local` name, for example `http://mac-mini-vincent.local:5180`. The Candidate is picked in the top menu, remembered by a cookie; each Posting's page shows its raw contacts, the recipients recommended by the Chosen Letter, the Job Description and every Version of each Artifact, with the `jf edit` command to copy and the Instructions that produced each Version: their origin, and their folded text, to compare two Versions. The Visualization is read there in an isolated frame, which runs no script and loads nothing from outside; it is run again, never edited by hand. The Candidates page creates a Candidate (their name and their id, which names their folder and their `jf` commands), renames them and sets the Default Deadline Period, shared by all; a Candidate cannot be deleted, and any visitor of the front can do all of this (ADR-0011). The Profile page sets the Candidate's Watches, each on a Source, with the form built by that Source's descriptor; a created or changed Watch first imports the Postings already online without starting anything, and a deleted Watch keeps its Postings. It also edits the files of the Candidate's Profile; the Instructions page shows the default Instructions of each module, and creates, edits or deletes the Candidate's own there. The fixed part of the prompts does not appear there: it stays in the code.

On the Posting's page, each Artifact shows its state (missing, running, ready, failed) and its module's button: it queues the job, like `jf run`, and the worker runs it. The button waits as long as the module lacks an input, for example a Chosen Research for the Letter, and says which one. The state updates by itself until the job is done. The Posting list has a "Run a Detection" button, the same action as `jf detect`, which says what it found for each Watch. A Markdown Job Description dropped on the list, or picked with "Import a Job Description", becomes a Posting right away, named after its file, as with `jf import`; its page follows the extraction of its fields by the worker, and runs it again after a failure.

To develop, `mise run web:dev` serves the front of `dev-data/`, the fake Postings of `mise run db:seed`, on port 5181 of this machine only: only the Notification Channels saved in `dev-data/` receive its notifications. `JF_DATA_DIRECTORY` names this folder.

## Worker

Running a module only queues its job. The worker, lpm service `worker` declared in `.lpm.yml` (`mise run worker`), runs the jobs of `data/` one by one, so a single Claude session at a time, in its own process: restarting the front does not cut a session (ADR-0003). A job interrupted by a worker stop becomes "failed" when it restarts, and is run again with `jf run`. A new Posting detected in the Zone queues its Research, except on the first launch.

## Daily Detection

The lpm automation `detect`, declared in `.lpm.yml`, runs `jf detect` every day at 18:00 (ADR-0003). Its run shows "no new Posting" or the list of new Postings. A failed Detection exits with an error: lpm marks the run "needs a look" and notifies. Each Watch has its Zone: a Posting is in the Zone as soon as it is in the Zone of one of its Candidate's Watches. A Posting a Watch recorded outside its Zone is read again once by each of the other Watches of the same Source, and the one that finds it in its Zone places it there; it then gets its Research and its notification, only once, except on that Watch's first launch. `.lpm.yml` is checked with `lpm config validate .lpm.yml`.

## Notifications

The Candidate is notified on their phone:

- of a new Posting in their Zone, with its title, its jurisdiction and its Deadline. Nothing is sent on the first launch, nor when the Detection finds nothing;
- of the Repost of a Posting: in their Zone, naming the Posting it publishes again; whatever the Zone when that Posting was Applied, and no Research is then started;
- of a ready Research, when the worker has produced it.

Each Candidate picks their Notification Channel in the Notifications section of their Profile, among the modules of the family (ADR-0010); the only one today is Home Assistant, which asks for the address of the Home Assistant, a long-lived access token (Home Assistant profile, Security tab) and the phone's `notify.mobile_app_*` service, picked from the list that Home Assistant gives. The form is built from the module's descriptor. The actions list the Channels, read and save the Candidate's, test it, list the choices of a Parameter and send a test notification. A secret Parameter, such as the token, is write-only: no action returns it, only whether it is configured (ADR-0006), and `test/write-only-token.test.ts` checks it for every secret Parameter of every module. Left empty, it keeps the saved one, unless a Parameter entered with it, such as the address, has changed. A backup of `data/` therefore holds a secret. Without a saved Channel, no notification goes out, and the failure says to pick one. A notification that does not go out blocks nothing: the Detection first records every new Posting and queues their Research; `jf detect` then shows what it found, then each unsent notification with what to check, and exits with an error. The worker does not stop: it writes the failure in its log (`lpm logs worker`) and goes on with the queue.

## Data

Everything lives in `data/`, outside git and without backup. A data folder an older jf left in the French layout moves to this one the first time it opens, its config keys included; an entry found in both layouts stops the opening with a message that says what to merge:

- `job_finder.sqlite`: the database, migrated on every launch. It is the source of truth for the Candidates, their Watches, the Default Deadline Period and each Candidate's Notification Channel, secret Parameters included; the front writes them (ADR-0011). The config file that previous versions read is imported only once, on the first launch of a database that does not have its Default Deadline Period yet, then never read again: `jf` reports it on every command as long as it is still there, and so does the Candidates page;
- `candidates/<id>/profile/`: each Candidate's Profile, as Markdown files: `facts.md`, `cv.md` and one `letter-<employer>-<year>.md` per past letter, and their Uploads, the original PDFs, in `uploads/`. `jf profile <candidate>` writes and completes them during an interactive Claude Code session;
- `candidates/<id>/postings/<reference>-<title>/`: one folder per Posting, with its Job Description (`job-description.md`) saved at Detection time, and one folder per Version of each Artifact, for example `research/v2/research.md`. A Version of the Letter (`letter/v<n>/`) holds the Draft (`draft.md`, read-only), the Letter to correct (`letter.md`, first a copy of it) and the recommended recipients (`recipients.json`). A Version of the Interview Brief (`interview_brief/v<n>/interview-brief.md`) starts with a title; its default Instructions organise it into "À réviser", "Moyens mnémotechniques", "Présentez-vous" and "Questions probables", and the Candidate's own can organise it differently. A Version of the Visualization (`visualization/v<n>/visualization.html`) is a standalone HTML page, without script;
- `candidates/<id>/instructions/<artifact>.md`: the Instructions of a module the Candidate replaced, for example `research.md`. Without this file, the module follows its default Instructions.

`dev-data/` has the same shape, with fake Postings for development. Prisma commands and `db:` tasks only touch it.

## Database

The schema is described in `prisma/schema.prisma`, the only source to edit. After a change, `mise run db:migrate` generates the migration in `prisma/migrations/` and applies it to `dev-data/`. A generated migration is not edited by hand, except to copy the data of a table or of columns it replaces, such as `20261030110155_canal_notification` or `20261030112510_veille_parametres`. `jf` applies pending migrations to `data/` on every launch.

## Code

- `src/actions/`: the action layer, the only source of truth of each feature. The CLI and the front only call it (ADR-0003). Tests go through it. `index.ts` (`createActions`) brings together one file per feature: `detect.ts` (the Detection, which reads the Source modules and therefore cannot be a module), `import-job-description.ts`, `status.ts`, `profile.ts`, `facts.ts`, `uploads.ts`, `instructions.ts`, `candidates.ts`, `edition.ts`, `jobs.ts`, `postings.ts`, `watches.ts` and `notification-channel.ts`, on what `context.ts` shares. `modules.ts` is the registry of interchangeable modules: the only file that imports them, and therefore names them (ADR-0010, checked by `test/architecture.test.ts`).
- `src/cli/`: the `jf` CLI, which relays to the actions.
- `src/worker/`: the worker, which also relays to the actions: it drains the job queue. Only it runs the jobs, which `test/architecture.test.ts` checks.
- `src/web/`: the React Router front, which also relays to the actions, opened once for the whole server in `acl/actions.server.ts`. `/design` shows its components with sample Postings. Colours, fonts and spacings are tokens of `src/web/tokens.css`.
- `src/domain/`: the domain types, derived from their Zod schemas. Past the anti-corruption layer, the code only handles them (ADR-0005).
- `src/workspace/`: access to the data folder (database, Candidates' folders). Only its `acl/` folder reads the database, and the config file of a previous version, to import it once; `test/architecture.test.ts` checks that no other file of `src/` names it. The Prisma client is generated in `generated/`, outside git.
- `src/ai-session/`: the launch of AI sessions. Only `acl/claude-code.ts` knows they run on Claude Code, always on the subscription (`claude -p`, with no API key); tests replace it with a fake.
- `src/actions/run-job.ts`: running a job of an AI module: the Version, the two-part prompt (fixed part and Instructions), the check of the produced file and the Chosen Version.
- `src/profile/`: the fixed prompt of `jf profile`, and the Sections of `facts.md` its form shares.
- `src/edit/`: the fixed prompt of `jf edit`, which opens a session in the Posting's folder, with no shell nor web, where no Draft can be changed.
- `src/status/`: the rules of a Posting's Status: the Statuses it can move to, the Expired computation, and the freeze of the Chosen Letter of a Posting that was Applied.
- `src/modules/`: one folder per module, with a single entry point. A module never imports another, which `test/architecture.test.ts` checks. An AI module, such as `research/`, has the fixed part of its prompt in `prompt.ts`, in English, which sets the language of the Artifact: that of the Job Description. Its default Instructions, which the Candidate reads and edits, are in the catalogue, one per locale (`src/domain/catalogue/<locale>/default-instructions.ts`).
- `src/modules/source-import/`: the Markdown Import Source. The import records the Posting and queues the extraction of its fields; the worker runs it like a module, in a headless Claude session with a fixed prompt, which writes `extraction/extraction.json` in the Posting's folder. `acl/extraction.ts` refuses any value the Job Description does not contain verbatim. The fields fill the Posting, whose folder follows the new title, then its Research is queued. The Posting's reference comes from the file's content: importing the same file twice gives the same Posting again, with no new job.
- `src/notification/`: the contract of the Notification Channel family (ADR-0010): the descriptor each module exports (id, display name, Parameters described by a Zod schema, sending, and optionally test and choices of a Parameter), and the text of each notification.
- `src/source/`: the contract of the family of Sources a Watch follows (ADR-0010): the descriptor each module exports (id, display name, Watch Parameters described by a Zod schema, Zone included, search of Postings and reading of the detail page, which says whether the Posting is in the Zone). The `listSources` action gives these descriptors, from which a Watch's form is built.
- `src/parameter/`: the declaration of Parameters, shared by both families: `parameter(schema, { label, placeholder, type, isSecret })`, where `type` is `text`, `url` or `list`, and their reading by each contract (`declareParameters`): their description, from which the front builds the form, and their parsing by the module's schema, whose error names the refused Parameters by their label.
- `src/modules/source-pep/`: the PEP Source, Place de l'Emploi Public (ADR-0001). Only its `acl/talent-soft.ts` reads the site. Adding a Source is a `src/modules/source-<name>/` folder and a line in `src/actions/modules.ts`.
- `src/modules/notification-home-assistant/`: the Home Assistant Channel. Only its `acl/home-assistant.ts` knows how to call Home Assistant. Adding a Channel is a `src/modules/notification-<name>/` folder and a line in `src/actions/modules.ts`, with no migration, action or screen.
- `prisma/`: the schema, the migrations and the seed.
- `test/fixtures/pep/`: the PEP site's responses recorded on 2026-10-29, which `test/recorded-http.ts` serves to the tests instead of the real site.
- `test/fake-notification-channel.ts`: a fake module of the Notification Channel family, which keeps the notifications instead of sending them. A test passes it to `createActions` instead of the registry and saves it as the Candidate's Channel. A Candidate without a saved Channel is never notified: a test that forgets the fake sends no real notification.
- `test/fake-home-assistant.ts`: the fake Home Assistant, an HTTP server on a free port that answers like its REST API (token, list of services, `notify`), keeps the notifications received and can simulate an outage. `test/home-assistant.test.ts` and `test/write-only-token.test.ts` go through it, and `playwright.config.ts` starts it first: the seed saves there the Channel of Léa, Camille and Sacha.
- `test/fake-ai-session.ts`: the fake Claude launch, which writes the expected Artifact and keeps the prompt received. `test/fixtures/claude/claude` replaces the `claude` binary to test the real launch without opening a session.
- `test/lea.ts`: Léa and her Watch, created by the actions as from the front. `test/global-setup.ts` makes a template database of it (`test/create-lea-database.ts`), which `createDataDirectory` copies for each test.
- `test/seed-front.ts`: the data of the Playwright tests, produced by the actions with the fakes in a temporary folder, never `data/`. `playwright.config.ts` runs it before the development server, which it points at this folder.
- `test/e2e-actions.server.ts`: the actions of the Playwright tests, with the fakes. The development server serves them instead of `src/web/acl/actions.server.ts` in `e2e` mode (`vite.config.ts`), and `test/e2e-worker.ts`, the test worker, runs with them the jobs queued by the front.

## Commands

| Command               | Role                                                                  |
| --------------------- | --------------------------------------------------------------------- |
| `mise run ci`         | Lint, typecheck and tests, as in CI                                   |
| `mise run lint`       | ESLint, Prettier, Knip, and migrations up to date with the schema     |
| `mise run typecheck`  | TypeScript                                                            |
| `mise run test:unit`  | Vitest: the actions and the architecture                              |
| `mise run test:e2e`   | Playwright: the front's flows                                         |
| `mise run web`        | Serves the front of `data/` on port 5180: the lpm service `web`       |
| `mise run web:dev`    | Serves the front of `dev-data/` on port 5181, for development         |
| `mise run worker`     | Runs the worker on `data/`: the lpm service `worker`                  |
| `mise run db:migrate` | Creates a migration from the schema and applies it to `dev-data/`     |
| `mise run db:seed`    | Replaces the Postings of `dev-data/` with fake Postings               |
| `mise run db:reset`   | Recreates the `dev-data/` database from the migrations, then seeds it |
