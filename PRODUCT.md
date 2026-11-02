# Product

<!-- impeccable:product-schema 1 -->

Product truth for design work on Job Finder. Vocabulary is `GLOSSARY.md`'s; decisions are in `docs/adr/`. Facts come from the product owner's answers (2026-11-02) or from the repository, which is cited; the few inferences are marked _(inferred)_.

## Platform

web

## Users

- **Primary: any Candidate.** A job seeker who uses the tool to find Postings and apply, then to prepare their Interviews. The product is designed for a generic Candidate, not for one person: no screen may assume who the Candidate is, their field or their Locale.
- **Operator.** A role, not an account: the person who manages the Watches, the Instructions, the Candidates and the global settings, such as the Default Deadline Period. The front has no authentication: the Candidate is picked from a menu and any visitor can do the operator's work (ADR-0002, ADR-0011).
- Today the install serves two people on one private network; the first Candidate prepares public-sector applications in France (README, ADR-0002, ADR-0017).

## Product Purpose

Job Posting watch and Application preparation: spot the Postings that match a Candidate, then produce for each one what it takes to apply and to prepare the Interview (`GLOSSARY.md`). The flow is detect → sort → prepare with the AI → revise: a Detection records new Postings, the Candidate keeps or dismisses each New one (ADR-0018), the AI drafts the Research, the Letter, the Portrait of the Interviewers and the Interview Brief, and the Candidate reads, corrects and validates each of them before anything builds on it.

Success _(inferred from the position below)_: the Candidate applies to the Postings they chose with a Letter they validated, and arrives at each Interview having revised a Brief they understand.

## Positioning

A copilot under the Candidate's control. The AI proposes, the Candidate decides:

- every AI output starts as a Draft and only the Candidate validates it (Draft → Validated, ADR-0019); only a Validated Version, the Chosen Version, is read by another Artifact;
- the Candidate sees exactly what the AI reads before a run: the Inputs, each with a preview of its exact content, and the Prompt, with its Fixed Part and the Instructions in effect, which they can edit;
- only the Candidate marks a Posting Applied: a Letter written is not a Letter sent (`GLOSSARY.md`, Applied).

The app is also the Candidate's revision space before an Interview: pleasant, clear and learning-friendly, a place to study the Interview Brief section by section, not only a tracker.

## Operating Context

- **Where it runs.** A web front served from a Mac mini on the home network, reached remotely through WireGuard, never exposed to the internet (ADR-0002). The Candidate opens it in a modern browser.
- **Devices.** Desktop-first; mobile stays usable for occasional consultation (ADR-0017).
- **AI runs.** Each Artifact is produced by a headless Claude Code session on the operator's subscription (`claude -p`, no API key), one at a time through the worker's queue (ADR-0003, README). A run takes minutes: the front queues it and follows its state.
- **Rhythm.** A Detection runs every day at 18:00 and can be started by hand; each Candidate then receives one Detection Summary on their phone or by e-mail, linking to the Postings (README).
- **Sources.** Today, one public job site (the PEP, ADR-0001) and Job Descriptions imported by hand as Markdown.
- **Interviews.** The Candidate records each Interview (start, duration, place, Interviewers) and revises its Brief in the days before it.

## Capabilities and Constraints

- **Statuses.** New → To Apply (kept, which starts the Research) or Archived (dismissed); To Apply → Applied; Invited and Interviewed are computed from the Interviews; Hired or Rejected close an Application, which can be put back In progress. Archived, Expired and Unpublished hold whatever the Status (`GLOSSARY.md`, ADR-0007, ADR-0018).
- **Artifacts.** Research, Letter, Portrait, Interview Brief and Custom Artifacts, each with Versions, a Chosen Version, Draft or Validated, the Original kept for comparison, and the Inputs it was produced from. They are written in the Job Description's language, whatever the Locale. Research, Portrait, Interview Brief and Custom Artifacts are MDX with a closed catalogue of components; the Letter is plain Markdown; the Visualization is gone (ADR-0020).
- **Revision.** The Candidate's study of the Chosen Interview Brief before its Interview, with a note per section and sections marked Mastered (`GLOSSARY.md`).
- **Front.** An orchestration of shadcn components on Tailwind v4 and shadcn's CSS-variable tokens; a custom component only where shadcn covers nothing, in shadcn's spirit. Interactivity may require hydration; data comes from SSR loaders and mutations go through forms and fetchers (ADR-0017, ADR-0008).
- **Copy.** Every word the Candidate reads goes through i18next, French and English, French by default; a Locale Switcher sets the Locale (ADR-0012).
- **Undecided.** The V1 screens for the Profile, the Watches and the Settings were not prototyped: their design is open.

## Brand Commitments

- **Name.** Job Finder.
- **Voice (product owner).** The French UI addresses the Candidate in the informal second person (« tu »): sober, warm without familiarity. The English UI follows the same tone. French is the default Locale.
- **Terms.** The UI speaks the glossary's words, one meaning each. The French UI always names the Letter in full, « Lettre de motivation », never « Lettre » alone; a short label may abbreviate it only where the full form breaks the layout (prototype verdict, 2026-11-02).
- **Identity assets.** None: no logo, no brand palette beyond the design system.

## Evidence on Hand

- **Real data.** The live checkout's `data/` holds the first Candidate's real Postings, Artifacts, Interviews and Profile; `dev-data/` and the test seeds hold fake ones (README).
- **The validated prototype.** Branch `prototype/v1-ux` (never merged) shows the V1 on a snapshot of the real data; its `src/web/prototype/DECISIONS.md` records the workflows and the product owner's verdicts of 2026-11-02, including one Research and one Interview Brief hand-written in MDX to show the target rendering.
- **Absent.** No testimonials, no usage metrics, no public audience: the product is private. Never fabricate any of them.

## Product Principles

1. **The Candidate decides.** The AI never validates, sends or marks Applied on its own; a Draft stays a Draft until the Candidate validates it.
2. **Nothing hidden from the Candidate.** What a run reads, and why, is visible and editable before it starts; a Version keeps the Inputs it was produced from.
3. **Sort before spending.** A Claude session is spent only on a Posting the Candidate kept (ADR-0018).
4. **A place to learn.** Reading and revising an Artifact is a first-class experience, not an afterthought to tracking.
5. **One word, one meaning.** The glossary's terms, in both Locales, everywhere.
