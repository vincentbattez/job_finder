// PROTOTYPE · Posting page agent. « Modifier » an Artifact: MDXEditor (WYSIWYG, browser only), which
// edits the catalogue's components through its generic JSX editor and shows the source or the diff
// with the Original on demand. The Letter is plain Markdown: no component to insert. Saving corrects
// the same Version (editVersion): a Validated one stays Validated.
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
import { PlusIcon, SaveIcon, Trash2Icon, XIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '#/web/prototype/components/ui/alert.tsx';
import { Button } from '#/web/prototype/components/ui/button.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '#/web/prototype/components/ui/dropdown-menu.tsx';
import { Textarea } from '#/web/prototype/components/ui/textarea.tsx';
import { ClientOnly } from '#/web/prototype/lib/client-only.tsx';
import { cn } from '#/web/prototype/lib/utils.ts';

import { CATALOGUE_COMPONENT_LIST } from '../mdx-catalogue.tsx';
import { PROSE } from './reader.tsx';

function attributeOf(node: MdastJsx, name: string): string {
  const attribute = node.attributes.find((other) => other.type === 'mdxJsxAttribute' && other.name === name);
  return typeof attribute?.value === 'string' ? attribute.value : '';
}

// One attribute, written back to the MDX when the field is left
function AttributeField({ node, name }: { node: MdastJsx; name: string }) {
  const update = useMdastNodeUpdater<MdastJsx>();
  const [value, setValue] = useState(attributeOf(node, name));
  function commit() {
    if (value === attributeOf(node, name)) {
      return;
    }
    const others = node.attributes.filter((other) => !(other.type === 'mdxJsxAttribute' && other.name === name));
    update({ attributes: value === '' ? others : [...others, { type: 'mdxJsxAttribute', name, value }] });
  }
  return (
    <label className="flex min-w-0 items-center gap-1">
      <span className="font-mono text-[11px] text-muted-foreground">{name}</span>
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          }
        }}
        className="h-6 min-w-0 rounded border bg-background px-1.5 text-xs outline-none focus:ring-2 focus:ring-ring/40"
        size={Math.max(6, Math.min(40, value.length + 1))}
      />
    </label>
  );
}

// A component of the catalogue in the editor: its name and attributes on a header, its children
// editable below; an inline one (Badge) as a pill
function CatalogueJsxEditor({ mdastNode, descriptor }: JsxEditorProps) {
  const remove = useLexicalNodeRemove();
  const label = CATALOGUE_COMPONENT_LIST.find(({ name }) => name === descriptor.name)?.label ?? descriptor.name;
  const nested = (
    <NestedLexicalEditor<MdastJsx>
      block={mdastNode.type === 'mdxJsxFlowElement'}
      getContent={(node) => node.children}
      getUpdatedMdastNode={(node, children) => ({ ...node, children }) as MdastJsx}
    />
  );
  if (mdastNode.type === 'mdxJsxTextElement') {
    return <span className="mx-0.5 inline-flex rounded-md bg-secondary px-1.5 text-sm">{nested}</span>;
  }
  return (
    <div className="my-3 rounded-lg border border-dashed border-primary/30 bg-primary/[0.02]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-dashed border-primary/20 px-2.5 py-1.5 text-xs">
        <span className="font-mono font-medium text-primary">&lt;{descriptor.name}&gt;</span>
        <span className="text-muted-foreground">{label}</span>
        {descriptor.props.map(({ name }) => (
          <AttributeField key={name} node={mdastNode} name={name} />
        ))}
        <button
          type="button"
          onClick={remove}
          className="ml-auto inline-flex items-center gap-1 text-muted-foreground hover:text-destructive"
          aria-label={`Retirer ${label}`}
        >
          <Trash2Icon className="size-3.5" />
        </button>
      </div>
      <div className="px-3 [&_p]:my-1.5">{nested}</div>
    </div>
  );
}

const DESCRIPTOR_LIST: JsxComponentDescriptor[] = CATALOGUE_COMPONENT_LIST.map(({ name, kind, props }) => ({
  name,
  kind,
  props: props.map((prop) => ({ name: prop, type: 'string' as const })),
  hasChildren: true,
  Editor: CatalogueJsxEditor,
}));

