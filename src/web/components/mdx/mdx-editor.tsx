// MDXEditor, a WYSIWYG that only runs in the browser: the Version editor loads this module once hydrated
// (spec #125, « MDX »). It edits the catalogue's components through their descriptors, shows the source or
// the diff with the Original on demand; the Letter, plain Markdown, has no component to insert.
import '@mdxeditor/editor/style.css';

import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  codeBlockPlugin,
  codeMirrorPlugin,
  CreateLink,
  diffSourcePlugin,
  DiffSourceToggleWrapper,
  headingsPlugin,
  insertJsx$,
  InsertTable,
  jsxPlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  ListsToggle,
  markdownShortcutPlugin,
  MDXEditor,
  NestedLexicalEditor,
  quotePlugin,
  Separator,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  UndoRedo,
  useLexicalNodeRemove,
  useMdastNodeUpdater,
  usePublisher,
  type JsxComponentDescriptor,
  type JsxEditorProps,
  type MdastJsx,
} from '@mdxeditor/editor';
import { cn } from 'cn';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '#/web/components/ui/button.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '#/web/components/ui/dropdown-menu.tsx';

import { CATALOGUE_SHAPE_LIST } from './catalogue-shape.ts';

type FlowChild = Extract<MdastJsx, { type: 'mdxJsxFlowElement' }>['children'][number];
type PhrasingChild = Extract<MdastJsx, { type: 'mdxJsxTextElement' }>['children'][number];

// What a nested editor can hold: a block component takes blocks, an inline one (Badge) takes phrasing
const PHRASING_TYPE_SET = new Set([
  'break',
  'delete',
  'emphasis',
  'footnoteReference',
  'html',
  'image',
  'imageReference',
  'inlineCode',
  'link',
  'linkReference',
  'strong',
  'text',
  'mdxJsxTextElement',
  'mdxTextExpression',
]);
const NOT_FLOW_TYPE_SET = new Set(['listItem', 'tableRow', 'tableCell']);

function isPhrasingChild(child: Readonly<{ type: string }>): child is PhrasingChild {
  return PHRASING_TYPE_SET.has(child.type);
}

function isFlowChild(child: Readonly<{ type: string }>): child is FlowChild {
  return !PHRASING_TYPE_SET.has(child.type) && !NOT_FLOW_TYPE_SET.has(child.type);
}

function withChildren(node: MdastJsx, childList: readonly Readonly<{ type: string }>[]): MdastJsx {
  return node.type === 'mdxJsxTextElement'
    ? { ...node, children: childList.filter((child) => isPhrasingChild(child)) }
    : { ...node, children: childList.filter((child) => isFlowChild(child)) };
}

function attributeOf(node: MdastJsx, name: string): string {
  const attribute = node.attributes.find((other) => other.type === 'mdxJsxAttribute' && other.name === name);
  return typeof attribute?.value === 'string' ? attribute.value : '';
}

// One attribute, written back to the MDX when the field is left
function AttributeField({ node, name }: Readonly<{ node: MdastJsx; name: string }>) {
  const { t } = useTranslation('posting');
  const update = useMdastNodeUpdater<MdastJsx>();
  const [value, setValue] = useState(attributeOf(node, name));
  function commit() {
    if (value === attributeOf(node, name)) {
      return;
    }
    const otherList = node.attributes.filter((other) => !(other.type === 'mdxJsxAttribute' && other.name === name));
    update({ attributes: value === '' ? otherList : [...otherList, { type: 'mdxJsxAttribute', name, value }] });
  }
  return (
    <label className="flex min-w-0 items-center gap-1">
      <span className="font-mono text-[11px] text-muted-foreground">{name}</span>
      <input
        value={value}
        aria-label={t('artifactView.editor.attribute', { name })}
        placeholder={name}
        onChange={(event) => {
          setValue(event.target.value);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') {
            return;
          }
          event.preventDefault();
          commit();
        }}
        className="h-6 min-w-0 rounded-sm border bg-background px-1.5 text-xs outline-none focus:ring-2 focus:ring-ring/50"
        size={Math.max(6, Math.min(40, value.length + 1))}
      />
    </label>
  );
}

