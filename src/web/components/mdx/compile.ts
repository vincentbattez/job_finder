import { evaluateSync } from '@mdx-js/mdx';
import * as runtime from 'react/jsx-runtime';
import remarkGfm from 'remark-gfm';

// The Letter leaves for the employer, so it stays plain Markdown; every other Artifact is MDX (ADR-0020)
export type ArtifactTextFormat = 'mdx' | 'markdown';

// The component a node outside the catalogue becomes: an error block that keeps its children
export const UNKNOWN_COMPONENT_NAME = 'UnknownComponent';

// MDX is code: what would run is stripped before anything does (ADR-0020)
const STRIPPED_NODE_TYPE_SET = new Set(['mdxjsEsm', 'mdxFlowExpression', 'mdxTextExpression']);
const ELEMENT_NODE_TYPE_SET = new Set(['mdxJsxFlowElement', 'mdxJsxTextElement']);

// Lowercase JSX is an HTML tag: only harmless ones pass, with the only attributes they need
const SAFE_TAG_SET = new Set(['br', 'sup', 'sub', 'kbd', 'mark', 'abbr', 'small', 'span', 'u', 's', 'del', 'ins']);
const SAFE_TAG_ATTRIBUTE_SET = new Set(['title']);
// React reads these itself: a plain string there would break the render rather than reach a component
const RESERVED_ATTRIBUTE_SET = new Set(['key', 'ref', 'style', 'dangerouslySetInnerHTML', 'children']);

// The fields of an MDX syntax tree node (mdast with the MDX extensions) the sanitizing touches
interface IMdxNode {
  type: string;
  name?: string | null;
  attributes?: { type: string; name?: string; value?: unknown }[];
  children?: IMdxNode[];
}

function isHtmlTag(name: string): boolean {
  return /^[a-z]/u.test(name);
}

function isKeptAttribute(
  tagName: string,
  { type, name = '', value }: { type: string; name?: string; value?: unknown },
): boolean {
  // An expression attribute ({…}, a spread) is an object in the tree, only a plain string is text
  if (type !== 'mdxJsxAttribute' || typeof value !== 'string' || /^on/iu.test(name)) {
    return false;
  }
  return isHtmlTag(tagName) ? SAFE_TAG_ATTRIBUTE_SET.has(name) : !RESERVED_ATTRIBUTE_SET.has(name);
}

function sanitize(node: IMdxNode, componentNameSet: ReadonlySet<string>): void {
  if (ELEMENT_NODE_TYPE_SET.has(node.type) && typeof node.name === 'string') {
    const name = node.name;
    const isKnown = isHtmlTag(name) ? SAFE_TAG_SET.has(name) : componentNameSet.has(name);
    // Within a line, the error block is inline too: a block inside a paragraph would not hydrate
    const unknownAttributeList = [
      { type: 'mdxJsxAttribute', name: 'name', value: name },
      ...(node.type === 'mdxJsxTextElement' ? [{ type: 'mdxJsxAttribute', name: 'inline', value: 'true' }] : []),
    ];
    node.attributes = isKnown
      ? (node.attributes ?? []).filter((attribute) => isKeptAttribute(name, attribute))
      : unknownAttributeList;
    node.name = isKnown ? name : UNKNOWN_COMPONENT_NAME;
  } else if (ELEMENT_NODE_TYPE_SET.has(node.type)) {
    // A fragment (<>…</>) keeps only its children
    node.attributes = [];
  }
  if (node.children === undefined) {
    return;
  }
  node.children = node.children.filter((child) => !STRIPPED_NODE_TYPE_SET.has(child.type));
  for (const child of node.children) {
    sanitize(child, componentNameSet);
  }
}

function remarkCatalogueOnly(componentNameSet: ReadonlySet<string>) {
  // The MDX nodes are not in mdast's own types: the tree is walked structurally
  return () => (tree: IMdxNode) => {
    sanitize(tree, componentNameSet);
  };
}

// The characters MDX reads as syntax, escaped so that they read as text
function escapeMdx(text: string): string {
  return text.replaceAll(/[{}<]/gu, (character) => `\\${character}`);
}

export interface ICompiledText {
  content: ReturnType<typeof evaluateSync>['default'];
  // The text did not compile as it is, and content shows it escaped
  hasFailed: boolean;
}

// The same compilation on the server and in the browser, so the page hydrates onto what the server
// rendered. A text that does not compile is shown escaped, never as a broken page.
export function compileArtifactText(
  text: string,
  format: ArtifactTextFormat,
  componentNameSet: ReadonlySet<string>,
): ICompiledText {
  const evaluate = (source: string, mdxFormat: 'mdx' | 'md') =>
    evaluateSync(source, {
      ...runtime,
      format: mdxFormat,
      remarkPlugins: [remarkGfm, remarkCatalogueOnly(componentNameSet)],
    }).default;
  if (format === 'markdown') {
    return { content: evaluate(text, 'md'), hasFailed: false };
  }
  try {
    return { content: evaluate(text, 'mdx'), hasFailed: false };
  } catch {
    return { content: evaluate(escapeMdx(text), 'mdx'), hasFailed: true };
  }
}
