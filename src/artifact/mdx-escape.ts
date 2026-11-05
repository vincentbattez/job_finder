import { fromMarkdown } from 'mdast-util-from-markdown';

// The fields of a Markdown syntax tree node the escaping reads
interface IMarkdownNode {
  type: string;
  position?: { start: { offset?: number | undefined }; end: { offset?: number | undefined } } | undefined;
  children?: IMarkdownNode[] | undefined;
}

// Code reads `{` and `<` as text in MDX as in Markdown: its spans, as offsets in the text
function codeRangeListOf(node: IMarkdownNode): [number, number][] {
  const { start, end } = node.position ?? { start: {}, end: {} };
  const isCode = node.type === 'code' || node.type === 'inlineCode';
  return isCode && start.offset !== undefined && end.offset !== undefined
    ? [[start.offset, end.offset]]
    : (node.children ?? []).flatMap((child) => codeRangeListOf(child));
}

// A Markdown text as MDX reads it as written: each `{` and `<` outside code escaped, so that MDX does not
// read it as an expression or a tag (ADR-0020). Markdown renders an escaped one the same, and a text
// escaped already stays as it is.
export function escapeMdxSyntax(markdown: string): string {
  const codeRangeList = codeRangeListOf(fromMarkdown(markdown));
  return markdown.replaceAll(/(?<!\\)[{<]/gu, (character: string, offset: number) =>
    codeRangeList.some(([start, end]) => offset >= start && offset < end) ? character : `\\${character}`,
  );
}
