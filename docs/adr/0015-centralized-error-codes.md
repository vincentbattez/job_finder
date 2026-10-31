# Every failure has an Error Code from a single catalogue

A failure only carried its message: 56 `throw new Error(...)` across `src/`, and a failed job kept nothing but its text in `Job.log`. Neither the front, the CLI nor a test could tell which failure it was without matching a sentence that changes with the locale. From now on, every failure our code raises has an Error Code from one catalogue, `src/domain/error.ts`: one line per code, its meaning in the comment beside it, and the i18next key of its message (ADR-0012), which says what to do in the Candidate's locale. A code whose key en/ or fr/ lacks does not compile.

`codedError(code, values, { locale, cause })` (`src/domain/coded-error.ts`) is the only way to build an error; its `code` travels with it. A boundary that catches anything (the worker's queue, `jf`, the routes of the front, the Detection) passes it through `codedErrorOf`, which keeps an error of ours as is and ties any other one, from a library, the database or the network, to `unexpected`, or a `ZodError` to `invalid_input`: nothing reaches the Candidate without a code. A failed job keeps its code in `Job.errorCode`, beside its log, so that the front and the CLI read it after the worker ran it (ADR-0003). `jf` prints `[code] message` and exits with code 1. `test/architecture.test.ts` refuses an Error class built, called or extended, or a value thrown as is, anywhere in `src/` but `coded-error.ts`.

## Considered Options

- **An Error class per failure.** Rejected: dozens of classes for one field that differs, and a class is no data the database can keep.
- **The code as the i18next key itself.** Rejected: a module's failure is worded in its own copy, the only place allowed to name it (ADR-0010), and some messages live in the `cli` and `notification` areas. The catalogue maps a code to a key of any area instead; a module's codes are generic to its family (`source_unreachable`, `channel_token_refused`) and take the module's text as detail.
- **The meaning as data rather than a comment.** Rejected for now: nothing reads it at run time; a comment is one line and stays beside the code.
- **An ESLint rule rather than an architecture test.** Rejected: the other architecture rules live in the test, with a fixture project that breaks each.

## Consequences

- Adding a failure is one line in the catalogue and its message in en/ and fr/; throwing it is `throw codedError('code', { values }, { locale })`.
- A code is kept in the database: renaming one needs a data migration of `Job.errorCode`, so a code is named for good, in snake_case, with the terms of `GLOSSARY.md`.
- The values of a message are not typed by i18next: a value missing from a call shows as its placeholder; the tests of each message catch it.
