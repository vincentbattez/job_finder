# An anti-corruption layer at every boundary, checked by a test

Any data coming from outside is validated by Zod and converted to a domain type before it enters the application: the database, a file, an API, a subprocess, the environment, what a user types in the front or the CLI. Domain types live in `src/domain/`, derived from their Zod schemas. Each schema carries the `'Domain'` brand, which a value only gets by going through `parse`. Only `acl/` folders touch raw data: the Prisma client, `fetch`, file reads, `JSON.parse`, `node:child_process` and `process.env`. The actions are the boundary with the front and the CLI. Each one receives its input as `unknown` and parses it itself. It returns nothing, or domain values.

Three checks guarantee it in CI:

- `test/architecture.test.ts` fails as soon as a file of `src/` outside an `acl/` folder uses one of these accesses;
- the typecheck rejects an action whose input is not `unknown`, or whose output is neither `void` nor a branded value (`satisfies` in `src/actions/index.ts`);
- ESLint forbids type assertions (`as`), so the brand cannot be forged by hand.

## Considered Options

- **Domain types without a brand.** Rejected: a Prisma row has the same shape as a domain type, and TypeScript accepts it. We checked it by adding a `Pays` model: a method of `src/workspace/acl/database.ts` that returned the raw row, relayed by an action, passed the test and the typecheck.
- **Converting database rows without validating them**, as the wiki suggests for a repository. Rejected: SQLite checks neither enums nor Json columns, such as the criteria and the Zone of a Watch (ADR-0004). A Zod parse on each read costs little.
- **A single `src/acl/` folder for the whole application.** Rejected: each Source is an independent module (ADR-0003). Its ACL therefore lives in its own folder, for example `src/modules/<source>/acl/`.
- **ESLint rules** (`no-restricted-imports`, `no-restricted-globals`, `no-restricted-properties`) **instead of the test.** They are more precise, since they read the AST, but the boundaries stay checked in one place, in the architecture test.
- **An archunit `adhereTo` rule.** It reads each file relative to the current folder. On a fixture project it therefore sees empty files and proves nothing (checked). The test reads the files itself.

## Consequences

- The whole application lives in `src/`, since the test only looks there. The front will have to live there too: it will not go in React Router's default `app/`.
- Tests, the seed and tool configs handle raw data on purpose. The seed writes its fake Postings with its own Prisma client.
- Data that does not leave through an action is not checked, for example what a module writes to the database. An `acl/` folder can still pass it on without parsing it, but it reaches neither the front nor the CLI.
- The test recognizes an access by its text. It targets oversight, not cheating: an alias such as `globalThis['fe' + 'tch']` would get through. A new raw access, for example an HTTP client other than `fetch`, is added to its list.
- An action that returns a composite object, such as a Posting with its Versions, describes it with its own domain schema.
- The front, like the CLI, reaches features only through the actions. The ticket that creates the front adds the archunit rule that checks it.
