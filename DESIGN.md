---
name: Job Finder
description: A Candidate's copilot to sort job Postings on a map, prepare each Application with the AI, and revise before the Interview.
colors:
  background: 'oklch(1 0 0)'
  foreground: 'oklch(0.145 0 0)'
  card: 'oklch(1 0 0)'
  muted: 'oklch(0.97 0 0)'
  muted-foreground: 'oklch(0.556 0 0)'
  border: 'oklch(0.922 0 0)'
  sidebar: 'oklch(0.985 0 0)'
  sidebar-accent: 'oklch(0.955 0 0)'
  primary: 'oklch(0.488 0.217 264.376)'
  primary-foreground: 'oklch(0.985 0 0)'
  ring: 'oklch(0.488 0.217 264.376 / 55%)'
  destructive: 'oklch(0.577 0.245 27.325)'
  dark-background: 'oklch(0.145 0 0)'
  dark-foreground: 'oklch(0.985 0 0)'
  dark-card: 'oklch(0.205 0 0)'
  dark-muted: 'oklch(0.269 0 0)'
  dark-muted-foreground: 'oklch(0.708 0 0)'
  dark-border: 'oklch(1 0 0 / 10%)'
  dark-primary: 'oklch(0.68 0.17 258)'
  dark-primary-foreground: 'oklch(0.145 0 0)'
  dark-destructive: 'oklch(0.704 0.191 22.216)'
  draft: '{colors.primary}'
  validated: 'oklch(59.6% 0.145 163.225)'
  pending: 'oklch(76.9% 0.188 70.08)'
  urgency-week: 'oklch(64.5% 0.246 16.439)'
  step-applied: 'oklch(68.5% 0.169 237.323)'
  step-invited: 'oklch(60.6% 0.25 292.717)'
  step-interviewed: 'oklch(58.5% 0.233 277.117)'
  step-closed: 'oklch(55.2% 0.016 285.938)'
  substituted-value: 'oklch(59.1% 0.293 322.896)'
typography:
  display:
    fontFamily: "'Inter Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: '3rem'
    fontWeight: 600
    lineHeight: 1
    letterSpacing: '-0.025em'
  headline:
    fontFamily: "'Inter Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: '1.7rem'
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: '-0.025em'
  title:
    fontFamily: "'Inter Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: '1.25rem'
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "'Inter Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: '0.875rem'
    fontWeight: 400
    lineHeight: 1.43
  reading:
    fontFamily: "'Inter Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: '1.0625rem'
    fontWeight: 400
    lineHeight: 1.75
  label:
    fontFamily: "'Inter Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: '0.75rem'
    fontWeight: 500
    lineHeight: 1.33
    letterSpacing: '0.025em'
  mono:
    fontFamily: 'ui-monospace, SFMono-Regular, monospace'
    fontSize: '0.6875rem'
    fontWeight: 400
rounded:
  sm: '6px'
  md: '8px'
  lg: '10px'
  xl: '14px'
  2xl: '18px'
  4xl: '26px'
spacing:
  '1': '4px'
  '2': '8px'
  '3': '12px'
  '4': '16px'
  '5': '20px'
  '6': '24px'
  '8': '32px'
  '10': '40px'
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.primary-foreground}'
    rounded: '{rounded.md}'
    height: '36px'
    padding: '0 10px'
  button-outline:
    backgroundColor: '{colors.background}'
    textColor: '{colors.foreground}'
    rounded: '{rounded.md}'
    height: '36px'
    padding: '0 10px'
  button-ghost:
    textColor: '{colors.foreground}'
    rounded: '{rounded.md}'
    height: '36px'
    padding: '0 10px'
  button-destructive:
    backgroundColor: 'oklch(0.577 0.245 27.325 / 10%)'
    textColor: '{colors.destructive}'
    rounded: '{rounded.md}'
    height: '36px'
    padding: '0 10px'
  badge:
    rounded: '{rounded.4xl}'
    height: '20px'
    padding: '2px 8px'
  input:
    textColor: '{colors.foreground}'
    rounded: '{rounded.md}'
    height: '36px'
    padding: '4px 10px'
  card:
    backgroundColor: '{colors.card}'
    textColor: '{colors.foreground}'
    rounded: '{rounded.xl}'
    padding: '24px'
  sidebar:
    backgroundColor: '{colors.sidebar}'
    textColor: '{colors.foreground}'
    width: '16rem'
  list-panel:
    backgroundColor: '{colors.background}'
    rounded: '{rounded.xl}'
    width: '400px'
  posting-sheet:
    backgroundColor: '{colors.background}'
    width: '30rem'
  draft-banner:
    backgroundColor: 'oklch(0.488 0.217 264.376 / 5%)'
    textColor: '{colors.foreground}'
    rounded: '{rounded.xl}'
    padding: '16px'
  generation-dialog:
    backgroundColor: '{colors.background}'
    rounded: '{rounded.xl}'
    width: '768px'
  substituted-value:
    backgroundColor: 'oklch(59.1% 0.293 322.896 / 12%)'
    rounded: '3px'
    padding: '0 2px'
