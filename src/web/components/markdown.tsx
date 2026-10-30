import ReactMarkdown, { type Components } from 'react-markdown';

import { highlightMarkers } from './markers.ts';

// The titles of a document sit below the headings of the page that shows it, which keeps a
// single h1 per page
const DEMOTED_HEADING_BY_HEADING: Components = { h1: 'h3', h2: 'h4', h3: 'h5', h4: 'h6' };

const REHYPE_PLUGIN_LIST = [highlightMarkers];

// react-markdown builds React elements and skips raw HTML, so an Artefact cannot inject markup
export function Markdown({ markdown }: Readonly<{ markdown: string }>) {
  return (
    <div className="prose">
      <ReactMarkdown components={DEMOTED_HEADING_BY_HEADING} rehypePlugins={REHYPE_PLUGIN_LIST}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
