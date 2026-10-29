// Where a fact is missing, the Lettre module writes a « [à compléter : …] » marker rather than
// inventing it (spec « Lettre »): each marker stands out wherever a document shows, so that none
// is sent. The capture keeps the markers in the split, at the odd indexes.
const MARKER_SPLIT_PATTERN = /(\[à compléter\s*:[^\]]*\])/iu;

// The few fields of a node of the HTML tree react-markdown builds (hast) that the markers touch
interface IHtmlNode {
  type: string;
  value?: string;
  tagName?: string;
  properties?: Record<string, never>;
  children?: IHtmlNode[];
}

function splitMarkers(node: IHtmlNode): IHtmlNode[] {
  if (node.type !== 'text' || node.value === undefined) {
    highlightIn(node);
    return [node];
  }
  return node.value
    .split(MARKER_SPLIT_PATTERN)
    .map((value, index): IHtmlNode => {
      const text = { type: 'text', value };
      return index % 2 === 0 ? text : { type: 'element', tagName: 'mark', properties: {}, children: [text] };
    })
    .filter(({ value }) => value !== '');
}

function highlightIn(node: IHtmlNode): void {
  if (node.children !== undefined) {
    node.children = node.children.flatMap((child) => splitMarkers(child));
  }
}

// A rehype plugin for react-markdown: wraps each marker in a <mark>
export function highlightMarkers() {
  return highlightIn;
}