---

# Design System: Job Finder

Derived on 2026-11-02 from the shipped code and the rendering, light and dark, of the V1 prototype the product owner validated (branch `prototype/v1-ux`, `src/web/prototype/`, its `DECISIONS.md` and Verdicts). The prototype is the visual authority; the POC pages still on this branch (BEM stylesheets quarantined in the `poc` cascade layer) are an anti-reference. Product truth lives in `PRODUCT.md`; French UI copy is quoted in « ».

## Overview

**Creative North Star: "The Copilot's Study"**

A calm, neutral workroom where the Candidate stays in charge. The map tells where the Postings are; the lists float over it, grouped by what needs attention first; every document the AI drafts is read on a well-set column, annotated in the margin and signed off by the Candidate. The interface is shadcn's neutral base with a single blue accent: brand lives in precision, in the state colors that always mean the same thing, and in how plainly the tool shows what the AI reads.

Density is that of a working tool, desktop-first: 14px UI text, 36px controls, sticky headers, side Sheets instead of page changes. Reading is the exception, and it is generous: 16px prose at a 1.75 line height on a 70 to 72 character column. Light and dark modes are equals; dark mode is neutral grey, never blue-tinted.

The rejected look is the POC's: its DM Mono labels, dashed stubs, "plastic compartment" Artifacts and green Dose theme do not carry over.

**Key Characteristics:**

- Neutral greys plus one blue accent; other hues only encode a state.
- Map first for every list; the list is a translucent floating panel.
- One primary action per header; everything else in an outline button or the `⋯` menu.
- A Draft is always loud: a banner with its « Valider » button.
- Reading mode with a numbered rail, a ~72ch column and margin notes.
- What the AI reads is shown before every run, substituted values highlighted.

## Colors

A neutral shadcn base (achromatic OKLCH greys) with one saturated blue, plus a small set of state hues taken from Tailwind's palette.

### Primary

- **Copilot Blue** (`primary`, `dark-primary` in dark mode): the one accent. The primary button of a view, the active Sidebar badge, the New count, links, the focus ring (at 55 to 60%), the active rail step, the map pin icon before each City, and every Draft that waits for validation (its dot, badge, banner and « Valider » button), wherever it shows: the `draft` token. In dark mode it is lighter, with `dark-primary-foreground` (near-black) text on it, so both blue text on the dark surfaces and text on a blue fill reach 4.5:1 (white on the former dark blue read 4.1:1).

### Neutral

- **Paper White** (`background`, `card`): page and card surfaces in light mode.
- **Ink** (`foreground`): text and icons; titles never use another color.
- **Mist** (`muted`, `sidebar`, `sidebar-accent`): group headers, hover fills, the active Sidebar item, quiet notices (`muted` at 50%).
- **Pencil Grey** (`muted-foreground`): secondary lines, employers, hints, counts.
- **Hairline** (`border`): every 1px divider and control border; white at 10% in dark mode.
- **Night** (`dark-background`, `dark-card`, `dark-muted`): dark mode lifts each layer by lightness alone (0.145 → 0.205 → 0.269).

### State hues

They are the only other colors on screen, and each always means the same state. They are semantic tokens of `src/web/app.css`, each with a `-foreground` text shade (Tailwind classes `bg-validated/10 text-validated-foreground`…), never raw palette classes.

