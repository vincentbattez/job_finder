# Archived is a separate mark, independent of the Posting's Status

A Posting has on one side a Status, which says where its Application stands (To Apply, Applied, Hired, Rejected, and Invited or Interviewed depending on its Interviews, ADR-0009), and on the other an Archived mark, which says whether the Candidate still follows it. Archiving does not touch the Status: an Invited Posting that gets archived stays Invited, and unarchiving it only removes the mark. Before, Archived was a value of the Status enum, and the step to restore was found through `appliedAt`. That worked with two steps, but not with five: a hidden step would have had to be stored separately.

## Considered Options

- **Keep Archived in the enum and store the step before archiving.** Rejected: two columns for a single piece of information, and the Status of an Archived Posting would no longer say where its Application stands.
- **Keep Archived in the enum and always go back to Applied.** Rejected: each unarchiving would lose the step for the Candidate, who would have to set it again by hand.

## Consequences

- The migration gives already Archived Postings the Applied Status if `appliedAt` is set, otherwise To Apply, and puts the mark on them.
- A Posting has an Application as soon as its Status is no longer To Apply. Since an Application never goes back to To Apply, this criterion is enough even for an Archived Posting.
