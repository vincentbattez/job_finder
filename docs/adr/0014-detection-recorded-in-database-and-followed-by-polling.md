# A Detection is recorded in the database from its start, and the front follows it by polling

A Detection takes from fifteen seconds to several minutes, and the front showed nothing but a greyed-out button meanwhile (#63). From now on, each Detection is a row of the database, created as soon as it is claimed, with one line per Watch it covers: its step (searching the Source, reading the Job Descriptions, sending the notifications), how many Job Descriptions it read out of how many, then its verdict (the new Postings, the near-miss ones, the notifications not sent) and its failure. `detect()` updates these lines as it goes. The front reads them every two seconds while one runs, and shows the last one otherwise, whoever started it: the button, the daily automation (`jf detect --automation`) or `jf detect`.

The same row is the lock: a unique index on its `runningLock` column, true while it runs and null once finished, refuses a second running Detection atomically, even from another process. A Detection whose process died stops holding the lock once it has not been touched for ten minutes: the next one fails it as interrupted, then runs.

## Considered Options

- **An SSE stream served by a resource route.** Rejected: the progress is lost as soon as the Candidate changes page or reloads, the daily Detection stays invisible, and a separate lock is still needed.
- **A file lock.** Rejected: it says nothing to the front, and a lock left by a dead process needs the same staleness rule as the row.
- **Store only the last Detection, overwritten each time.** Rejected: one row per Detection is no more code, and keeps the last verdict of each Candidate when another Candidate's Detection runs after it.

## Consequences

- The button starts a Detection of its Candidate's Watches only; `jf detect` and the automation cover every Watch. One Detection at a time, whichever it is: the other is refused with a message saying when the running one started.
- The Watch is copied into the Detection with its label, never its identifier: a Watch deleted since keeps its history, and the front never shows an identifier.
- The steps are generic, those of every Source: emitted by `detect()`, they can move into the contract of the Sources without changing the table.
- A Posting the last Detection found is marked New in the list, until the next Detection; those of a first launch, already online, are only imported.