- **Draft Blue** (`draft`, the `primary`): a Draft, everywhere: the Posting page, the list chips and the Sheet.
- **Validated Green** (`validated`, emerald): a Validated Version, a Hired outcome, a finished step, the « tip » Callout.
- **Pending Amber** (`pending`, amber): a Deadline within the month, unsaved Instructions, the « warning » Callout.
- **Week Red** (`urgency-week`, rose): a Deadline within seven days.
- **Applied Sky** (`step-applied`, sky): the Applied Step, and the Repost notice.
- **Invited Violet** (`step-invited`, violet): the Invited Step.
- **Interviewed Indigo** (`step-interviewed`, indigo): the Interviewed Step.
- **Closed Zinc** (`step-closed`, zinc): Rejected, a passed or missing Deadline.
- **Substitution Fuchsia** (`substituted`, fuchsia): a value the tool substituted into a Prompt's Fixed Part; never violet, which is Invited's.
- **Destructive Red** (`destructive`): failures, blockers and destructive confirmations only; it is never a state hue.

Tints follow one recipe: a 10 to 12% fill of the hue, its 700 shade for text (300 in dark mode), and a 25 to 40% border when the element has one.

### Named Rules

**The One Accent Rule.** Blue is the only brand color. A second accent never appears; a new need for emphasis uses weight, size or position first.

**The State Hue Rule.** A non-neutral hue other than blue always encodes a state from the glossary, and always comes with its label or icon: a colored dot or chip never stands alone.

### Settled by the V1

- One Draft hue: blue, the accent, wherever a Draft shows; the prototype's amber Draft chip in the lists and the Sheet is gone.
- A substituted value is fuchsia, no longer Invited's violet.
- Dark `primary` reaches 4.5:1 as text and under its `primary-foreground`.

### Open in the prototype

- The Step badge is a neutral `secondary` badge in the Posting header but a tinted one in the Sheet.

## Typography

**Display Font:** Inter Variable (with ui-sans-serif, system-ui)
**Body Font:** Inter Variable
**Label/Mono Font:** the system monospace, for a Posting's reference only

**Character:** one neutral grotesque for everything, set tight in headings and loose in reading. Hierarchy comes from weight (400, 500, 600) and size, never from a second family.

### Hierarchy

Each step is distinct from the next, 12, 14, 17 then 20px for label, body, reading and title (a flat 12/14/16 before the V1); each is a Tailwind `text-*` token with its line height.

- **Display** (600, 3rem, tabular figures): the countdown of the Revision header only; 2.25rem below `sm`.
- **Headline** (600, 1.7rem, line height 1.25, tracking -0.025em): the title of an Artifact in reading mode. Its h2 is 1.35rem with 3.5rem above, its h3 1.08rem. The Revision header's date is 1.875rem.
- **Title** (600, 1.25rem, `text-title`): the Sheet's title, a Dialog's title, an Interview's date. A page header's title is 1rem semibold with a 0.875rem muted description line, both truncated to one line.
- **Body** (400 or 500, 0.875rem, `text-body`): all UI text, rows, buttons, menus. Secondary lines are 0.75rem muted.
- **Reading** (400, 1.0625rem, line height 1.75, `text-reading`): Artifacts through Tailwind Typography (`prose prose-neutral dark:prose-invert`), at most 72ch. The Letter reads larger, `prose-lg` (1.125rem), as a page.
- **Label** (500, 0.75rem, `text-label`, uppercase, tracking 0.025em, muted): the small capital headings of the Sheet and the panels (« Documents », « Contacts »). In primary for the Revision header's eyebrow line.
- **Mono** (0.6875rem, muted): the Posting's reference in the Sheet's corner.

### Named Rules

**The Tabular Rule.** Every count, percentage, countdown and word count uses tabular figures (`tabular-nums`).

**The Reading Column Rule.** Long text never exceeds 72ch; UI text is never set at the reading size.

## Layout

The app shell is a shadcn Sidebar (16rem, collapsible to a 3rem icon rail) beside the page. Each page opens with a sticky header at least 56px tall: the Sidebar trigger, a vertical separator, the title and its one-line description, then the actions on the right. Headers and floating surfaces are translucent (`background` at 95%, 80% where `backdrop-filter` is supported) with a backdrop blur.

