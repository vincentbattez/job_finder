# Candidates, their Watches and the Default Deadline Period live in the database, and the front writes them

Until now, `data/config.json` was the source of truth for the Candidates, their Watches and the Default Deadline Period: each launch copied it into the database. Adding a Watch or a Candidate therefore went through Vincent and a JSON file. From now on, the database is their source of truth and the front writes them: a Candidate sets their Watches on their Profile page, and the Candidates page creates a Candidate, renames them and sets the Default Deadline Period. The file is no longer read, except once: on the first launch of a database that does not have its Default Deadline Period yet, a `data/config.json` left there is imported, then never read again.

Like the rest of the front (ADR-0002), these screens have no authentication: any visitor of the front, on the LAN or the VPN, can create or rename a Candidate and set the Default Deadline Period. The two people who access it already control everything else. However, no Candidate can be deleted: no action, no button. Their Postings, Artifacts and Uploads make no sense without them, and a deletion by mistake from a menu with no password would be irreparable.

## Considered Options

- **Keep `data/config.json` as the source of truth, and have the front write it.** Rejected: two sources (the file and the database) to keep in agreement, and a JSON file the front rewrites entirely while `jf` or the worker read it.
- **Re-import the file on each launch, merging with the database.** Rejected: each launch would overwrite what the front saved, or need a field-by-field merge rule.
- **Rename the file once imported.** Rejected: the application does not touch a file Vincent wrote. The database itself remembers that the import happened (the row of its Default Deadline Period exists), and `jf` reports on each command that the file is no longer read, until Vincent deletes it.
- **Reserve creating a Candidate and the Default Deadline Period to `jf`.** Rejected: that was exactly what made each change go through Vincent, and the front has no way to tell its visitors apart anyway.
- **Archive a Candidate, or delete them with their Postings and Uploads.** Rejected: no need today, and either one requires deciding what becomes of their Postings. A Candidate who stops searching keeps their data, without a Watch.

## Consequences

- A new database starts with no Candidate and a Default Deadline Period of 6 months. `jf`, the worker and the front start without `data/config.json`.
- The one-time import only adds or updates: it deletes neither a Candidate nor a Watch, and keeps the last run of each Watch, so that the next Detection does not start over as a first launch.
- A Watch created from the front is at its first launch: the Postings already online it finds are imported without triggering anything (ADR-0003). A Watch whose Source or Parameters change starts over too: a widened title does not suddenly start one Research per Posting already online.
- A deleted Watch keeps its Postings, which belong to the Candidate and not to the Watch.
- The Default Deadline Period changes the Expired computation as soon as it is saved in the front's process, and on the next launch in the others (`jf`, the worker).
- An architecture test checks that no file of `src/` names `config.json` any more, except the anti-corruption layer of the one-time import.
