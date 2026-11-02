// PROTOTYPE · owned by the Posting page agent (with posting.tsx and revision.tsx). The closed MDX
// catalogue of the Artifacts, all on shadcn (DECISIONS.md « Artifacts », ADR-0020). Only plain string
// attributes and children reach a component (mdx.tsx strips every `{…}`), so each one is designed by
// composition, as the Fixed Part would list it to the AI:
//
//   <Callout type="info|tip|warning|danger" title="…">…</Callout>
//   <Tabs><Tab title="…">…</Tab>…</Tabs>
//   <Accordion><AccordionItem title="…">…</AccordionItem>…</Accordion>
//   <Cards><Card title="…" description="…">…</Card>…</Cards>       (a Card also stands alone)
//   <Badge tone="default|secondary|outline">…</Badge>               (inline)
//   <Table caption="…">| a Markdown table |</Table>                (every Markdown table gets its style)
//   <Steps><Step title="…">…</Step>…</Steps>
//   <Timeline><Event date="…" title="…">…</Event>…</Timeline>
//   <Quote author="…" source="…">…</Quote>
//   <Checklist title="…">- a Markdown list</Checklist>             (checkable while revising)
//   <Diagram title="…">~~~mermaid … ~~~</Diagram>                  (a bare mermaid fence draws too)
//
// Markdown stays valid: headings, lists, tables, quotes and fences render as before.
import {
  CheckCircle2Icon,
  InfoIcon,
  LightbulbIcon,
  OctagonAlertIcon,
  QuoteIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from 'lucide-react';
import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useState,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from 'react';

import {
  AccordionContent,
  AccordionTrigger,
  Accordion as UiAccordion,
  AccordionItem as UiAccordionItem,
} from '#/web/prototype/components/ui/accordion.tsx';
import { Alert, AlertDescription, AlertTitle } from '#/web/prototype/components/ui/alert.tsx';
import { Badge as UiBadge } from '#/web/prototype/components/ui/badge.tsx';
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Card as UiCard,
} from '#/web/prototype/components/ui/card.tsx';
import { Checkbox } from '#/web/prototype/components/ui/checkbox.tsx';
import { TableCell, TableHead, TableHeader, TableRow } from '#/web/prototype/components/ui/table.tsx';
import { TabsContent, TabsList, TabsTrigger, Tabs as UiTabs } from '#/web/prototype/components/ui/tabs.tsx';
import { cn } from '#/web/prototype/lib/utils.ts';

import type { MdxCatalogue } from './mdx.tsx';
import { MermaidDiagram } from './posting/mermaid.tsx';

type WithChildren = { children?: ReactNode };

// Everything unfolded (Accordion open, Tabs one after the other): for « Comparer à l'Original »
export const UnfoldContext = createContext(false);
type Element<P> = ReactElement<P & WithChildren>;

// What sits inside a component keeps the prose rhythm, without the outer margins
const FLOW = '[&>:first-child]:mt-0 [&>:last-child]:mb-0';

function elementsOf<P>(children: ReactNode): Element<P>[] {
  return Children.toArray(children).filter((child): child is Element<P> => isValidElement(child));
}

function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }
  if (Array.isArray(node)) {
    return (node as ReactNode[]).map((child) => textOf(child)).join('');
  }
  if (isValidElement<WithChildren>(node)) {
    return textOf(node.props.children);
  }
  return '';
}

// The text of a ```mermaid (or ~~~mermaid) fence somewhere in the children
function mermaidOf(node: ReactNode): string | null {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<WithChildren & { className?: string }>(child)) {
      continue;
    }
    if (child.props.className?.includes('language-mermaid') === true) {
      return textOf(child.props.children);
    }
    const found = mermaidOf(child.props.children);
    if (found !== null) {
      return found;
    }
  }
  return null;
}

// ——— Callout ———

type CalloutType = 'note' | 'info' | 'tip' | 'warning' | 'danger';

const CALLOUT_STYLE: Record<CalloutType, { icon: LucideIcon; className: string }> = {
  note: { icon: InfoIcon, className: 'border-border bg-muted/40 *:[svg]:text-muted-foreground' },
  info: { icon: InfoIcon, className: 'border-primary/25 bg-primary/[0.04] *:[svg]:text-primary' },
  tip: {
    icon: LightbulbIcon,
    className: 'border-emerald-600/25 bg-emerald-600/[0.05] *:[svg]:text-emerald-600 dark:*:[svg]:text-emerald-400',
  },
  warning: {
    icon: TriangleAlertIcon,
    className: 'border-amber-500/35 bg-amber-500/[0.06] *:[svg]:text-amber-600 dark:*:[svg]:text-amber-400',
  },
  danger: { icon: OctagonAlertIcon, className: 'border-destructive/30 bg-destructive/[0.05] *:[svg]:text-destructive' },
};

