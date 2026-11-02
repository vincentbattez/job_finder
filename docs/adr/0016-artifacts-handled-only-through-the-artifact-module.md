# Artifacts are handled only through the Artifact module

Every Artifact feature used to touch a dozen actions, because each one resolved the Artifact, its Versions and its rules itself (30 files for the Interview Brief per Interview). From now on, the Artifact module, `src/artifact/`, alone owns the Artifact of a Posting or of an Interview: where it is attached, its Versions and Chosen Version, its verdicts as data, its Prompt preview, its run, and its acts, each of which checks its own verdict. What makes one Artifact differ from another stays declared by its AI module (ADR-0003), its refusals included: an Artifact that is not editable and the read-only files of a Version each carry their Error Code (ADR-0015). Two architecture rules guard it: only the actions import the module, and only the module creates an Artifact job or writes a Version.

An action names an Artifact as it received it (`artifacts.find({ reference, artifact | module, interview })`) and gets a handle: a snapshot of one read, for one request. A verdict is `null` or a refusal `{ code, values }`, which the front reads as a flag and an act throws through `codedError`. The worker runs an Artifact job with `artifacts.run(job)`, which refuses a job queued before its Posting changed before writing anything.

## Considered Options

- **A flexible interface**: one generic `judge(operation)` and `perform(command)`, with a small rule language on the AI module (`restrictionList`) and wordings per audience. Rejected: wide surface, arguments the compiler cannot check, and generality only one case needs.
- **One call that describes the whole Posting page.** Rejected: it ties the module to the page's shape; one entry per Artifact keeps the locality of a new field without it.
- **Moving "the latest ready Version becomes the Chosen Version" into the module.** Rejected: it would leave the workspace transaction, and a ready Version could stay unchosen.

## Consequences

- Adding an Artifact is its module folder and one line of the registry, `src/artifact/registry.ts`, with no action, CLI command or front type to change: the front reads the domain's `Artifact` type through the actions.
- The rules of an Artifact are tested at the module's interface, `test/artifact.test.ts`; the action tests keep one nominal case and one refusal each.
- The lookup of a stalled job is injected into the module until a job-queue module owns it.