- **Lists (New, To Apply, Applications):** the map fills the page under the header. The list floats over it in a 400px panel inset 12px from the edges, folding into an outline button. The Posting Sheet opens on the right (30rem); the map centers the selected Posting in what stays visible.
- **Posting page:** a centered container up to 96rem, padded 16, 24 then 32px (`sm`, `lg`), 96px at the bottom; tabs right under the header, content 24px below them.
- **Reading:** a container-query grid: a 12rem rail, the column, and a 16rem margin from `@6xl`; the margin folds into a Sheet below `@6xl`, the rail into a sticky progress line below `@3xl`.
- **Revision:** full-screen, out of the Sidebar, with its own sticky header and a hero card on top.
- **Mobile (below 768px):** the map is the main surface and the list a bottom drawer pulled up through snap points (vaul); header actions become icon buttons; the Sheet takes the full width.

Spacing follows Tailwind's 4px step: 8 to 12px inside rows and controls, 16 to 24px inside cards and panels, 24 to 40px between sections, 56px above a reading h2. Toolbars and readers react to their container (`@container`, `@xl` to `@6xl`), not to the viewport.

## Elevation & Depth

Flat by default, separated by hairlines. Shadows mark only what floats above the page, and grow with distance: a 1px whisper on cards and outline buttons, a large soft shadow on the panel floating over the map, the largest on the Sheet. In dark mode the shadows fade and the lighter card surface (`dark-card`) carries the separation.

### Shadow Vocabulary

- **Whisper** (`box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)`): cards, outline buttons, inputs, the Letter's page.
- **Float** (`box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)`): the list panel over the map; its folded button takes the next size down (`shadow-lg`).
- **Sheet** (`box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25)`): the Posting Sheet.
- **Drawer** (`box-shadow: 0 -8px 30px rgb(0 0 0 / 0.12)`): the mobile list drawer, cast upward.
- **Marker** (`box-shadow: 0 1px 3px rgb(0 0 0 / 0.45)`): a map marker, with a 2px white ring; hover and selection add a halo of `foreground` at 22%.

### Named Rules

**The Float-Only Rule.** A shadow larger than Whisper means the surface floats over the map or the page; content inside the page never gets one.

## Shapes

Gently rounded throughout from one base radius (10px): 8px controls (buttons, inputs, selects, rows), 14px cards, panels and dialogs, 18px for the Revision hero and empty states, full pills for badges and Artifact chips, circles for map markers and numbered steps. Borders are 1px hairlines; the only thicker strokes are the 3px inset bar of the selected list row and the 2px white ring of a marker. Empty states use a dashed border.

## Components

### Buttons

- **Shape:** 8px radius (6px for `xs`), 36px tall by default, 32px `sm`, 24px `xs`; 16px Lucide icons before the label.
- **Primary:** `primary` fill, `primary-foreground` text; hover at 80%; one per view.
- **Outline:** `background` fill, hairline border, Whisper shadow; hover `muted`. The default for secondary actions.
- **Ghost:** no fill; hover `muted`. Toolbar icons and low-priority actions (« Archiver »).
- **Destructive:** soft red fill (`destructive` at 10%) with red text, never a solid red block.
- **States:** a 3px focus ring of `ring` at 50%; a 1px press offset; a pending action swaps its icon for a spinning loader and disables the button.

### Badges and chips

- **Badge:** a 20px pill, 12px medium text. `secondary` for neutral states, `outline` for quiet ones, a state tint for Steps.
- **Artifact chips:** in list rows, « R » and « LM » pills (Research, Letter) in outline; Validated adds a check and the green tint, a Draft a blue dot.
- **Version state:** a Draft is an outline badge in `primary` with a 6px dot (« Brouillon »); the Chosen Version a `secondary` badge with a check (« Validée · retenue »).

### Cards / Containers

- **Corner Style:** 14px.
- **Background:** `card`, with a 10% `foreground` ring instead of a border.
- **Shadow Strategy:** Whisper only.
- **Internal Padding:** 24px, 16px for the `sm` size.

