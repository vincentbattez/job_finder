# A Draft is a Version the Candidate has not validated, for every Artifact

The Draft used to be an Artifact of its own: the cover letter the AI wrote, frozen, from which the human corrected the Letter in the same Version, while every other Artifact's latest ready Version became its Chosen Version on its own. A regeneration could thus silently replace a Version the Candidate had read and corrected, and the following Artifacts built on Versions nobody had read. A Draft is now the state of any new Version, whether the AI produced it or the Candidate brought it, until the Candidate validates it; validating it makes it the Chosen Version, and only a Chosen Version is read by another Artifact. The AI's text is kept as the Version's Original, which every Artifact can compare with, and correcting a Validated Version keeps it Validated.

## Considered Options

- **Validation for the Letter only, the other Artifacts chosen automatically as before.** Rejected: one rule for every Artifact is simpler than an exception, and validating the Research before writing the Letter is the very "I read it" the workflow lacked.
- **Correcting a Validated Version sends it back to Draft.** Rejected: validating means the Candidate read it, which a correction of theirs does not undo.

## Consequences

- A Letter brought by the Candidate has no Original, so no comparison.
- Generating a Letter requires a Validated Research, one more step before the first Letter.
- The Versions of existing Letters migrate: their `draft.md` becomes the Original, their `letter.md` the text, and Chosen Versions become Validated.
