# Prisma for the SQLite database, with migrations and seed

The SQLite database is described by `prisma/schema.prisma`, the only source we edit. Prisma derives the typed client and the migrations from it (`prisma migrate dev`), versioned in `prisma/migrations/`. On every launch, the application applies pending migrations to `data/` (`prisma migrate deploy`): updating the code needs no manual step. A faker seed fills `dev-data/` with fake Postings, to develop without touching the real data.

This choice replaces the PRD line (#1) "`node:sqlite`: no ORM, no native dependency". The schema will change with every slice while `data/` already holds Léa's Postings. Migrations generated from a declarative schema cost less than hand-written ones.

## Considered Options

- **`node:sqlite` and hand-written SQL** (the PRD's initial choice). No dependency, but we had to write the migration mechanism ourselves (`PRAGMA user_version` and SQL scripts), validate each row read with Zod, and write the development data by hand.

## Consequences

- Two native dependencies come in: `better-sqlite3`, through the Prisma adapter, and Prisma's migration engine. `package.json#allowScripts` allows their install scripts.
- `npm install` generates the client in `src/workspace/generated/`, outside git. Prisma types do not leave `src/workspace/acl/`, which converts each row to a domain type (ADR-0005).
- `prisma migrate deploy` costs about 0.3 s, the time its CLI takes to start. A `jf` launch only pays it when a migration is pending: it first reads the `_prisma_migrations` table, where Prisma records the ones it applied. Most tests start from an already migrated database.
- The worker and the web starting together can both migrate. Prisma gives up on a database the other holds, so a launch tries again; the second to keep an Original leaves the first's.
- SQLite no longer checks enum values (a Posting's Status, the state of a Version or a job): Prisma checks them.
- Prisma commands and `db:` tasks only touch `dev-data/`. A generated migration is not edited by hand, and CI fails if the schema changed without a migration.
