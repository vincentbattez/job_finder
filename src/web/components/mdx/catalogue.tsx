// The closed catalogue of the MDX Artifacts, on shadcn (ADR-0020). Only plain string attributes and
// children reach a component (compile.ts strips the rest), so each one is written by composition. The Fixed
// Part of each MDX Artifact lists the same components to the AI (src/ai-module/index.ts): add one to both.
//
//   <Callout type="note|info|tip|warning|danger" title="…">…</Callout>
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
import { cn } from 'cn';
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
  type ComponentType,
  type ReactElement,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';

import {
  AccordionContent,
  AccordionTrigger,
  Accordion as UiAccordion,
  AccordionItem as UiAccordionItem,
} from '#/web/components/ui/accordion.tsx';
import { Alert, AlertDescription, AlertTitle } from '#/web/components/ui/alert.tsx';
import { Badge as UiBadge } from '#/web/components/ui/badge.tsx';
import { CardContent, CardDescription, CardHeader, CardTitle, Card as UiCard } from '#/web/components/ui/card.tsx';
import { Checkbox } from '#/web/components/ui/checkbox.tsx';
import { TableCell, TableHead, TableHeader, TableRow } from '#/web/components/ui/table.tsx';
import { TabsContent, TabsList, TabsTrigger, Tabs as UiTabs } from '#/web/components/ui/tabs.tsx';

import { MermaidDiagram } from './mermaid-diagram.tsx';

interface IWithChildren {
  children?: ReactNode;
}

type ChildElement<Properties> = ReactElement<Properties & IWithChildren>;

// What sits inside a component keeps the prose rhythm, without the outer margins
const FLOW = '[&>:first-child]:mt-0 [&>:last-child]:mb-0';

function elementsOf<Properties>(children: ReactNode): ChildElement<Properties>[] {
  return Children.toArray(children).filter((child): child is ChildElement<Properties> => isValidElement(child));
}

function textOf(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) => {
      if (typeof child === 'string' || typeof child === 'number') {
        return String(child);
      }
      return isValidElement<IWithChildren>(child) ? textOf(child.props.children) : '';
    })
    .join('');
}

// The text of a mermaid fence somewhere in the children: Markdown gives its code the language class
function mermaidOf(node: ReactNode): string | null {
  for (const child of elementsOf<{ className?: string }>(node)) {
    if (child.props.className?.split(' ').includes('language-mermaid') === true) {
      return textOf(child.props.children);
    }
    const found = mermaidOf(child.props.children);
    if (found !== null) {
      return found;
    }
  }
  return null;
}

// Callout: a hue per type, on its border and fill, its text staying foreground (DESIGN.md)
type CalloutType = 'note' | 'info' | 'tip' | 'warning' | 'danger';

const CALLOUT_STYLE_BY_TYPE: Record<CalloutType, { icon: LucideIcon; className: string }> = {
  note: { icon: InfoIcon, className: 'border-border bg-muted/40 *:[svg]:text-muted-foreground' },
  info: { icon: InfoIcon, className: 'border-primary/30 bg-primary/5 *:[svg]:text-primary' },
  tip: { icon: LightbulbIcon, className: 'border-validated/30 bg-validated/5 *:[svg]:text-validated-foreground' },
  warning: {
    icon: TriangleAlertIcon,
    className: 'border-pending/35 bg-pending/6 *:[svg]:text-pending-foreground',
  },
  danger: { icon: OctagonAlertIcon, className: 'border-destructive/30 bg-destructive/5 *:[svg]:text-destructive' },
};

function isCalloutType(type: string): type is CalloutType {
  return Object.hasOwn(CALLOUT_STYLE_BY_TYPE, type);
}