const CALLOUT_ALIAS: Record<string, CalloutType> = {
  important: 'info',
  success: 'tip',
  caution: 'warning',
  error: 'danger',
};

function Callout({ type = 'note', title, children }: { type?: string; title?: string } & WithChildren) {
  const resolved: CalloutType = type in CALLOUT_STYLE ? (type as CalloutType) : (CALLOUT_ALIAS[type] ?? 'note');
  const { icon: Icon, className } = CALLOUT_STYLE[resolved];
  const hasBody = textOf(children).trim() !== '';
  return (
    <Alert className={cn('my-6 rounded-xl px-4 py-3.5', className)}>
      <Icon />
      {title === undefined ? null : (
        <AlertTitle className="not-prose leading-6 font-semibold text-foreground">{title}</AlertTitle>
      )}
      {hasBody ? (
        <AlertDescription
          className={cn(
            'text-[0.95em] leading-relaxed text-foreground/85 md:text-pretty [&_li]:my-1 [&_p]:my-2 [&_ul]:my-2',
            FLOW,
          )}
        >
          {children}
        </AlertDescription>
      ) : null}
    </Alert>
  );
}

// ——— Tabs ———

function Tab({ children }: { title?: string } & WithChildren) {
  return <>{children}</>;
}

function Tabs({ children }: WithChildren) {
  const tabList = elementsOf<{ title?: string }>(children);
  const isUnfolded = useContext(UnfoldContext);
  if (tabList.length === 0) {
    return null;
  }
  if (isUnfolded) {
    return (
      <div className="my-6 space-y-5">
        {tabList.map((tab, index) => (
          <section key={index}>
            <p className="not-prose mb-2 border-b pb-1 text-xs font-medium text-muted-foreground">
              Onglet · {tab.props.title ?? String(index + 1)}
            </p>
            <div className={FLOW}>{tab.props.children}</div>
          </section>
        ))}
      </div>
    );
  }
  return (
    <UiTabs defaultValue="0" className="my-6 gap-0">
      <TabsList
        variant="line"
        className="not-prose h-auto w-full flex-wrap justify-start gap-x-1 rounded-none border-b pb-1 group-data-horizontal/tabs:h-auto"
      >
        {tabList.map((tab, index) => (
          <TabsTrigger key={index} value={String(index)} className="flex-none px-2.5 py-1.5">
            {tab.props.title ?? `Onglet ${String(index + 1)}`}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabList.map((tab, index) => (
        <TabsContent key={index} value={String(index)} className={cn('pt-4 [font-size:inherit]', FLOW)}>
          {tab.props.children}
        </TabsContent>
      ))}
    </UiTabs>
  );
}

// ——— Accordion ———

function AccordionItem({ children }: { title?: string } & WithChildren) {
  return <>{children}</>;
}

function Accordion({ children }: WithChildren) {
  const itemList = elementsOf<{ title?: string }>(children);
  const isUnfolded = useContext(UnfoldContext);
  return (
    <UiAccordion
      type="multiple"
      defaultValue={isUnfolded ? itemList.map((_, index) => String(index)) : []}
      className="my-6 rounded-xl border px-4"
    >
      {itemList.map((item, index) => (
        <UiAccordionItem key={index} value={String(index)}>
          <AccordionTrigger className="not-prose py-3.5 text-[0.95em] leading-6 font-semibold text-foreground hover:no-underline data-[state=open]:text-primary">
            {item.props.title ?? `Point ${String(index + 1)}`}
          </AccordionTrigger>
          <AccordionContent className={cn('pb-5 text-base [&_li]:my-1 [&_p]:my-2.5', FLOW)}>
            {item.props.children}
          </AccordionContent>
        </UiAccordionItem>
      ))}
    </UiAccordion>
  );
}

// ——— Card ———

function Card({ title, description, children }: { title?: string; description?: string } & WithChildren) {
  return (
    <UiCard size="sm" className="my-4 gap-2 shadow-none">
      {title === undefined && description === undefined ? null : (
        <CardHeader className="not-prose">
          {title === undefined ? null : <CardTitle className="font-semibold">{title}</CardTitle>}
          {description === undefined ? null : <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent>
        <div className={cn('text-[0.95em] leading-relaxed [&_li]:my-0.5 [&_p]:my-2 [&_ul]:my-2', FLOW)}>{children}</div>
      </CardContent>
    </UiCard>
  );
}

function Cards({ children }: WithChildren) {
  return <div className="my-6 grid gap-3 sm:grid-cols-2 [&>*]:my-0">{children}</div>;
}

// ——— Badge ———

// A Badge alone on its line is a flow element, its text a paragraph: inline again
function unwrapParagraph(children: ReactNode): ReactNode {
  const [only, ...rest] = Children.toArray(children);
  return rest.length === 0 && isValidElement<WithChildren>(only) && only.type === 'p' ? only.props.children : children;
}

function Badge({ tone = 'secondary', children }: { tone?: string } & WithChildren) {
  const variant = tone === 'default' || tone === 'outline' ? tone : 'secondary';
  return (
    <UiBadge variant={variant} className="not-prose mr-1.5 mb-1.5 align-middle font-medium">
      {unwrapParagraph(children)}
    </UiBadge>
  );
}

// ——— Table (the Markdown tables too) ———

function MarkdownTable({ className, ...props }: ComponentProps<'table'>) {
  return (
    <div className="not-prose my-6 w-full overflow-x-auto rounded-xl border">
      <table className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  );
}

function Table({ caption, children }: { caption?: string } & WithChildren) {
  return (
    <figure className="my-6 [&>div]:my-0">
      {children}
      {caption === undefined ? null : (
        <figcaption className="not-prose mt-2 text-center text-xs text-muted-foreground">{caption}</figcaption>
      )}
    </figure>
  );
}

function MarkdownTh({ className, ...props }: ComponentProps<'th'>) {
  return <TableHead className={cn('h-auto bg-muted/50 px-3 py-2.5 whitespace-normal', className)} {...props} />;
}

function MarkdownTd({ className, ...props }: ComponentProps<'td'>) {
  return (
    <TableCell
      className={cn(
        'px-3 py-2.5 align-top leading-relaxed whitespace-normal first:font-medium first:text-foreground',
        className,
      )}
      {...props}
    />
  );
}

// ——— Steps and Timeline ———

function Step({ children }: { title?: string } & WithChildren) {
  return <>{children}</>;
}

function Steps({ children }: WithChildren) {
  const stepList = elementsOf<{ title?: string }>(children);
  return (
    <div role="list" className="my-6">
      {stepList.map((step, index) => (
        <div role="listitem" key={index} className="relative flex gap-4 pb-5 last:pb-0">
          <div className="not-prose flex flex-col items-center">
            <span className="grid size-7 shrink-0 place-items-center rounded-full border border-primary/30 bg-primary/10 text-xs font-semibold text-primary tabular-nums">
              {index + 1}
            </span>
            {index < stepList.length - 1 ? <span className="mt-1.5 w-px flex-1 bg-border" /> : null}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            {step.props.title === undefined ? null : (
              <p className="not-prose leading-6 font-semibold text-foreground">{step.props.title}</p>
            )}
            <div className={cn('text-[0.95em] text-foreground/80 [&_li]:my-0.5 [&_p]:my-1.5', FLOW)}>
              {step.props.children}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Event({ children }: { date?: string; title?: string } & WithChildren) {
  return <>{children}</>;
}

function Timeline({ children }: WithChildren) {
  const eventList = elementsOf<{ date?: string; title?: string }>(children);
  return (
    <div role="list" className="my-6 ml-1 border-l border-border">
      {eventList.map((event, index) => (
        <div role="listitem" key={index} className="relative pb-6 pl-6 last:pb-0">
          <span className="absolute top-1.5 -left-[5px] size-2.5 rounded-full border-2 border-background bg-primary ring-1 ring-primary/40" />
          <div className="not-prose flex flex-wrap items-baseline gap-x-2">
            {event.props.date === undefined ? null : (
              <span className="text-xs font-medium tracking-wide text-primary uppercase">{event.props.date}</span>
            )}
            {event.props.title === undefined ? null : (
              <span className="leading-6 font-semibold text-foreground">{event.props.title}</span>
            )}
          </div>
          <div className={cn('mt-1 text-[0.95em] text-foreground/80 [&_li]:my-0.5 [&_p]:my-1.5', FLOW)}>
            {event.props.children}
          </div>
        </div>
      ))}
    </div>
  );
}

// ——— Quote ———

function Quote({ author, source, children }: { author?: string; source?: string } & WithChildren) {
  const caption = [author, source].filter((part) => part !== undefined && part !== '').join(', ');
  return (
    <figure className="not-prose relative my-8 rounded-xl bg-muted/50 px-6 py-5">
      <QuoteIcon className="absolute top-4 left-4 size-5 text-primary/40" aria-hidden />
      <blockquote className="pl-6 text-[1.05em] leading-relaxed text-foreground [&_p+p]:mt-3 [&_strong]:font-semibold">
        {children}
      </blockquote>
      {caption === '' ? null : <figcaption className="mt-3 pl-6 text-sm text-muted-foreground">— {caption}</figcaption>}
    </figure>
  );
}

// ——— Checklist ———

function itemsOf(children: ReactNode): ReactNode[] {
  const list = elementsOf<WithChildren>(children).find((child) => child.type === 'ul' || child.type === 'ol');
  const source =
    list === undefined ? elementsOf<WithChildren>(children) : elementsOf<WithChildren>(list.props.children);
  // A GFM task list item carries its own disabled checkbox: ours replaces it
  return source.map((item) =>
    Children.toArray(item.props.children).filter((child) => !(isValidElement(child) && child.type === 'input')),
  );
}

function Checklist({ title, children }: { title?: string } & WithChildren) {
  const itemList = itemsOf(children);
  const [checkedSet, setCheckedSet] = useState<ReadonlySet<number>>(new Set());
  return (
    <div className="not-prose my-6 rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <p className="flex items-center gap-2 font-semibold">
          <CheckCircle2Icon className="size-4 text-primary" />
          {title ?? 'À faire'}
        </p>
        <span className="text-xs text-muted-foreground tabular-nums">
          {checkedSet.size} / {itemList.length}
        </span>
      </div>
      <ul className="divide-y">
        {itemList.map((item, index) => {
          const isChecked = checkedSet.has(index);
          return (
            <li key={index}>
              <label className="flex cursor-pointer items-start gap-3 px-4 py-2.5 hover:bg-muted/40">
                <Checkbox
                  checked={isChecked}
                  className="mt-[3px]"
                  onCheckedChange={(checked) =>
                    setCheckedSet((previous) => {
                      const next = new Set(previous);
                      if (checked === true) {
                        next.add(index);
                      } else {
                        next.delete(index);
                      }
                      return next;
                    })
                  }
                />
                <span
                  className={cn(
                    'text-sm leading-relaxed [&_p]:inline',
                    isChecked && 'text-muted-foreground line-through decoration-muted-foreground/50',
                  )}
                >
                  {item}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ——— Diagram ———

function Diagram({ title, caption, children }: { title?: string; caption?: string } & WithChildren) {
  const code = mermaidOf(children) ?? textOf(children);
  return (
    <figure className="not-prose my-8 rounded-xl border bg-card p-4">
      {title === undefined ? null : <p className="mb-3 text-sm font-semibold">{title}</p>}
      <MermaidDiagram code={code} />
      {caption === undefined ? null : (
        <figcaption className="mt-3 text-center text-xs text-muted-foreground">{caption}</figcaption>
      )}
    </figure>
  );
}

// A bare ```mermaid fence draws its diagram; any other fence stays code
function Pre({ children, ...props }: ComponentProps<'pre'>) {
  const code = mermaidOf(children);
  if (code !== null) {
    return (
      <div className="not-prose my-8 rounded-xl border bg-card p-4">
        <MermaidDiagram code={code} />
      </div>
    );
  }
  return <pre {...props}>{children}</pre>;
}

export const MDX_CATALOGUE: MdxCatalogue = {
  Callout,
  Tabs,
  Tab,
  Accordion,
  AccordionItem,
  Cards,
  Card,
  Badge,
  Table,
  Steps,
  Step,
  Timeline,
  Event,
  Quote,
  Checklist,
  Diagram,
  // The Markdown elements the catalogue restyles
  table: MarkdownTable,
  thead: TableHeader,
  tr: TableRow,
  th: MarkdownTh,
  td: MarkdownTd,
  pre: Pre,
};

// The JSX components the editor knows (posting/editor.tsx builds MDXEditor's descriptors from it)
export const CATALOGUE_COMPONENT_LIST: {
  name: string;
  kind: 'flow' | 'text';
  props: string[];
  label: string;
}[] = [
  { name: 'Callout', kind: 'flow', props: ['type', 'title'], label: 'Encadré' },
  { name: 'Tabs', kind: 'flow', props: [], label: 'Onglets' },
  { name: 'Tab', kind: 'flow', props: ['title'], label: 'Onglet' },
  { name: 'Accordion', kind: 'flow', props: [], label: 'Accordéon' },
  { name: 'AccordionItem', kind: 'flow', props: ['title'], label: 'Volet' },
  { name: 'Cards', kind: 'flow', props: [], label: 'Grille de cartes' },
  { name: 'Card', kind: 'flow', props: ['title', 'description'], label: 'Carte' },
  { name: 'Badge', kind: 'text', props: ['tone'], label: 'Badge' },
  { name: 'Table', kind: 'flow', props: ['caption'], label: 'Tableau légendé' },
  { name: 'Steps', kind: 'flow', props: [], label: 'Étapes' },
  { name: 'Step', kind: 'flow', props: ['title'], label: 'Étape' },
  { name: 'Timeline', kind: 'flow', props: [], label: 'Frise' },
  { name: 'Event', kind: 'flow', props: ['date', 'title'], label: 'Événement' },
  { name: 'Quote', kind: 'flow', props: ['author', 'source'], label: 'Citation' },
  { name: 'Checklist', kind: 'flow', props: ['title'], label: 'Liste à cocher' },
  { name: 'Diagram', kind: 'flow', props: ['title', 'caption'], label: 'Diagramme' },
];
