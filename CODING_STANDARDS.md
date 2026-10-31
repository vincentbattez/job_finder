# Coding standards

The generic rules of the code. The why of a decision is in its ADR (`docs/adr/`), the vocabulary in `GLOSSARY.md`. A rule marked **(CI)** or **(hook)** is checked automatically, by CI or by a git hook. The others are checked in review. Any deviation is justified in the PR.

## Principles

- **The least code that achieves the result.** We write what the ticket asks for. A family of interchangeable modules (Sources, Notification Channels) keeps a single module until a second one is asked for, but its contract is generic from the first one (ADR-0010).
- **A rule that matters is checked by the machine**: a test, the typecheck or the lint. A rule that is only written ends up bypassed by oversight.
- **Idempotence.** Running a command, a Detection or a job again gives the same result, with no duplicate.
- **Visible failure.** An error stops the command with a non-zero exit code and a message, in the Candidate's locale, that says what to do. Silence always means "nothing to report". Every error comes from the catalogue of Error Codes, `src/domain/error.ts`, through `codedError`; a boundary that catches anything ties a foreign error to a code with `codedErrorOf` (ADR-0015). A failure no one waits for in front of the screen, such as that of a job the Detection queued or of a notification, is notified or kept on its job for the Posting page: the business code (`src/actions/`, `src/modules/`, `src/workspace/`) never writes to `process.stderr` nor `process.stdout`, which only the CLI and the worker, which display, do. **(CI)**

## Architecture

- **Actions.** Each feature is an action of `src/actions/`. The CLI and the front relay to it, with no business rule (ADR-0003). **(CI)**
- **Front failures.** Every action of a route of `src/web/routes/` goes through `relayAction` (`src/web/relay-action.server.ts`): a refusal goes back to the form that posted it, in its code's message, and the form keeps what was typed. Every loader, the root's included, goes through `relayLoader`: the `ErrorBoundary` shows the message and the Error Code of what failed, a foreign failure under `unexpected`, never a raw message (ADR-0002, ADR-0015). **(CI)**
- **Containers and Dumbs (ADR-0008).** Only a Container, in `src/web/containers/`, or a route reads data or runs an action. A Dumb, in `src/web/components/`, only displays its props: it imports neither a `.server` module (the front actions), nor a Container, nor `useLoaderData`, `useRouteLoaderData`, `useActionData`, `useFetcher`, `useSubmit` or `useRevalidator`, and has no form that posts. A form a Dumb lays out reaches it through a slot from its Container (`children`, a `ReactNode` prop or a `renderForm` render prop); a search form, which only navigates, stays in the Dumb. A data Container exports its loading function beside its component, and the page's `loader` calls it with the actions, which it passes rather than the Container importing a `.server` module that the browser never loads (`containers/latest-postings.tsx`). `test/architecture.test.ts` checks it, and a fixture project that breaks the rule proves it catches it. **(CI)**
- **Modules.** A module lives in its folder of `src/modules/`, with a single entry point and its prompts in separate files. It exchanges with the other modules through the Artifacts on disk and through the database, without importing them (ADR-0003). **(CI)**
- **Interchangeable modules (ADR-0010).** When the Candidate picks between several modules that do the same job (a Notification Channel, the Source of a Watch), these modules form a family:
  - the family's contract lives in `src/<family>/`;
  - each module lives in `src/modules/<family>-<name>/` and exports a descriptor: id, display name, Parameters described by a Zod schema (required, optional, secret), operations;
  - the database keeps one table per family, with the id of the chosen module and its Parameters as Json; the domain, the actions and the front only handle the family, and the form is built from the descriptor;
  - a module's name appears only in its folder and in the registry `src/actions/modules.ts`. Adding a module is a folder and a registry line, with no migration and no screen. **(CI)**
- Imports form a graph without cycles. **(CI)**
- The whole application lives in `src/`.

## Anti-corruption layer (ADR-0005)