function Callout({ type = 'note', title, children }: Readonly<{ type?: string; title?: string } & IWithChildren>) {
  const style = CALLOUT_STYLE_BY_TYPE[isCalloutType(type) ? type : 'note'];
  return (
    <Alert role="note" className={cn('my-6 rounded-xl px-4 py-3.5 text-foreground', style.className)}>
      <style.icon aria-hidden />
      {title === undefined ? null : (
        <AlertTitle className="not-prose leading-6 font-semibold text-foreground">{title}</AlertTitle>
      )}
      {textOf(children).trim() === '' ? null : (
        <AlertDescription className={cn('text-[0.95rem] leading-relaxed text-foreground [&_li]:my-1 [&_p]:my-2', FLOW)}>
          {children}
        </AlertDescription>
      )}
    </Alert>
  );
}

// Comparing with the Original unfolds what a component hides, so that every changed passage shows
export const UNFOLD_CONTEXT = createContext(false);

// The Revision is where a Checklist's items get ticked: any other reading shows them as a plain list
export const REVISING_CONTEXT = createContext(false);

// Tab, AccordionItem, Step and Event only carry their attributes to the component around them
function Part({ children }: Readonly<IWithChildren>) {
  return <>{children}</>;
}

function Tabs({ children }: Readonly<IWithChildren>) {
  const { t } = useTranslation('mdx');
  const tabList = elementsOf<{ title?: string }>(children);
  const isUnfolded = useContext(UNFOLD_CONTEXT);
  if (tabList.length === 0) {
    return null;
  }
  if (isUnfolded) {
    return (
      <div className="my-6 space-y-4">
        {tabList.map((tab, index) => (
          <div key={index} className={cn('border-l pl-4 text-base', FLOW)}>
            <p className="not-prose mb-2 text-sm font-semibold">{tab.props.title ?? t('tab', { number: index + 1 })}</p>
            {tab.props.children}
          </div>
        ))}
      </div>
    );
  }
  return (
    <UiTabs defaultValue="0" className="my-6 gap-0">
      <TabsList variant="line" className="not-prose h-auto w-full flex-wrap justify-start gap-x-1 border-b pb-1">
        {tabList.map((tab, index) => (
          <TabsTrigger key={index} value={String(index)} className="flex-none px-2.5 py-1.5">
            {tab.props.title ?? t('tab', { number: index + 1 })}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabList.map((tab, index) => (
        <TabsContent key={index} value={String(index)} className={cn('pt-4 text-base', FLOW)}>
          {tab.props.children}
        </TabsContent>
      ))}
    </UiTabs>
  );
}

function Accordion({ children }: Readonly<IWithChildren>) {
  const { t } = useTranslation('mdx');
  const isUnfolded = useContext(UNFOLD_CONTEXT);
  const itemList = elementsOf<{ title?: string }>(children);
  return (
    <UiAccordion
      type="multiple"
      defaultValue={isUnfolded ? itemList.keys().toArray().map(String) : []}
      className="my-6 rounded-xl border px-4 [&_h3]:my-0"
    >
      {itemList.map((item, index) => (
        <UiAccordionItem key={index} value={String(index)}>
          <AccordionTrigger className="not-prose py-3.5 leading-6 font-semibold text-foreground hover:no-underline">
            {item.props.title ?? t('accordionItem', { number: index + 1 })}
          </AccordionTrigger>
          <AccordionContent className={cn('pb-5 text-base [&_li]:my-1 [&_p]:my-2.5', FLOW)}>
            {item.props.children}
          </AccordionContent>
        </UiAccordionItem>
      ))}
    </UiAccordion>
  );
}

function Card({ title, description, children }: Readonly<{ title?: string; description?: string } & IWithChildren>) {
  return (
    <UiCard size="sm" className="my-4 gap-2 shadow-none">
      {title === undefined && description === undefined ? null : (
        <CardHeader className="not-prose">
          {title === undefined ? null : <CardTitle className="font-semibold">{title}</CardTitle>}
          {description === undefined ? null : <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent className={cn('text-[0.95rem] leading-relaxed [&_li]:my-0.5 [&_p]:my-2 [&_ul]:my-2', FLOW)}>
        {children}
      </CardContent>
    </UiCard>
  );
}

function Cards({ children }: Readonly<IWithChildren>) {
  return <div className="my-6 grid gap-3 sm:grid-cols-2 [&>*]:my-0">{children}</div>;
}

// A Badge alone on its line is a flow element, its text a paragraph: inline again
function unwrapParagraph(children: ReactNode): ReactNode {
  const [only, ...restList] = Children.toArray(children);
  return restList.length === 0 && isValidElement<IWithChildren>(only) && only.type === 'p'
    ? only.props.children
    : children;
}

function Badge({ tone = 'secondary', children }: Readonly<{ tone?: string } & IWithChildren>) {
  const variant = tone === 'default' || tone === 'outline' ? tone : 'secondary';
  return (
    <UiBadge variant={variant} className="not-prose mr-1.5 mb-1.5 align-middle font-medium">
      {unwrapParagraph(children)}
    </UiBadge>
  );
}

function MarkdownTable({ className, ...properties }: ComponentProps<'table'>) {
  return (
    <div className="not-prose my-6 w-full overflow-x-auto rounded-xl border">
      <table className={cn('w-full caption-bottom text-sm', className)} {...properties} />
    </div>
  );
}

function MarkdownTh({ className, ...properties }: ComponentProps<'th'>) {
  return <TableHead className={cn('h-auto bg-muted/50 px-3 py-2.5 whitespace-normal', className)} {...properties} />;
}

function MarkdownTd({ className, ...properties }: ComponentProps<'td'>) {
  return (
    <TableCell
      className={cn('px-3 py-2.5 align-top leading-relaxed whitespace-normal first:font-medium', className)}
      {...properties}
    />
  );
}

function Table({ caption, children }: Readonly<{ caption?: string } & IWithChildren>) {
  return (
    <figure className="my-6 [&>div]:my-0">
      {children}
      {caption === undefined ? null : (
        <figcaption className="not-prose mt-2 text-center text-xs text-muted-foreground">{caption}</figcaption>
      )}
    </figure>
  );
}

function Steps({ children }: Readonly<IWithChildren>) {
  const stepList = elementsOf<{ title?: string }>(children);
  return (
    <ol className="not-prose my-6 list-none p-0">
      {stepList.map((step, index) => (
        <li key={index} className="relative flex gap-4 pb-5 last:pb-0">
          <div className="flex flex-col items-center">
            <span className="grid size-7 shrink-0 place-items-center rounded-full border border-primary/30 bg-primary/10 text-xs font-semibold text-primary tabular-nums">
              {index + 1}
            </span>
            {index < stepList.length - 1 ? <span aria-hidden className="mt-1.5 w-px flex-1 bg-border" /> : null}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            {step.props.title === undefined ? null : (
              <p className="leading-6 font-semibold text-foreground">{step.props.title}</p>
            )}
            <div className={cn('prose max-w-none text-foreground dark:prose-invert [&_p]:my-1.5', FLOW)}>
              {step.props.children}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Timeline({ children }: Readonly<IWithChildren>) {
  return (
    <ol className="not-prose my-6 ml-1 list-none border-l border-border p-0">
      {elementsOf<{ date?: string; title?: string }>(children).map((event, index) => (
        <li key={index} className="relative pb-6 pl-6 last:pb-0">
          <span
            aria-hidden
            className="absolute top-1.5 -left-[5px] size-2.5 rounded-full border-2 border-background bg-primary ring-1 ring-primary/40"
          />
          <div className="flex flex-wrap items-baseline gap-x-2">
            {event.props.date === undefined ? null : (
              <span className="text-xs font-medium tracking-wide text-primary uppercase">{event.props.date}</span>
            )}
            {event.props.title === undefined ? null : (
              <span className="leading-6 font-semibold text-foreground">{event.props.title}</span>
            )}
          </div>
          <div className={cn('mt-1 prose max-w-none text-foreground dark:prose-invert [&_p]:my-1.5', FLOW)}>
            {event.props.children}
          </div>
        </li>
      ))}
    </ol>
  );
}

function Quote({ author, source, children }: Readonly<{ author?: string; source?: string } & IWithChildren>) {
  const caption = [author, source].filter((part) => part !== undefined && part !== '').join(', ');
  return (
    <figure className="not-prose relative my-8 rounded-xl bg-muted/50 px-6 py-5">
      <QuoteIcon aria-hidden className="absolute top-4 left-4 size-5 text-primary/40" />
      <blockquote className="pl-6 leading-relaxed text-foreground [&_p+p]:mt-3 [&_strong]:font-semibold">
        {children}
      </blockquote>
      {caption === '' ? null : <figcaption className="mt-3 pl-6 text-sm text-muted-foreground">— {caption}</figcaption>}
    </figure>
  );
}

// The items of the Markdown list a Checklist holds; a GFM task item's own disabled checkbox gives way
function checklistItemsOf(children: ReactNode): ReactNode[] {
  const list = elementsOf<IWithChildren>(children).find((child) => child.type === 'ul' || child.type === 'ol');
  return elementsOf<IWithChildren>(list?.props.children).map((item) =>
    Children.toArray(item.props.children).filter((child) => !(isValidElement(child) && child.type === 'input')),
  );
}

// Checked while revising only: the ticks are not saved
function Checklist({ title, children }: Readonly<{ title?: string } & IWithChildren>) {
  const { t } = useTranslation('mdx');
  const isRevising = useContext(REVISING_CONTEXT);
  const itemList = checklistItemsOf(children);
  const [checkedIndexSet, setCheckedIndexSet] = useState<ReadonlySet<number>>(new Set());
  const toggle = (index: number, isChecked: boolean) => {
    setCheckedIndexSet((previous) => {
      const next = new Set(previous);
      if (isChecked) {
        next.add(index);
      } else {
        next.delete(index);
      }
      return next;
    });
  };
  return (
    <div className="not-prose my-6 rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <p className="flex items-center gap-2 font-semibold">
          <CheckCircle2Icon aria-hidden className="size-4 text-primary" />
          {title ?? t('checklist')}
        </p>
        {isRevising && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {t('checklistProgress', { checkedCount: checkedIndexSet.size, count: itemList.length })}
          </span>
        )}
      </div>
      <ul className="divide-y">
        {itemList.map((item, index) => {
          if (!isRevising) {
            return (
              <li key={index} className="px-4 py-2.5 text-sm leading-relaxed [&_p]:inline">
                {item}
              </li>
            );
          }
          const isChecked = checkedIndexSet.has(index);
          return (
            <li key={index}>
              <label className="flex cursor-pointer items-start gap-3 px-4 py-2.5 hover:bg-muted/40">
                <Checkbox
                  checked={isChecked}
                  className="mt-[3px]"
                  onCheckedChange={(checked) => {
                    toggle(index, checked === true);
                  }}
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

function Diagram({ title, children }: Readonly<{ title?: string } & IWithChildren>) {
  return (
    <figure className="not-prose my-8 rounded-xl border bg-card p-4">
      {title === undefined ? null : <figcaption className="mb-3 text-sm font-semibold">{title}</figcaption>}
      <MermaidDiagram code={mermaidOf(children) ?? textOf(children)} />
    </figure>
  );
}

// A bare mermaid fence draws its diagram; any other fence stays code
function Pre({ children, ...properties }: ComponentProps<'pre'>) {
  const code = mermaidOf(children);
  if (code === null) {
    return <pre {...properties}>{children}</pre>;
  }
  return (
    <div className="not-prose my-8 rounded-xl border bg-card p-4">
      <MermaidDiagram code={code} />
    </div>
  );
}

// Each component's props are its own: MDX hands them over by name
export const MDX_CATALOGUE: Record<string, ComponentType<never>> = {
  Callout,
  Tabs,
  Tab: Part,
  Accordion,
  AccordionItem: Part,
  Cards,
  Card,
  Badge,
  Table,
  Steps,
  Step: Part,
  Timeline,
  Event: Part,
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
