# Prototype V1 (throwaway, branch `prototype/v1-ux`, never merged)

The V1 front of `DECISIONS.md` (read it first) on real data, read-only. shadcn + Tailwind v4, French copy hard-coded, no tests, no i18n.

## Run

`mise run prototype` serves this worktree on port 5182, open to the LAN: <http://localhost:5182/prototype> (`/prototype` redirects to `/prototype/new`). It reads `data/`, a snapshot of the live database and Artifact files, through the read actions only; `JF_PROTOTYPE=1` leaves out every Notification Channel and Source, so nothing can notify anyone or query a job site. No worker runs: no Claude session ever starts. Vite reloads on save; a dependency missing from `optimizeDeps.include` (`vite.config.ts`) reloads the first page mid-hydration.

## Who owns what

| Agent            | Files                                                                                |
| ---------------- | ------------------------------------------------------------------------------------ |
| Lists            | `lists.tsx` (the 3 routes New, To Apply, Applications: one module, tell by pathname) |
| Posting page     | `posting.tsx`, `revision.tsx`, `mdx-catalogue.tsx`                                   |
| Generation panel | `generation-panel.tsx` (keep its signature: `artifact posting interview? onClose`)   |

Put your own extra files in a folder of your area (`lists/`, `posting/`, `panel/`). Everything else is the shared foundation: `layout.tsx`, `shell.tsx`, `page-header.tsx`, `store.ts`, `model.ts`, `data.server.ts`, `mdx.tsx`, `prototype-switcher.tsx`, `theme-toggle.tsx`, `placeholder.tsx` (Profile, Watches, Settings), `tailwind.css`, `components/ui/`, `lib/`, `hooks/`. Need a change there, a new route or a new dependency: ask the coordinator, never `npm install` yourself.

## Data

- `model.ts`: the view models (`IPosting`, `IPostingDetail`, `IArtifact`, `IVersion`…), French labels (`STEP_LABEL`, `ARTIFACT_LABEL`…), rules (`stepOf`, `listOf`, `nextInterviewOf`, `listInputs`) and formatting (`formatDate`, `formatCountdown`, Paris time).
- `data.server.ts`: the layout loads every Posting of the Candidate with its Job Description, Watches, Profile documents, Instructions and Input rules; `posting.tsx` and `revision.tsx` load the Posting's Artifacts with every Version's text (`loadPostingDetail`). Snapshot mapping: a To Apply Posting with no Research Version is New; the Chosen Version is Validated, a newer one a Draft; a Letter's `draft.md` is its Original (none: brought by the Candidate); Start Date from « Date de vacance de l'emploi ». The Visualization is gone.
- `store.ts` overlays the stubbed mutations (API at the top of the file): `usePrototype`, `usePostings`, `usePosting`, `usePostingDetail(reference, loaderDetail)`, `useInputs`, `useInstructions`, `useRuns`, `useDetection`, `useActions` → `keep`, `dismiss`, `setStatus`, `archive`, `unarchive`, `saveNotes`, `saveInterview`, `deleteInterview`, `validateVersion`, `addVersion`, `editVersion`, `saveInstructions`, `addCustomArtifact`, `startGeneration`, `startDetection`. Each is async (fake latency, for pending buttons) and toasts. A reload forgets everything.

## Building blocks

- shadcn first, from `#/web/prototype/components/ui/*.tsx` (all installed); `cn()` from `#/web/prototype/lib/utils.ts`. Import with the `#/` alias and the file extension. Icons: `lucide-react`. Long text: `prose dark:prose-invert` (Tailwind Typography).
- `<PageHeader title description actions />` (`page-header.tsx`) opens every page of the shell.
- Variants: `const variant = usePrototypeVariant('variant', VARIANTS)` and `<PrototypeSwitcher variants={VARIANTS} label="Liste" />`; a second switcher on the same page (the panel) uses `param="panel" keys="shift+arrows"`.
- MDX: `<Mdx source={text} components={MDX_CATALOGUE} className="prose dark:prose-invert" />` (`mdx.tsx`). Imports, exports, `{…}` expressions and non-string attributes are stripped; an unknown component renders a discreet error block. The Letter is plain Markdown: `react-markdown` + `remark-gfm`.
- Browser-only libraries render inside `<ClientOnly>` (`lib/client-only.tsx`): `@mdxeditor/editor` (React 19 supported, no SSR; its CSS is already in `tailwind.css`), `mermaid` (`await import('mermaid')` in an effect), Leaflet (as `src/web/components/posting-map.tsx`; CSS already loaded).
- Theme: `next-themes` (class strategy); the toggle sits at the Sidebar's foot (`<ThemeToggle />` elsewhere).

## Agent eyes

```sh
node /private/tmp/claude-501/-Users-mac-mini-vincent-lab-job-finder/fa611cb6-e51e-4b55-9f0e-1c026d65146f/scratchpad/puppeteer/screenshot.mjs \
  'http://localhost:5182/prototype/new?variant=B' /path/out.png [--width 1440] [--height 900] [--full] [--dark] [--hover <sel>] [--click <sel>] [--wait <ms>]
```

It waits for `html[data-hydrated]`, then prints the page's console errors and failed requests. In a script, `window.__prototype.actions` drives the store (e.g. `startDetection()`).

## Conventions

- French UI copy, hard-coded; code, comments and file names in English, with the terms of `GLOSSARY.md`.
- Never write to the database or `data/`: every mutation goes through the store.
- The typecheck (`npx tsc`, in the pre-commit hook) covers the prototype: keep it green. ESLint, Stylelint, cspell and Knip skip `src/web/prototype/**`.
- Commits: `feat(prototype): Sentence-case subject`, with the Co-Authored-By trailer; never `--no-verify`. The hook's Prettier pass may leave its fixes unstaged: after committing, if `git status` shows them, `git add -u && git commit --amend --no-edit`.