- **Domain.** Each domain concept has its Zod schema in `src/domain/`, ending with `.brand<'Domain'>()`. Its type is derived with `z.infer`. An enumeration (`z.enum`) stays without a brand, so that its literals can be written in the code: the object that carries it has its own. A schema that carries a secret, such as a secret Parameter of a Notification Channel, has the `'Secret'` brand: the typecheck then refuses that an action returns it (ADR-0006).
- **ACL.** Raw data (database, files, HTTP, subprocesses, environment) is read in an `acl/` folder. It parses it with a domain schema and exports only domain types. **(CI)**
- An action receives its input as `unknown` and parses it. It returns `void` or domain values. **(CI)**
- A domain value is always obtained through `parse`. `as` assertions are refused. **(CI)**
- Validation happens at the boundaries. Past the ACL, the code trusts the types.
- **Bounded calls.** In an ACL, every subprocess has a `timeout` and every request, `fetch` or an injected `httpFetch`, a `signal` with a time limit: a call that never returns would leave its job "Running" forever and hold the queue behind it. The interactive session of `jf edit` and `jf profile`, which the Candidate ends themselves, is the named exception of `UNBOUNDED_CALL_LIST`. **(CI)**
- A new raw access, for example an HTTP client or an SDK, is added to `RAW_DATA_ACCESS_LIST` in `test/architecture.test.ts`.

## Code

- Node runs TypeScript without a build, so only erasable syntax is allowed. An enumeration is written as a union of literals or as a `z.enum`. **(CI)**
- An import goes through the `#/` alias or stays in the current folder (`./`), with its `.ts` extension. **(CI)**
- Exports are named. Only tool configs and React Router route modules, which require it, export by default. **(CI)**
- For naming, `eslint.config.ts` is the reference: an array ends with `List`, a boolean starts with `is` or `has`, an interface with `I`, and module constants are in `UPPER_CASE`. **(CI)**
- Everything is in English: identifiers, comments, commits, the schema, routes, the CLI, file and folder names, docs and issues. Identifiers use the terms of `GLOSSARY.md`: `Candidate`, `listCandidates`, `watchList`. **(hook)** **(CI)**
- User-facing copy (front labels, CLI output, error messages, notifications, default Instructions) goes only through i18next, never inline: its FR/EN resources are in `src/domain/catalogue/{en,fr}/`, one namespace per area, `fr` typed against `en` (ADR-0012). A component uses `useTranslation`, any other code `tFor(locale, namespace)`. An interchangeable module keeps its copy, its Parameter labels included, in its own namespace in `src/modules/<module>/copy.ts` (`addResources`); a Parameter names its label by key (`textKeyOf`), which the error messages and the loader of the front (`translateParameters`) read on the server with `textOf`, since the front's bundle never loads a module (ADR-0010).
- Artifacts are written in the language of the Job Description, whatever the Candidate's locale.
- Spelling is checked by cspell (`scripts/spellcheck.sh`, its English pass `cspell.config.yaml`) with an English dictionary, on the staged files and on the whole repo. French is only allowed in the French resources (`src/domain/catalogue/fr/`), checked with the French dictionary, and in recorded fixtures; narrowly besides, in the string literals of a module's copy file (ADR-0010), checked with the French dictionary by the second pass (`cspell.fr.config.yaml`), in the literals of a test, which drive the French locale, and in the former names that the data migration and the redirects match. A proper noun or a tool name goes in `cspell-words.txt`. **(hook)** **(CI)**
- A comment gives, in one or two lines, the why that the code does not show, and cites the relevant ADR.

## CSS (ADR-0013)

The front's styles are one stylesheet per component, in BEM, ordered by cascade layers. `stylelint.config.ts` and the CSS part of `test/architecture.test.ts` are the reference.