### Inputs / Fields

- **Style:** 36px, 8px radius, `input` border, transparent fill (`input` at 30% in dark mode), Whisper shadow.
- **Focus:** the border turns `ring` with a 3px ring at 50%.
- **Error / Disabled:** a red border and red ring at 20%; disabled at 50% opacity.

### Navigation (Sidebar)

The Candidate switcher heads it: a 32px rounded-square avatar in `primary` with the initial, the name and « Candidat », a chevron opening the Candidates menu; switching keeps the page. Below, New, To Apply and Applications, New carrying a `primary` pill with the count to sort; a separator; Profile, Watches, Settings. The active item takes `sidebar-accent`. The footer holds the Locale Switcher (FR and EN, the current one in `secondary`) and the theme toggle on its right. Collapsed, only icons remain, with tooltips, and the footer stacks.

### Map-first list (signature)

The map is the ground: Leaflet tiles quieted (saturation 45%; inverted and dimmed in dark mode), colored markers, and a legend pill in the bottom-right corner. The floating panel holds the list's name and count, the Applications tabs (In progress, Hired, Rejected, with counts), stacked filters (City, Region, Archived, the count of Postings), then the groups: New and To Apply by Deadline urgency (this week, within the month, later, passed), Applications by Step (Interviewed, Invited, Applied), each with its own sort. A sticky group header (`muted` at 95%, 12px semibold, count, hint on the right) tops each group. A row leads with the City (primary pin, semibold), then the employer (muted, truncated), the title on one line, and a meta line: date, colored countdown, Artifact chips. New rows carry an outline « × » (dismiss) and a primary « ✓ » (keep). The selected row takes a 7% `primary` fill and a 3px inset bar on the left. Hovering a row highlights its marker; clicking either opens the Sheet, which lives in the URL.

### Posting Sheet (signature)

A right Sheet, 30rem, full width on a phone. Header: the Step badge, the reference in mono in the corner, the title (Title size, balanced), the employer, then facts with icons: City · Region, Deadline with its countdown, Start Date. Then one actions row by Step (its primary, its outline, a ghost « Archiver » on the right), and sections under Label headings: Documents (one row per Artifact with its state and a chevron that nudges on hover, opening the matching tab), Contacts, the Job Description in a scrolling box (`muted` at 30%, small prose), Notes editable in place. A Repost shows as a sky-tinted notice. The footer holds a full-width outline « Ouvrir la page complète ».

### Posting page

The header carries the title, a one-line « employer · City · Deadline », the Step badge, ONE primary action by Step (« Indiquer le résultat ▾ », « Marquer Postulée »…) and a `⋯` menu (Archive, the Source, the Repost). Underline tabs follow the workflow: Offer, Research, Letter, Interviews (with a count), Notes. Each Artifact tab shows a 6px state dot: blue for a Draft, green for Validated, faint grey for none. Interviews are master-detail: Interview cards on the left (the selected one with a `primary` ring), the selected Interview on the right with its own Brief and Portrait tabs and a primary « Réviser l'Entretien ».

### Artifact toolbar and Draft banner (signature)

One line: the Version Select (« Version 3 · Brouillon »), the Version's state badge, then on the right a segmented Read | Edit | Compare to the Original, « Ajouter la mienne », « Générer » or « Régénérer » (with a sparkles icon), and focus mode, which collapses the Sidebar. Buttons fold into a `⋯` menu as the container narrows. Under it, a 12px provenance line: « Produite le … à partir de : » followed by one small outline chip per Input. A Draft always brings the banner: 14px radius, `primary` border at 30% and fill at 5%, a semibold « Version N en Brouillon : relis-la, puis valide-la », a muted line saying no other Artifact reads it meanwhile, and a primary « Valider la Version N ». A frozen Letter shows a muted bar with a lock instead; a running generation, a `primary`-tinted card with a spinner, its phase and a 6px progress bar.

### Reading mode, rail and margin (signature)

