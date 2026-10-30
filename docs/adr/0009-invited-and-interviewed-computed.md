# Invited and Interviewed are computed from the Interviews, never stored

The stored Status of a Posting is To Apply, Applied, Hired or Rejected. An Applied Application shows as Invited while one of its Interviews is upcoming, and as Interviewed once they have all taken place. It is computed on each read, like Expired, since it depends on the time. Without an Interview, it stays Applied. Once Hired or Rejected, the outcome wins over the Interviews. The Candidate therefore never picks Invited: they add an Interview, and the step follows.

## Considered Options

- **All steps stored, picked in the selector.** Rejected: the step and the Interviews would contradict each other, for example an Invited Posting without an Interview, or Interviewed with an Interview next week.
- **Stored, with a rule "adding an Interview makes the Posting Invited".** Rejected: nothing would make it Interviewed, someone would have to remember to do it by hand after each round.
