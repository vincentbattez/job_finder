import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it } from 'vitest';

import { i18nOf } from '#/actions/i18n.ts';

import { ArtifactText, type ArtifactTextFormat } from './artifact-text.tsx';

// Seam 3 of spec #125: an Artifact's text in, the HTML the server renders out (ADR-0020)
function htmlOf(text: string, format: ArtifactTextFormat = 'mdx', isRevising = false): string {
  return renderToStaticMarkup(
    createElement(I18nextProvider, { i18n: i18nOf('en') }, createElement(ArtifactText, { text, format, isRevising })),
  );
}

// The document's own content, without the wrapper every text gets
function bodyOf(text: string, format: ArtifactTextFormat = 'mdx'): string {
  return htmlOf(text, format)
    .replace(/^<div class="[^"]*">/u, '')
    .replace(/<\/div>$/u, '');
}

const NOT_COMPILED = 'Part of this text does not compile as MDX: it is shown as written.';

describe('Plain Markdown', () => {
  it('renders headings, emphasis, lists and links', () => {
    const html = htmlOf('## Company\n\nA **public** body.\n\n- one\n- two\n\n[site](https://example.org)');

    expect(html).toContain('<h2>Company</h2>');
    expect(html).toContain('<strong>public</strong>');
    expect(html).toContain('<li>one</li>');
    expect(html).toContain('<a href="https://example.org">site</a>');
  });

  it('styles a GitHub Markdown table in a frame that scrolls sideways', () => {
    const html = htmlOf('| Grade | Salary |\n| --- | --- |\n| B | 2 100 € |');

    expect(html).toMatch(/<div class="[^"]*overflow-x-auto[^"]*"><table[^>]*><thead/u);
    expect(html).toMatch(/<td[^>]*>2 100 €<\/td>/u);
  });

  it('keeps a code fence as code', () => {
    expect(htmlOf('```js\nconst a = 1;\n```')).toContain('<pre><code class="language-js">const a = 1;\n</code></pre>');
  });
});

describe('What MDX would run is stripped', () => {
  it('drops imports and exports', () => {
    expect(bodyOf("import data from './data.js'\nexport const title = 'x'\n\nKept.")).toBe('<p>Kept.</p>');
  });

  it('drops JavaScript expressions, inline and on their own line', () => {
    expect(bodyOf('Sum {1 + 1} here.\n\n{globalThis.alert(1)}')).toBe('<p>Sum  here.</p>');
  });

  it('drops the attributes that are not plain strings, spreads included', () => {
    const html = htmlOf('<Callout type={"danger"} title={"Injected"} {...props}>Body</Callout>');

    expect(html).not.toContain('Injected');
    expect(html).not.toContain('destructive');
    expect(html).toContain('Body');
  });

  it('drops every on* attribute', () => {
    const html = htmlOf('<Callout title="Kept" onClick="alert(1)">Body</Callout> <kbd onMouseOver="alert(2)">K</kbd>');

    expect(html).not.toContain('alert(');
    expect(html).toContain('Kept');
    expect(html).toContain('<kbd>K</kbd>');
  });

  it('keeps only the title of a safe HTML tag', () => {
    expect(bodyOf('A <span style="color: red" class="x" title="Hint">hint</span>.')).toBe(
      '<p>A <span title="Hint">hint</span>.</p>',
    );
  });
});

describe('What the catalogue does not know', () => {
  it('turns a component outside the catalogue into an error block that keeps its children', () => {
    const html = htmlOf('<Script>\n\nKept **child**\n\n</Script>');

    expect(html).toContain('Unknown component &lt;Script&gt;');
    expect(html).toContain('<p>Kept <strong>child</strong></p>');
  });

  it('turns an HTML tag outside the safe few into an error block', () => {
    const html = htmlOf('<iframe src="https://example.org">\n\ninside\n\n</iframe>');

    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('example.org');
    expect(html).toContain('Unknown component &lt;iframe&gt;');
    expect(html).toContain('inside');
  });

  it('keeps the error block inline within a line, so the paragraph stays valid', () => {
    expect(bodyOf('A <Widget>word</Widget> here.')).toMatch(
      /^<p>A <span[^>]*><span[^>]*>Unknown component &lt;Widget&gt;<\/span> word<\/span> here\.<\/p>$/u,
    );
  });

  it('shows a text that does not compile escaped, under an error block', () => {
    const html = htmlOf('Budget {to discuss} and a < b, then <Callout>unclosed');

    expect(html).toContain(NOT_COMPILED);
    expect(html).toContain('<p>Budget {to discuss} and a &lt; b, then &lt;Callout&gt;unclosed</p>');
  });

  it('shows no error block when the text compiles', () => {
    expect(htmlOf('Fine.')).not.toContain(NOT_COMPILED);
  });
});