- **Layers.** `src/web/app.css` keeps the Hallmark stamp at its head, declares the order once, `@layer vendor, tokens, base, layout, components, utilities;`, and imports each global stylesheet into its layer, Leaflet into `vendor`. `root.tsx` imports `app.css` first, so its `@layer` comes before any other. A rule wins by its layer, never by its line or by force.
- **Global stylesheets** sit beside the root, for what belongs to no component: `tokens.css` (palette, spacing, type and z-index scales), `base.css` (reset, HTML elements, focus, reduced motion), `layout.css` (the frame of every page), `controls.css` (the shared `.button` and the `.field` form controls, one control box for both), `utilities.css`. A look several components share is a Dumb of its own, with its stylesheet, that they render (`ButtonRow`, `WorkerTask`, `SettingsPanel`, `Deletion`, `EmptyState`), never a copy in each stylesheet nor a component layout in `controls.css`.
- **Component stylesheets.** A Dumb of `src/web/components/` that has styles gets a `.css` named like it, beside its `.tsx`, which alone imports it; its `@media` rules sit with its rules. Containers and routes carry no stylesheet: a route-specific look becomes a Dumb or goes in `layout.css`.
- **States** go through `data-*` and ARIA attributes (`[data-status]`, `[data-new]`, `[aria-current]`, `:disabled`), never a state class.
- A stylesheet sits beside the root (a global one) or in `src/web/components/` (a component's), never beside a route or a container. **(CI)**
- Every rule of a component stylesheet, `@keyframes` included, sits in `@layer components`. **(CI)**
- A stylesheet has at most 200 lines: past that, it is split. **(CI)**
- A component stylesheet has a same-named `.tsx` beside it that imports it, and no other file imports it. **(CI)**
- A component stylesheet only styles its block, named like the file: `.badge`, `.badge__x`, `.badge--y` in `badge.css`. A library's class (Leaflet's) only appears in the same compound as the block, and never another component's block. **(CI)**
- A global stylesheet never styles a component's block, even a component without a stylesheet. **(CI)**
- A Dumb renders in its `className`s only the classes of its own block and of `controls.css` and `utilities.css`: never another component's block (render that component instead), nor the layout's classes, which belong to the routes and the root. **(CI)**
- A class of `controls.css` is rendered by at least two files: one rendered by a single file is that component's look, in its own stylesheet. **(CI)**
- Only `app.css` has `@import`. **(CI)**
- Class names are kebab-case BEM: `block`, `block__element`, `block--modifier`. **(hook)** **(CI)**
- A color comes from a token: no hex, no named color, no color function outside `tokens.css`; `color-mix()` and relative colors over a token pass. **(hook)** **(CI)**
- Selectors stay flat: no ID, at most two compound selectors, specificity at most 0,2,1; a guard that must not weigh goes in `:where()`. **(hook)** **(CI)**
- No `!important`, except in `base.css` and `utilities.css`, which must beat every layer. **(hook)** **(CI)**
- A selector and a property are written once in a block; a base selector comes before its higher-specificity variants. **(hook)** **(CI)**
- `stylelint-config-standard` applies too; the hook fixes what Stylelint can, then Prettier formats. **(hook)** **(CI)**

## Data

- `data/` holds the Candidates' real data, and only `jf` writes to it. Development, tests and the seed work in `dev-data/` or in a temporary folder.
- `prisma/schema.prisma` is the only source of the schema. A migration is generated by `mise run db:migrate`, then kept as is. **(CI)**

## Tests

- A test goes through the actions and checks what can be observed: the Postings in the database, the Artifacts on disk, the queued jobs, the notifications sent.
- Only a rule with many cases also has unit tests, next to its code: the Status (`src/status/`), the Repost (`src/repost/`), the title of a Watch (`src/modules/source-pep/title.ts`), the City of a place of work (`src/geo/city.ts`) and the Sections of the Facts in `facts.md` (`src/profile/facts.ts`).
- Only external boundaries are faked: the HTTP of the Sources (with recorded responses), the Claude launch and the Notification Channel. A fake module of the family (`test/fake-notification-channel.ts`) replaces the registry when a test only looks at the notifications sent. Likewise, the e2e tests add a slow fake Source (`test/fake-slow-source.ts`) beside the registry, to see a Detection's progress and each of its verdicts without network. A module that calls a service over HTTP is tested against a fake server that answers like it, for example `test/fake-home-assistant.ts`: its tests and the e2e go through this server rather than through a replaced `fetch`.
- Each Notification Channel gives `test/write-only-token.test.ts` Parameters its fake server accepts: the test checks that no action returns one of its secret Parameters, and fails as long as a Channel is missing from it. No Source has a secret Parameter yet: the first one that declares one goes in too.
- An e2e test that changes data changes its own, which only it touches (its Posting, its Candidate), and resets them at the start, not at the end: it passes alone, repeated (`--repeat-each` with `--workers=1`) or alongside the others. `fullyParallel` fails the one that reads what another left behind. **(CI)**
- Each architecture rule has a fixture project that breaks it, to prove it catches something.
- A test keeps under its time budget, and the run under the suite's: 6 s per test and 180 s for the run on the GitHub runner, where `test/time-budget-reporter.ts` fails the run that goes over; elsewhere it only reports. A file whose tests legitimately take longer (a CLI spawned, the Prisma CLI, the archunit graph) is listed in its `SLOW_FILE_LIST` with its own budget and the reason. A fixed cost paid by each test (a Detection, a cspell start) goes in the global setup or in a `beforeAll`, which is what keeps the run under its budget. **(CI)**

## Git

- Commits follow Conventional Commits, with a required scope and a sentence-case subject. **(hook)**
- Each ticket has its branch and its PR. The PR closes the ticket and passes CI.
