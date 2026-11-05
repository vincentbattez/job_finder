import ReactMarkdown, { type Components } from 'react-markdown';

import { REMARK_PLUGIN_LIST } from './markdown-plugins.ts';
import { highlightMarkers } from './markers.ts';

// The titles of a document sit below the headings of the page that shows it, which keeps a
// single h1 per page. A table scrolls sideways in a frame of its own, so it stays a table to a screen reader.
const COMPONENT_BY_ELEMENT: Components = {
  h1: 'h3',
  h2: 'h4',
  h3: 'h5',
  h4: 'h6',
  table: ({ children }) => (
    <div className="overflow-x-auto">
      <table>{children}</table>
    </div>
  ),
};

const REHYPE_PLUGIN_LIST = [highlightMarkers];

// react-markdown builds React elements and skips raw HTML, so an Artifact cannot inject markup
export function Markdown({ markdown }: Readonly<{ markdown: string }>) {
  return (
    <div className="prose prose-sm max-w-none prose-neutral dark:prose-invert">
      <ReactMarkdown
        components={COMPONENT_BY_ELEMENT}
        remarkPlugins={REMARK_PLUGIN_LIST}
        rehypePlugins={REHYPE_PLUGIN_LIST}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
