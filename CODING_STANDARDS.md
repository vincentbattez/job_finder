# Coding standards

The generic rules of the code. The why of a decision is in its ADR (`docs/adr/`), the vocabulary in `GLOSSARY.md`. A rule marked **(CI)** or **(hook)** is checked automatically, by CI or by a git hook. The others are checked in review. Any deviation is justified in the PR.

## Principles

- **The least code that achieves the result.** We write what the ticket asks for. A family of interchangeable modules (Sources, Notification Channels) keeps a single module until a second one is asked for, but its contract is generic from the first one (ADR-0010).
- **A rule that matters is checked by the machine**: a test, the typecheck or the lint. A rule that is only written ends up bypassed by oversight.
- **Idempotence.** Running a command, a Detection or a job again gives the same result, with no duplicate.
- **Visible failure.** An error stops the command with a non-zero exit code and a message, in the Candidate's locale, that says what to do. Silence always means "nothing to report".

## Architecture

- **Actions.** Each feature is an action of `src/actions/`. The CLI and the front relay to it, with no business rule (ADR-0003). **(CI)**
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
- A new raw access, for example an HTTP client or an SDK, is added to `RAW_DATA_ACCESS_LIST` in `test/architecture.test.ts`.

## Code

- Node runs TypeScript without a build, so only erasable syntax is allowed. An enumeration is written as a union of literals or as a `z.enum`. **(CI)**
- An import goes through the `#/` alias or stays in the current folder (`./`), with its `.ts` extension. **(CI)**
- Exports are named. Only tool configs and React Router route modules, which require it, export by default. **(CI)**
- For naming, `eslint.config.ts` is the reference: an array ends with `List`, a boolean starts with `is` or `has`, an interface with `I`, and module constants are in `UPPER_CASE`. **(CI)**
- Everything is in English: identifiers, comments, commits, the schema, routes, the CLI, file and folder names, docs and issues. Identifiers use the terms of `GLOSSARY.md`: `Candidate`, `listCandidates`, `watchList`. **(hook)** **(CI)**
- User-facing copy (front labels, CLI output, error messages, notifications, default Instructions) goes only through i18next, never inline: its FR/EN resources are in `src/domain/catalogue/{en,fr}/`, one namespace per area, `fr` typed against `en` (ADR-0012). A component uses `useTranslation`, any other code `tFor(locale, namespace)`. The areas not yet moved still use the former catalogue (`catalogueOf`, `useCatalogue`), which is deleted once empty.
- Artifacts are written in the language of the Job Description, whatever the Candidate's locale.
- Spelling is checked by cspell (`scripts/spellcheck.sh`, its English pass `cspell.config.yaml`) with an English dictionary, on the staged files and on the whole repo. French is only allowed in the French resources (`src/domain/catalogue/fr/`), checked with the French dictionary, and in recorded fixtures; narrowly besides, in the string literals of a module's copy file and its `fr:` labels (ADR-0010), checked with the French dictionary by the second pass (`cspell.fr.config.yaml`), in the literals of a test, which drive the French locale, and in the former names that the data migration and the redirects match. A proper noun or a tool name goes in `cspell-words.txt`. **(hook)** **(CI)**
- A comment gives, in one or two lines, the why that the code does not show, and cites the relevant ADR.

## Data

- `data/` holds the Candidates' real data, and only `jf` writes to it. Development, tests and the seed work in `dev-data/` or in a temporary folder.
- `prisma/schema.prisma` is the only source of the schema. A migration is generated by `mise run db:migrate`, then kept as is. **(CI)**

## Tests

- A test goes through the actions and checks what can be observed: the Postings in the database, the Artifacts on disk, the queued jobs, the notifications sent.
- Only a rule with many cases also has unit tests, next to its code: the Status (`src/status/`), the Repost (`src/repost/`), the title of a Watch (`src/modules/source-pep/title.ts`), the City of a place of work (`src/geo/city.ts`) and the Sections of the Facts in `facts.md` (`src/profile/facts.ts`).
- Only external boundaries are faked: the HTTP of the Sources (with recorded responses), the Claude launch and the Notification Channel. A fake module of the family (`test/fake-notification-channel.ts`) replaces the registry when a test only looks at the notifications sent. A module that calls a service over HTTP is tested against a fake server that answers like it, for example `test/fake-home-assistant.ts`: its tests and the e2e go through this server rather than through a replaced `fetch`.
- Each Notification Channel gives `test/write-only-token.test.ts` Parameters its fake server accepts: the test checks that no action returns one of its secret Parameters, and fails as long as a Channel is missing from it. No Source has a secret Parameter yet: the first one that declares one goes in too.
- An e2e test that changes data changes its own, which only it touches (its Posting, its Candidate), and resets them at the start, not at the end: it passes alone, repeated (`--repeat-each` with `--workers=1`) or alongside the others. `fullyParallel` fails the one that reads what another left behind. **(CI)**
- Each architecture rule has a fixture project that breaks it, to prove it catches something.

## Git

- Commits follow Conventional Commits, with a required scope and a sentence-case subject. **(hook)**
- Each ticket has its branch and its PR. The PR closes the ticket and passes CI.
