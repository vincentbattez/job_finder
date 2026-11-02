# V1 UX redesign: decisions to prototype (PROTOTYPE, throwaway branch `prototype/v1-ux`)

Grilled with the user on 2026-11-02. Vocabulary: `GLOSSARY.md`. Architecture: ADR-0017 (shadcn + Tailwind v4, hydration required, desktop-first), ADR-0018 (New + sorting, no Zone), ADR-0019 (Draft is a state of every Version), ADR-0020 (MDX with a closed shadcn catalogue, no Visualization). The prototype answers "does this workflow and rendering match what the user wants?" before the V1 is coded.

## Prototype rules

- Throwaway: everything lives under `src/web/prototype/` and routes `/prototype/*`. No tests, no i18n (UI copy in French, hard-coded), no error handling beyond running.
- Real data, read-only: `data/` in this worktree is a snapshot copy of the live database. Mutations are stubbed in an in-memory store (clicking "Garder" moves the row; the database is never written).
- shadcn components first; custom only where shadcn covers nothing (the map), in shadcn's spirit (`cn()`, composition, variants).
- Light and dark modes, base shadcn theme (neutral) with one accent color.
- Variants (`?variant=A|B|C`, floating switcher, per the `prototype` skill UI.md) only on three areas: list + map layout, Artifact reading / Revision, generation panel. Everything else is the single decided version.

## Navigation

- shadcn Sidebar: Candidate switcher at its head (switching keeps the current page); entries New (badge = count to sort), To Apply, Applications; separator; Profile, Watches, Settings (out of prototype scope: placeholder pages). No Home: the app opens on New.
- Detection and Import live in the header of New. Detection progress shows live in a collapsible Card under the header, one line per Watch; found Postings appear on top of the list. Near Misses are shown on the Watches page, under each Watch; the Detection result links there.
- Feedback: Sonner toast on every mutation (success or failure), pending state on buttons, AlertDialog for every destructive action.

## Lists (New, To Apply, Applications)

- Same layout everywhere: list + sticky map side by side. Hovering a row highlights its marker; hovering or clicking a marker highlights the row and scrolls the list to it.
- Columns:
  - New: Title · Employer · City · Published · Deadline · Repost · [Garder] [Écarter] on the row.
  - To Apply: Title · City · Deadline (with countdown) · Start Date · Research/Letter state.
  - Applications: Title · City · Step · Next Interview · Applied on. Tabs In progress | Hired | Rejected.
- Common filters: City, Region, Archived.
- Clicking a row opens a side Sheet (more info fast, a few actions, no page change), top to bottom: title, employer, City, Deadline, Start Date, Step badge; Repost info ("Repost · Nth publication of this Position since <date>", and when the Candidate applied to an earlier Posting of the same Position: "Tu as postulé le <date> · <outcome>"); actions by Step (Garder/Écarter if New, Marquer Applied if To Apply, outcome if In progress, Archive always); one line per Artifact with its state (Research: Validated, Letter: Draft…) opening the matching tab; Contacts; Job Description scrolling; Notes editable in place; "Ouvrir la page complète".
- Mobile: the map is the main surface, the list is a bottom sheet the user drags up (AllTrails-like; shadcn Drawer / vaul snap points).

## Posting page

- Header: title, employer · City · Deadline, Step badge, ONE primary action depending on the Step, the rest in a `⋯` menu (Archive, open on the Source, Repost of…).
- Tabs following the workflow: Posting | Research | Letter | Interviews | Notes, plus a Documents section (Custom Artifacts of the Posting).
- Marking Applied while the Letter is a Draft: AlertDialog offering "Valider la Letter et marquer Applied" or "Marquer Applied sans Letter".

## Artifacts

- Per-Artifact toolbar: Version Select (`Version 3 · Validated ▾`), Draft/Validated badge, [Valider] on a Draft, [Générer / Regénérer], [Ajouter la mienne], [Comparer à l'Original] (side-by-side, shadcn Resizable; absent for a Version the Candidate brought).
- Every new Version (AI or Candidate) is a Draft until validated; validating makes it the Chosen Version; the previous Validated stays Chosen meanwhile. Only a Chosen Version is read by another Artifact. The validation step must be obvious in the UI.
- "Ajouter la mienne": paste text, drop a `.md`, or drop a PDF (converted). Not for the Interview Brief's former Visualization (gone).
- Reading mode by default: well-typeset MDX on a ~70-character column, sticky table of contents from the headings, collapsible Sidebar for focus. "Modifier" switches to MDXEditor (WYSIWYG). The Letter stays plain Markdown.
- MDX closed catalogue, all on shadcn: Callout (Alert), Tabs, Accordion, Card, Badge, Table, Steps/Timeline, Quote, Checklist, Diagram (Mermaid). No import/export/JS expressions; an unknown component renders as a discreet error block. Research, Portrait, Interview Brief and Custom Artifacts are MDX. Existing Artifacts are Markdown: for the prototype, hand-write one MDX Interview Brief (and optionally one Research) using the catalogue to show the target rendering.
- Interviews tab: master-detail; list of Interviews (date, place, Interviewers) on the left, the selected one on the right with Tabs Portrait | Interview Brief. Add/edit an Interview in a Dialog.
- Revision: a full-screen "Réviser l'Interview" per Interview: the Interview Brief full width, a countdown to the Interview, side access to the Portrait and the Posting. Learning-friendly, pleasant, clear.

## Generation panel (clicking "Générer" never runs directly)

- Opens a confirmation panel that explains in plain words what will happen (what Claude reads, does, writes, roughly how long), then lists the Inputs:
  - required ones locked, with a tooltip saying why (the Letter needs the Research; Profile-reading Artifacts require the CV and the Facts);
  - default ones checked and uncheckable (Chosen Versions of other Artifacts; each past Letter);
  - Annexes unchecked, addable on demand;
  - "+ Ajouter un texte ou un fichier": a Custom Artifact, created "Pour cette Posting" (Custom Artifact) or "Dans mon Profile" (Annex, reusable).
- Every Input has a preview of its exact content.
- Instructions shown and editable in place (editing them makes them the Candidate's Instructions for that Artifact type, persistently); the Fixed Part folded, read-only.
- Regenerating prefills the panel with the previous Version's Inputs; each Version shows "Produite à partir de : …".
- [Lancer] starts the run: simulated progress, then a new Draft Version appears.
- Variants to compare: Dialog vs Sheet vs a third structurally different form.

## Statuses

New → (Garder) To Apply / (Écarter) Archived. To Apply → Applied (In progress; Invited/Interviewed computed from Interviews) → Hired | Rejected. "Remettre en cours" removes an outcome. In the snapshot, there is no New yet: treat To Apply Postings with no Research Version as New.
