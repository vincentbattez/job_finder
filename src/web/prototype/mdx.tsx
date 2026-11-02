// PROTOTYPE. The MDX runtime of the Artifacts (ADR-0020): an MDX string compiled and run on the server
// and in the browser alike (evaluateSync, memoized on the source), with a closed catalogue of
// components. Since MDX is code, a remark plugin strips at compile time every import, export and
// JavaScript expression, every attribute that is not a plain string (so `{…}` props never reach a
// component) and every on* attribute; a component outside the catalogue, or an HTML tag outside a safe
// few, renders as a discreet error block (<UnknownComponent name="…">) that keeps its children.
//
//   <Mdx source={version.text} components={MDX_CATALOGUE} className="prose dark:prose-invert" />
//
// Text that does not compile (a stray `{` or `<` in old Markdown) is compiled again escaped, then shown
// raw under an error block.
import { evaluateSync } from '@mdx-js/mdx';
import type { Root } from 'mdast';
import type { MDXComponents } from 'mdx/types';
import { useMemo, type ComponentType, type ReactNode } from 'react';
import * as runtime from 'react/jsx-runtime';
import remarkGfm from 'remark-gfm';

import { cn } from '#/web/prototype/lib/utils.ts';

// Each component of the catalogue has its own props
export type MdxCatalogue = Record<string, ComponentType<any>>;

const STRIPPED_TYPE_SET = new Set(['mdxjsEsm', 'mdxFlowExpression', 'mdxTextExpression']);
const ELEMENT_TYPE_SET = new Set(['mdxJsxFlowElement', 'mdxJsxTextElement']);
// Lowercase JSX is an HTML tag: only harmless ones pass
const SAFE_TAG_SET = new Set([
  'br',
  'sup',
  'sub',
  'kbd',
  'mark',
  'abbr',
  'small',
  'span',
  'div',
  'u',
  's',
  'del',
  'ins',
  'details',
  'summary',
]);

interface IMdxNode {
  type: string;
  name?: string | null;
  attributes?: { type: string; name?: string; value?: unknown }[];
  children?: IMdxNode[];
}

function isAllowed(name: string, allowedSet: ReadonlySet<string>): boolean {
  if (/^[a-z]/u.test(name)) {
    return SAFE_TAG_SET.has(name);
  }
  return allowedSet.has(name) || allowedSet.has(name.split('.')[0] ?? '');
}

function sanitize(node: IMdxNode, allowedSet: ReadonlySet<string>): void {
  if (ELEMENT_TYPE_SET.has(node.type)) {
    node.attributes = (node.attributes ?? []).filter(
      ({ type, name = '', value }) =>
        type === 'mdxJsxAttribute' &&
        (value === null || value === undefined || typeof value === 'string') &&
        !/^on/iu.test(name),
    );
    if (typeof node.name === 'string' && !isAllowed(node.name, allowedSet)) {
      node.attributes = [{ type: 'mdxJsxAttribute', name: 'name', value: node.name }];
      node.name = 'UnknownComponent';
    }
  }
  if (node.children !== undefined) {
    node.children = node.children.filter((child) => !STRIPPED_TYPE_SET.has(child.type));
    for (const child of node.children) {
      sanitize(child, allowedSet);
    }
  }
}

function remarkSafeMdx(allowedSet: ReadonlySet<string>) {
  return () => (tree: Root) => {
    // The MDX nodes are not in mdast's own types: walked structurally
    sanitize(tree as unknown as IMdxNode, allowedSet);
  };
}

// For old Markdown that MDX reads as syntax: braces and a `<` that opens no component
export function escapeForMdx(source: string): string {
  return source.replaceAll(/[{}]/gu, (brace) => `\\${brace}`).replaceAll(/<(?![A-Z/])/gu, '\\<');
}

type Compiled =
  { Content: ComponentType<{ components?: MDXComponents }>; error: null } | { Content: null; error: string };

function compile(source: string, allowedSet: ReadonlySet<string>): Compiled {
  const options = { ...runtime, remarkPlugins: [remarkGfm, remarkSafeMdx(allowedSet)] };
  try {
    return { Content: evaluateSync(source, options).default, error: null };
  } catch (error) {
    try {
      return { Content: evaluateSync(escapeForMdx(source), options).default, error: null };
    } catch {
      return { Content: null, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

// The discreet block of a component outside the catalogue: its name, then its children as they are
function UnknownComponent({ name, children }: { name?: string; children?: ReactNode }) {
  return (
    <div className="not-prose my-3 rounded-md border border-dashed border-destructive/40 px-3 py-2 text-sm text-muted-foreground">
      <p className="font-mono text-xs text-destructive/80">Composant inconnu : &lt;{name}&gt;</p>
      {children === undefined ? null : <div className="mt-1">{children}</div>}
    </div>
  );
}

export function Mdx({
  source,
  components,
  className,
}: {
  source: string;
  components: MdxCatalogue;
  className?: string;
}) {
  const compiled = useMemo(() => compile(source, new Set(Object.keys(components))), [source, components]);
  if (compiled.Content === null) {
    return (
      <div className={className}>
        <div className="not-prose mb-3 rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive">
          MDX invalide : {compiled.error}
        </div>
        <pre className="whitespace-pre-wrap text-sm">{source}</pre>
      </div>
    );
  }
  const { Content } = compiled;
  return (
    <div className={cn(className)}>
      <Content components={{ ...components, UnknownComponent }} />
    </div>
  );
}
