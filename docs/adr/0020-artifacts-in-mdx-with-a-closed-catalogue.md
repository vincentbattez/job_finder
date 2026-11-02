# Artifacts are written in MDX with a closed catalogue of shadcn components, which replaces the Visualization

The front becomes the Candidate's space to revise before an Interview, and plain Markdown reads like a wall of text, which is why the Visualization existed: a second, HTML rendering of the Interview Brief, generated apart and shown in a sandboxed frame. The Research, the Portrait, the Interview Brief and the Custom Artifacts are now written in MDX, from a closed catalogue of components built on shadcn (Callout, Tabs, Accordion, Card, Badge, Table, Steps, Quote, Checklist, a Mermaid Diagram) that the Fixed Part lists to the AI; the Interview Brief is itself the page to revise with, and the Visualization goes away with its module. The Letter stays plain Markdown, since it leaves for the employer. Since MDX is code, imports, exports and JavaScript expressions are stripped at compile time, and a component outside the catalogue renders as a discreet error block. The Candidate edits it in MDXEditor, a WYSIWYG that edits the catalogue's components.

## Considered Options

- **Keep the Visualization beside a Markdown Interview Brief.** Rejected: two renderings of the same content, one more AI run, and an HTML page the Candidate cannot correct.
- **Markdown with directives (`:::callout`).** Rejected: fewer layouts, and the WYSIWYG editors handle JSX components better than directives.
- **Plate as the editor, in shadcn's registry.** Kept as the fallback should MDXEditor not fit React 19 or Tailwind theming.

## Consequences

- Existing Markdown Artifacts stay valid MDX, except for characters MDX reads as syntax (`{`, `<`), which a migration escapes.
- Adding a component to the catalogue means its shadcn rendering, its MDXEditor descriptor and its line in the Fixed Part.