The rail: « Progression » with its percentage over a 4px progress bar, then numbered sections (20px circles: filled `primary` for the current one, a check in `primary` for the read ones, muted outline ahead; the current row on `muted`). The column: a reading-time line (« ≈ 3 min de lecture · 6 sections »), then the Artifact at Reading size. The margin: one note card per section (« Note de marge », the section's name, a textarea). The Letter reads as a page instead: a card with 48px padding at `sm` and up, the recipients above it. MDX components come from a closed catalogue on shadcn; a Callout tints its border (25 to 35%) and fill (4 to 6%) with its type's hue (note neutral, info blue, tip green, warning amber, danger red) while its text stays `foreground`.

### Generation panel, three steps (signature)

Clicking « Générer » never runs: it opens a Dialog (768px wide, as tall as `min(760px, 100svh - 9rem)`), with a header (title, the Posting's title muted, then a stepper: « Ce que Claude lit » → « Comment il écrit » → « Récapitulatif »; 24px numbered circles joined by hairlines, a check once passed), a scrolling body and a footer on `muted` at 30% with the running total (« 13 documents · 12 059 mots · 2 à 4 min ») and Back or Cancel beside a primary Continue, then « Lancer ». Step 1 lists the Inputs in two columns, the Posting's and the Profile's: one bordered row each, a lock for a required one or a checkbox, an icon, the label with its word count, and an eye that previews its exact content. A blocker shows as a red-titled box above them. Step 2 shows the Instructions in an editable textarea under a « Consignes par défaut » badge, and the Fixed Part folded, marked « non modifiable ».

### Substituted values (signature)

Inside the Fixed Part, each value the tool substituted (reference, title, employer, place, file paths, Interview details) is a `mark`: fuchsia at 12%, fuchsia text (`substituted-foreground`: 700 shade light, 300 dark), a 1px inset fuchsia ring at 30%, a 3px radius. A legend chip above the text reads « surligné : remplacé automatiquement pour cette Offre ».

### Revision header

A sticky header with a back arrow, « Réviser l'Entretien N », the Posting's title in small muted text, a countdown chip and ghost links to the Portrait, the Offer and the Letter. Under it, the hero card: 18px radius, a faint `primary` wash (7%) fading into `card` toward the bottom right, an eyebrow line in `primary` (« Entretien 1 · 30 min »), the date at 1.875rem, place and Interviewers with icons, and the countdown at Display size on the right (« Passé » once over).

### Feedback

- **Toasts:** Sonner, bottom-right, with a close button; every mutation ends in one: its success, or the message of the Error Code it was refused with. A Container posts it through a fetcher and `useFeedback` (`src/web/containers/use-feedback.ts`); its button takes `isPending` meanwhile.
- **Confirmation:** an AlertDialog before every destructive action (archive, delete an Interview), its confirm button in the Destructive style. Marking Applied while the Letter is a Draft offers two paths: « Valider la Lettre de motivation et marquer Postulée » or « Marquer Postulée sans Lettre de motivation ».
- **Empty state:** a dashed 18px card, a 44px `muted` circle with a sparkles icon, a title, one line on what the Artifact is for, and its actions.

## Do's and Don'ts

### Do:

- **Do** build from shadcn components and their CSS-variable tokens (ADR-0017); write a custom component only where shadcn covers nothing, the map being the example.
- **Do** keep one primary button per header or panel; the rest go in outline buttons or the `⋯` menu.
- **Do** show every Draft with its banner and its « Valider la Version N »: validation must never be a hidden step.
- **Do** show what a run reads before it starts, every Input with a preview, substituted values marked.
- **Do** pair every state hue with its label or icon, in both modes.
- **Do** confirm every destructive action in an AlertDialog and end every mutation in a toast.
- **Do** check every screen in light and dark mode, and at 390px for the lists.
- **Do** name the Letter « Lettre de motivation » in full in the French UI.

### Don't:

- **Don't** reuse the POC's look: no DM Mono labels, dashed stubs, "plastic compartment" Artifacts, or its green Dose palette.
- **Don't** add a second accent color or use a state hue for decoration.
- **Don't** set reading text wider than 72ch, nor UI text at the reading size.
- **Don't** put a shadow larger than Whisper on anything that does not float.
- **Don't** run a generation straight from a button: « Générer » always opens the panel.
- **Don't** use solid red buttons; destructive stays the soft red tint.
