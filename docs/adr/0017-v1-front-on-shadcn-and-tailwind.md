# The V1 front is an orchestration of shadcn components on Tailwind, and needs JavaScript

The POC front grew feature by feature with hand-made Dumbs styled in BEM (ADR-0013), and both its design and its workflows lack clarity. The V1 rewrites it as an orchestration of shadcn components, styled with Tailwind v4 and shadcn's CSS-variable tokens; a custom component is written only when shadcn covers no part of the need, and then in shadcn's spirit (composition of its primitives, `cn()`, variants). Since shadcn's interactive components (Dialog, Select, Popover, Sheet, Command) are built on Radix and do not work before hydration, the front no longer has to be usable without JavaScript: data still comes from SSR `loader`s and mutations still go through `<Form>` and `useFetcher` (ADR-0008), but interactivity may require hydration. This only holds because the front serves two people on the LAN and the VPN (ADR-0002), on modern browsers.

The V1 is designed desktop-first, with mobile kept usable for occasional consultation, and lands as one big-bang branch: two users can afford it.

## Considered Options

- **shadcn for behaviour only, restyled in BEM.** Rejected: it fights the library, and throws away the very consistency it is chosen for.
- **Strict progressive enhancement, using only the components that degrade cleanly.** Rejected: it forbids half of the catalogue for a guarantee no user of this front needs.
- **Page-by-page delivery on `main`, Tailwind and the BEM stylesheets coexisting.** Rejected: two styling systems at once, for a live app with two users who can wait for one switch.

## Consequences

- ADR-0013 is superseded: the per-component stylesheets, the cascade layers, their Stylelint rules and their architecture test go away with the BEM.
- ADR-0008 still holds for where data is loaded and actions run; only its "works before hydration" motive is dropped.