// The parent components of the catalogue, inserted with an example child to fill in
const INSERTABLE_LIST = CATALOGUE_COMPONENT_LIST.filter(({ name }) =>
  ['Callout', 'Tabs', 'Accordion', 'Cards', 'Steps', 'Timeline', 'Quote', 'Checklist', 'Diagram'].includes(name),
);

function InsertComponent() {
  const insertJsx = usePublisher(insertJsx$);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="xs" className="mx-1">
          <PlusIcon />
          Composant
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="z-[70]">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Catalogue des Artifacts</DropdownMenuLabel>
        {INSERTABLE_LIST.map(({ name, label }) => (
          <DropdownMenuItem
            key={name}
            onSelect={() =>
              insertJsx({
                name,
                kind: 'flow',
                props: name === 'Callout' ? { type: 'info', title: 'Titre' } : {},
                children: [{ type: 'paragraph', children: [{ type: 'text', value: 'Texte' }] }],
              })
            }
          >
            {label}
            <span className="ml-auto font-mono text-[11px] text-muted-foreground">&lt;{name}&gt;</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function VisualEditor({
  text,
  original,
  isMdx,
  onChange,
  onError,
}: {
  text: string;
  original: string | null;
  isMdx: boolean;
  onChange: (text: string) => void;
  onError: (message: string) => void;
}) {
  const { resolvedTheme } = useTheme();
  return (
    <MDXEditor
      markdown={text}
      onChange={(markdown, isInitialNormalize) => {
        if (!isInitialNormalize) {
          onChange(markdown);
        }
      }}
      onError={({ error }) => onError(error)}
      className={cn(resolvedTheme === 'dark' && 'dark-theme')}
      contentEditableClassName={cn(PROSE, 'min-h-[60vh] px-1 py-6')}
      plugins={[
        headingsPlugin(),
        listsPlugin(),
        quotePlugin(),
        thematicBreakPlugin(),
        linkPlugin(),
        linkDialogPlugin(),
        tablePlugin(),
        codeBlockPlugin({ defaultCodeBlockLanguage: 'mermaid' }),
        codeMirrorPlugin({ codeBlockLanguages: { mermaid: 'Mermaid', '': 'Texte', txt: 'Texte' } }),
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

export function ArtifactEditor({
  text,
  original,
  format,
  onSave,
  onCancel,
}: {
  text: string;
  original: string | null;
  format: 'mdx' | 'markdown';
  onSave: (text: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(text);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isDirty = draft !== text;

  async function save() {
    setIsSaving(true);
    await onSave(draft);
    setIsSaving(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
        <p className="text-sm text-muted-foreground">
          {format === 'markdown'
            ? 'La Lettre de motivation reste en Markdown simple : elle part telle quelle chez l’employeur.'
            : 'Tu corriges cette Version : elle garde son état. Les composants s’éditent dans leur cadre.'}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <XIcon />
            Annuler
          </Button>
          <Button size="sm" disabled={!isDirty || isSaving} onClick={() => void save()}>
            <SaveIcon />
            {isSaving ? 'Enregistrement…' : 'Enregistrer la correction'}
          </Button>
        </div>
      </div>
      {error === null ? null : (
        <Alert>
          <AlertTitle>L’éditeur visuel ne lit pas tout ce texte</AlertTitle>
          <AlertDescription>{error.split('\n')[0]} Tu peux le corriger en source ci-dessous.</AlertDescription>
        </Alert>
      )}
      <div className="overflow-hidden rounded-xl border bg-background">
        {error === null ? (
          <ClientOnly fallback={<div className="h-[60vh] animate-pulse bg-muted/30" />}>
            {() => (
              <VisualEditor
                text={text}
                original={original}
                isMdx={format === 'mdx'}
                onChange={setDraft}
                onError={setError}
              />
            )}
          </ClientOnly>
        ) : (
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="min-h-[60vh] rounded-none border-0 font-mono text-sm"
          />
        )}
      </div>
    </div>
  );
}
