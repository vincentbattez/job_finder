# The Candidate sorts New Postings, which replaces the Zone

A detected Posting used to start To Apply, and its Research started on its own when it lay in its Watch's Zone. In practice nobody sorted: Léa had 50 Postings To Apply, 45 of them outside the Zone and never looked at, and a single one Archived. A detected Posting now starts New, and the Candidate keeps it, which puts it To Apply and starts its Research, or dismisses it, which archives it (ADR-0007). The Zone goes away: the Candidate's sorting decides which Postings are worth a Research, not a territory set in advance.

## Considered Options

- **Keep the Zone to start the Research of the Postings inside it before sorting.** Rejected: it spends Claude sessions on Postings the Candidate may dismiss, to save a wait of a few minutes on the few that fall inside it.
- **An "unread" flag on top of the existing Statuses.** Rejected: it tells what the Candidate has seen, not what they decided, and To Apply would stay a dumping ground.

## Consequences

- The Zone Parameter of each Source and the Posting's in-Zone flag disappear, with a migration.
- An imported Job Description skips New: importing it is already the decision to pursue it.
