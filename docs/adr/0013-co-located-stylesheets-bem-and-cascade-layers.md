# The front's CSS is one stylesheet per component, in BEM, ordered by cascade layers

Spec #77 split `app.css`, a single stylesheet of over 1,100 lines where every Dumb, the buttons and the layout were mixed, cross-component selector lists styled the same button, and the cascade depended on line order. Every front ticket had appended its rules at the bottom. Each Dumb of `src/web/components/` that has styles now gets a same-named `.css` beside its `.tsx`, which alone imports it and which styles only its BEM block, named like the file (`badge.css` → `.badge`, `.badge__x`, `.badge--y`). What belongs to no component sits in short global stylesheets beside the root (tokens, base, layout, controls, utilities), imported by the entry stylesheet `app.css`, which declares the order once: `@layer vendor, tokens, base, layout, components, utilities;`. A rule wins by its layer before its specificity or its line. Stylelint and the architecture test check it, so the next ticket cannot append its styles to a global file.

- **Global stylesheets stay beside the root.** Hallmark's sloplint groups files by folder and does not follow JS imports: tokens and base must sit beside `app.css`, which keeps the Hallmark stamp at its head.
- **Leaflet goes in the `vendor` layer**, imported by `app.css`, not by the map component: CSS outside a layer beats every layered rule and would override the map's own rules.
- **Containers and routes carry no stylesheet** (ADR-0008): their look comes from the Dumbs they render, the layout and the controls.
- **States go through `data-*` and ARIA attributes**, never a state class. Shared looks (`.button`, form controls) are CSS primitives in `controls.css`, applied by `className`, not a React component.

## Considered Options

- **CSS Modules.** Rejected: hashed class names break the link between a class in the DOM and the file that styles it, and the scoping they bring is what the block-equals-file rule already gives, checked by the test.
- **Tailwind.** Rejected: rewriting every component's markup for a refactor that must not change the rendering, and the design tokens would move into its config.
- **One global stylesheet per theme (buttons, forms, cards…).** Rejected: a component's look stays spread over several files, and a new component still has no obvious home but the bottom of one of them, which is how `app.css` grew.

## Consequences

- A component stylesheet only loads on the pages whose module graph imports its `.tsx`: a component that borrows another block's class looks right on one page and broken on another. The architecture test forbids it; a shared look goes in `controls.css` or `layout.css`.
- Renaming a component moves its stylesheet and renames its block with it.
- `!important` is allowed only in base and utilities (the reduced-motion reset, `[hidden]`), which must beat every layer.
