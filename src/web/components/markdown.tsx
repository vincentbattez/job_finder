import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { highlightMarkers } from './markers.ts';

import './markdown.css';

// The titles of a document sit below the headings of the page that shows it, which keeps a
// single h1 per page. A table scrolls sideways in a frame of its own, so it stays a table to a screen reader.
const COMPONENT_BY_ELEMENT: Components = {
  h1: 'h3',
  h2: 'h4',
  h3: 'h5',
  h4: 'h6',
  table: ({ children }) => (
    <div className="markdown__table">
      <table>{children}</table>
    </div>
  ),
};

// GitHub Markdown: the AI sums up figures in tables, which plain Markdown leaves as raw pipes
const REMARK_PLUGIN_LIST = [remarkGfm];

const REHYPE_PLUGIN_LIST = [highlightMarkers];

// react-markdown builds React elements and skips raw HTML, so an Artifact cannot inject markup
export function Markdown({ markdown }: Readonly<{ markdown: string }>) {
  return (
    <div className="markdown">
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