// A component of the catalogue in the editor: its name and attributes on a header, its children editable
// below; an inline one (Badge) as a pill
function CatalogueJsxEditor({ mdastNode, descriptor }: Readonly<JsxEditorProps>) {
  const { t } = useTranslation('posting');
  const remove = useLexicalNodeRemove();
  const name = mdastNode.name ?? descriptor.name;
  const nested = (
    <NestedLexicalEditor<MdastJsx>
      block={mdastNode.type === 'mdxJsxFlowElement'}
      getContent={(node) => node.children}
      getUpdatedMdastNode={withChildren}
    />
  );
  if (mdastNode.type === 'mdxJsxTextElement') {
    return <span className="mx-0.5 inline-flex rounded-md bg-secondary px-1.5 text-sm">{nested}</span>;
  }
  const attributeList =
    CATALOGUE_SHAPE_LIST.find((shape) => shape.name === name)?.attributeList ??
    descriptor.props.map(({ name: property }) => property);
  return (
    <div data-component={name} className="not-prose my-3 rounded-lg border border-dashed border-primary/30">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-dashed border-primary/20 px-2.5 py-1.5 text-xs">
        <span className="font-mono font-medium text-primary">&lt;{name}&gt;</span>
        {attributeList.map((attribute) => (
          <AttributeField key={attribute} node={mdastNode} name={attribute} />
        ))}
        <button
          type="button"
          onClick={remove}
          className="ml-auto inline-flex items-center rounded-sm p-0.5 text-muted-foreground hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          aria-label={t('artifactView.editor.removeComponent', { name })}
        >
          <Trash2Icon aria-hidden className="size-3.5" />
        </button>
      </div>
      <div className="prose max-w-none px-3 dark:prose-invert [&_p]:my-1.5">{nested}</div>
    </div>
  );
}

// One descriptor per component of the catalogue (ADR-0020); any other component is still edited, generically
const DESCRIPTOR_LIST: JsxComponentDescriptor[] = [
  ...CATALOGUE_SHAPE_LIST.map(({ name, kind, attributeList }) => ({
    name,
    kind,
    props: attributeList.map((attribute) => ({ name: attribute, type: 'string' as const })),
    hasChildren: true,
    Editor: CatalogueJsxEditor,
  })),
  { name: '*', kind: 'flow', props: [], hasChildren: true, Editor: CatalogueJsxEditor },
];

function InsertComponent() {
  const { t } = useTranslation('posting');
  const insertJsx = usePublisher(insertJsx$);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="xs" className="mx-1">
          <PlusIcon aria-hidden />
          {t('artifactView.editor.insertComponent')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {t('artifactView.editor.catalogue')}
        </DropdownMenuLabel>
        {CATALOGUE_SHAPE_LIST.filter(({ isInsertable }) => isInsertable).map(({ name }) => (
          <DropdownMenuItem
            key={name}
            onSelect={() => {
              insertJsx({
                name,
                kind: 'flow',
                props: name === 'Callout' ? { type: 'note' } : {},
                children: [{ type: 'paragraph', children: [{ type: 'text', value: '…' }] }],
              });
            }}
          >
            <span className="font-mono text-xs">&lt;{name}&gt;</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MdxEditor({
  text,
  original,
  format,
  label,
  onChange,
  onError,
}: Readonly<{
  text: string;
  // The AI's text, which the diff view compares with; the text itself for a Version brought
  original: string | null;
  format: 'mdx' | 'markdown';
  label: string;
  onChange: (text: string) => void;
  onError: (message: string) => void;
}>) {
  const { t } = useTranslation('mdx');
  const { resolvedTheme } = useTheme();
  const isMdx = format === 'mdx';
  return (
    <MDXEditor
      markdown={text}
      translation={(key, defaultValue, interpolations) =>
        // The editable area is named after the Version; MDXEditor names its other keys, which the catalogue words
        key === 'contentArea.editableMarkdown' ? label : t(`editor.${key}`, { defaultValue, ...interpolations })
      }
      onChange={(markdown, isInitialNormalize) => {
        if (!isInitialNormalize) {
          onChange(markdown);
        }
      }}
      onError={({ error }) => {
        onError(error);
      }}
      // MDXEditor's dark theme keeps a white page behind its nested editors and its selects: the app's own, in
      // both themes. Its stylesheet is not in a layer, hence the !
      className={cn('mdx-editor [--basePageBg:var(--background)]!', resolvedTheme === 'dark' && 'dark-theme')}
      contentEditableClassName={cn(
        'prose max-w-none px-4 py-6 text-reading dark:prose-invert',
        format === 'markdown' && 'prose-lg',
      )}
      plugins={[
        headingsPlugin(),
        listsPlugin(),
        quotePlugin(),
        thematicBreakPlugin(),
        linkPlugin(),
        linkDialogPlugin(),
        tablePlugin(),
        codeBlockPlugin({ defaultCodeBlockLanguage: 'mermaid' }),
        codeMirrorPlugin({ codeBlockLanguages: { mermaid: 'Mermaid', '': 'Text', txt: 'Text' } }),
        ...(isMdx ? [jsxPlugin({ jsxComponentDescriptors: DESCRIPTOR_LIST })] : []),
        diffSourcePlugin({ viewMode: 'rich-text', diffMarkdown: original ?? text }),
        markdownShortcutPlugin(),
        toolbarPlugin({
          toolbarContents: () => (
            <DiffSourceToggleWrapper>
              <UndoRedo />
              <Separator />
              <BlockTypeSelect />
              <BoldItalicUnderlineToggles />
              <ListsToggle />
              <Separator />
              <CreateLink />
              <InsertTable />
              {isMdx ? (
                <>
                  <Separator />
                  <InsertComponent />
                </>
              ) : null}
            </DiffSourceToggleWrapper>
          ),
        }),
      ]}
    />
  );
}