describe('The Letter stays plain Markdown', () => {
  it('reads braces and components as text, and raw HTML not at all', () => {
    const html = bodyOf('Salary {to discuss}, <Callout>no</Callout> <script>x()</script>', 'markdown');

    expect(html).toContain('Salary {to discuss}');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('role="note"');
    expect(html).not.toContain(NOT_COMPILED);
  });

  it('reads GitHub Markdown', () => {
    const html = htmlOf('~~old~~\n\n| a | b |\n| - | - |\n| 1 | 2 |', 'markdown');

    expect(html).toContain('<del>old</del>');
    expect(html).toContain('<table');
  });
});

describe('The catalogue', () => {
  it.each([
    { type: 'note', hue: 'bg-muted/40' },
    { type: 'info', hue: 'border-primary/30 bg-primary/5' },
    { type: 'tip', hue: 'border-validated/30 bg-validated/5' },
    { type: 'warning', hue: 'border-pending/35 bg-pending/6' },
    { type: 'danger', hue: 'border-destructive/30 bg-destructive/5' },
    { type: 'unheard-of', hue: 'bg-muted/40' },
  ])('tints a $type Callout with its hue', ({ type, hue }) => {
    const html = htmlOf(`<Callout type="${type}" title="Heads up">\n\nBody\n\n</Callout>`);

    expect(html).toMatch(
      new RegExp(`<div data-slot="alert" role="note" class="[^"]*${hue.replaceAll('/', '\\/')}`, 'u'),
    );
    expect(html).toMatch(/<div data-slot="alert-title"[^>]*>Heads up<\/div>/u);
    expect(html).toContain('<p>Body</p>');
  });

  it('lays out Tabs, a Tab without a title numbered', () => {
    const html = htmlOf('<Tabs>\n<Tab title="Mission">\n\nServe\n\n</Tab>\n<Tab>\n\nOther\n\n</Tab>\n</Tabs>');

    expect(html).toContain('role="tablist"');
    expect(html).toMatch(/role="tab"[^>]*>Mission<\/button>/u);
    expect(html).toMatch(/role="tab"[^>]*>Tab 2<\/button>/u);
    expect(html).toContain('<p>Serve</p>');
  });

  it('folds an Accordion, an item without a title numbered', () => {
    const html = htmlOf(
      '<Accordion>\n<AccordionItem title="Why us?">\n\nAnswer\n\n</AccordionItem>\n<AccordionItem>\n\nMore\n\n</AccordionItem>\n</Accordion>',
    );

    expect(html).toMatch(/<button[^>]*aria-expanded="false"[^>]*>Why us\?/u);
    expect(html).toMatch(/<button[^>]*>Item 2/u);
  });

  it('sets Cards in a grid, each with its title and description', () => {
    const html = htmlOf('<Cards>\n<Card title="Team" description="12 people">\n\nAgile\n\n</Card>\n</Cards>');

    expect(html).toMatch(/<div class="[^"]*grid[^"]*"><div data-slot="card"/u);
    expect(html).toMatch(/data-slot="card-title"[^>]*>Team</u);
    expect(html).toMatch(/data-slot="card-description"[^>]*>12 people</u);
    expect(html).toContain('<p>Agile</p>');
  });

  it('keeps a Badge inline, in its tone', () => {
    expect(bodyOf('Skills: <Badge tone="outline">SQL</Badge>')).toMatch(
      /^<p>Skills: <span data-slot="badge" data-variant="outline"[^>]*>SQL<\/span><\/p>$/u,
    );
  });

  it('gives a Badge alone on its line no paragraph of its own', () => {
    expect(bodyOf('<Badge>\nSQL\n</Badge>')).toMatch(
      /^<span data-slot="badge" data-variant="secondary"[^>]*>SQL<\/span>$/u,
    );
  });

  it('captions a Table', () => {
    const html = htmlOf('<Table caption="Salaries">\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\n</Table>');

    expect(html).toMatch(/<figure[^>]*><div[^>]*><table/u);
    expect(html).toMatch(/<figcaption[^>]*>Salaries<\/figcaption><\/figure>/u);
  });

  it('numbers Steps', () => {
    const html = htmlOf(
      '<Steps>\n<Step title="Apply">\n\nSend\n\n</Step>\n<Step title="Interview">\n\nTalk\n\n</Step>\n</Steps>',
    );

    expect(html).toMatch(/<ol[^>]*><li[^>]*><div[^>]*><span[^>]*>1<\/span>/u);
    expect(html).toMatch(/<span[^>]*>2<\/span>/u);
    expect(html).toMatch(/<p[^>]*>Apply<\/p>/u);
    expect(html).toContain('<p>Talk</p>');
  });

  it('dates the Events of a Timeline', () => {
    const html = htmlOf('<Timeline>\n<Event date="2019" title="Founded">\n\nIn Lille\n\n</Event>\n</Timeline>');

    expect(html).toMatch(/<ol[^>]*><li/u);
    expect(html).toMatch(/<span[^>]*>2019<\/span><span[^>]*>Founded<\/span>/u);
    expect(html).toContain('<p>In Lille</p>');
  });

  it('credits a Quote', () => {
    const html = htmlOf('<Quote author="The mayor" source="2025 report">\n\nWe hire.\n\n</Quote>');

    expect(html).toMatch(/<blockquote[^>]*><p>We hire\.<\/p><\/blockquote>/u);
    expect(html).toMatch(/<figcaption[^>]*>— The mayor, 2025 report<\/figcaption>/u);
  });

  it('keeps a Checklist read only outside the Revision', () => {
    const html = htmlOf('<Checklist title="Bring">\n\n- [ ] ID card\n- Diploma\n\n</Checklist>');

    expect(html).toMatch(/<p[^>]*><svg[^>]*>.*<\/svg>Bring<\/p>/u);
    expect(html).toContain('ID card');
    expect(html).toContain('Diploma');
    expect(html).not.toContain('role="checkbox"');
    expect(html).not.toContain('0 of 2 done');
    expect(html).not.toMatch(/<input/u);
  });

  it('makes a Checklist of a Markdown list, checkable while revising', () => {
    const html = htmlOf('<Checklist title="Bring">\n\n- [ ] ID card\n- Diploma\n\n</Checklist>', 'mdx', true);

    expect(html).toMatch(/<p[^>]*><svg[^>]*>.*<\/svg>Bring<\/p>/u);
    expect(html).toContain('0 of 2 done');
    expect(html.match(/role="checkbox"/gu)).toHaveLength(2);
    expect(html).not.toMatch(/<input[^>]*disabled/u);
    expect(html).toContain('Diploma');
  });

  it('titles a Checklist without one', () => {
    expect(htmlOf('<Checklist>\n\n- a\n\n</Checklist>')).toMatch(/<\/svg>To do<\/p>/u);
  });

  it('draws a Diagram once in the browser, from its mermaid fence', () => {
    const html = htmlOf('<Diagram title="Hiring">\n\n```mermaid\ngraph TD; A-->B\n```\n\n</Diagram>');

    expect(html).toMatch(
      /<figure[^>]*><figcaption[^>]*>Hiring<\/figcaption><div role="status" aria-label="Drawing the diagram"/u,
    );
    expect(html).not.toContain('<pre');
  });

  it('draws a bare mermaid fence too', () => {
    const html = htmlOf('```mermaid\ngraph TD; A-->B\n```');

    expect(html).toContain('aria-label="Drawing the diagram"');
    expect(html).not.toContain('<pre');
  });
});
