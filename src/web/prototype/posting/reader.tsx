// PROTOTYPE · Posting page agent. The reading mode of an Artifact, shared by the Posting page and the
// Revision, in three structurally different variants (?variant=, DECISIONS.md « Variants »):
// - A « Colonne » : one centered ~70-character column, the table of contents sticky on its right;
// - B « Rail et marge » : a left rail of numbered sections with the reading progress, a wide column,
//   and a margin where the Candidate writes a note per section;
// - C « Étude » : one section at a time, like flash cards, each marked « maîtrisée », with a progress.
// The toolbar and the data are the same; only this layout changes. MDX goes through the closed
// catalogue; the Letter is plain Markdown.
import {
  ArrowUpIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  ListIcon,
  NotebookPenIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { Badge } from '#/web/prototype/components/ui/badge.tsx';
import { Button } from '#/web/prototype/components/ui/button.tsx';
import { Progress } from '#/web/prototype/components/ui/progress.tsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/web/prototype/components/ui/select.tsx';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '#/web/prototype/components/ui/sheet.tsx';
import { Textarea } from '#/web/prototype/components/ui/textarea.tsx';
import { cn } from '#/web/prototype/lib/utils.ts';

import { MDX_CATALOGUE } from '../mdx-catalogue.tsx';
import { Mdx } from '../mdx.tsx';
import type { Variant } from '../prototype-switcher.tsx';
import { readingMinutes, slugify, splitSections } from './text.ts';

export type ReadingVariant = 'A' | 'B' | 'C';

export const READING_VARIANT_LIST: Variant[] = [
  { key: 'A', name: 'Colonne' },
  { key: 'B', name: 'Rail et marge' },
  { key: 'C', name: 'Étude' },
];

export const PROSE = cn(
  'prose prose-neutral max-w-none dark:prose-invert',
  'prose-headings:scroll-mt-24 prose-headings:font-semibold prose-headings:tracking-tight',
  'prose-h1:mb-6 prose-h1:text-[1.7rem] prose-h1:leading-tight',
  'prose-h2:mt-14 prose-h2:mb-4 prose-h2:text-[1.35rem] prose-h3:mt-9 prose-h3:text-[1.08rem]',
  'prose-p:leading-[1.75] prose-li:my-1 prose-a:text-primary prose-strong:text-foreground prose-hr:my-10',
  'prose-code:font-normal prose-code:before:content-none prose-code:after:content-none',
);

// ——— Content ———

export function ArtifactContent({
  source,
  format,
  className,
}: {
  source: string;
  format: 'mdx' | 'markdown';
  className?: string;
}) {
  if (format === 'markdown') {
    return (
      <div className={cn(PROSE, className)}>
        <Markdown remarkPlugins={[remarkGfm]}>{source}</Markdown>
      </div>
    );
  }
  return <Mdx source={source} components={MDX_CATALOGUE} className={cn(PROSE, className)} />;
}

// ——— What the reader remembers while the page lives: notes per section, sections mastered ———

const memory = new Map<string, unknown>();

function useMemory<T>(key: string, initial: T): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => (memory.get(key) as T | undefined) ?? initial);
  useEffect(() => {
    // The initial value only matters for a key never written
    setValue((memory.get(key) as T | undefined) ?? initial);
  }, [key]);
  const set = useCallback(
    (next: T) => {
      memory.set(key, next);
      setValue(next);
    },
    [key],
  );
  return [value, set];
}

// ——— Headings, scroll spy and progress ———

interface IHeading {
  id: string;
  text: string;
  level: 2 | 3;
}

// The h2 and h3 of the rendered text, given an id each; those folded in a component are left out
function useHeadings(ref: RefObject<HTMLElement | null>, source: string): IHeading[] {
  const [headingList, setHeadingList] = useState<IHeading[]>([]);
  useEffect(() => {
    const root = ref.current;
    if (root === null) {
      return;
    }
    const usedSet = new Set<string>();
    const list = [...root.querySelectorAll<HTMLHeadingElement>('h2, h3')]
      .filter((heading) => heading.closest('[data-slot=tabs-content], [data-slot=accordion-content], figure') === null)
      .map((heading): IHeading => {
        const text = (heading.textContent ?? '').trim();
        let id = slugify(text);
        while (usedSet.has(id)) {
          id = `${id}-bis`;
        }
        usedSet.add(id);
        heading.id = id;
        return { id, text, level: heading.tagName === 'H2' ? 2 : 3 };
      });
    setHeadingList(list);
  }, [ref, source]);
  return headingList;
}

const SPY_OFFSET_PX = 140;
const DEFAULT_HEADER_OFFSET_PX = 61;

// A rail sticks a little under the header and scrolls on its own when taller than the screen
function railStyle(headerOffset: number) {
  return { top: headerOffset + 24, maxHeight: `calc(100svh - ${String(headerOffset + 48)}px)` };
}

// The heading being read, and how far the article is read (0 to 1)
function useScrollSpy(
  ref: RefObject<HTMLElement | null>,
  headingList: IHeading[],
): { activeId: string; progress: number } {
  const [state, setState] = useState({ activeId: '', progress: 0 });
  useEffect(() => {
    let frame = 0;
    function measure() {
      frame = 0;
      let activeId = headingList[0]?.id ?? '';
      for (const { id } of headingList) {
        const element = document.getElementById(id);
        if (element !== null && element.getBoundingClientRect().top < SPY_OFFSET_PX) {
          activeId = id;
        }
      }
      const article = ref.current;
      let progress = 0;
      if (article !== null) {
        const box = article.getBoundingClientRect();
        const travel = box.height - window.innerHeight + SPY_OFFSET_PX;
        progress = travel <= 0 ? 1 : Math.min(1, Math.max(0, (SPY_OFFSET_PX - box.top) / travel));
      }
      setState((previous) =>
        previous.activeId === activeId && Math.abs(previous.progress - progress) < 0.005
          ? previous
          : { activeId, progress },
      );
    }
    function onScroll() {
      if (frame === 0) {
        frame = requestAnimationFrame(measure);
      }
    }
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [ref, headingList]);
  return state;
}

function scrollToHeading(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ——— Shared pieces ———

function ReadingMeta({
  source,
  sectionCount,
  children,
}: {
  source: string;
  sectionCount: number;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <ClockIcon className="size-3.5" />≈ {readingMinutes(source)} min de lecture
      </span>
      {sectionCount > 0 ? (
        <>
          <span aria-hidden>·</span>
          <span>{sectionCount} sections</span>
        </>
      ) : null}
      <div className="ml-auto flex items-center gap-2">{children}</div>
    </div>
  );
}

function TocList({
  headingList,
  activeId,
  onPick,
}: {
  headingList: IHeading[];
  activeId: string;
  onPick?: (id: string) => void;
}) {
  return (
    <ul className="space-y-0.5 border-l text-[13px] leading-5">
      {headingList.map(({ id, text, level }) => (
        <li key={id}>
          <button
            type="button"
            onClick={() => {
              scrollToHeading(id);
              onPick?.(id);
            }}
            className={cn(
              '-ml-px block w-full border-l-2 border-transparent py-1 pr-2 text-left text-muted-foreground transition-colors hover:text-foreground',
              level === 2 ? 'pl-3' : 'pl-6 text-[12.5px]',
              activeId === id && 'border-primary font-medium text-foreground',
            )}
          >
            {text}
          </button>
        </li>
      ))}
    </ul>
  );
}

function TocSheet({ headingList, activeId }: { headingList: IHeading[]; activeId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  if (headingList.length === 0) {
    return null;
  }
  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="xs">
          <ListIcon />
          Sommaire
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Sommaire</SheetTitle>
          <SheetDescription>Aller directement à une section.</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          <TocList headingList={headingList} activeId={activeId} onPick={() => setIsOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface IReaderProps {
  source: string;
  format: 'mdx' | 'markdown';
  // One per Version: where notes and mastered sections are remembered
  memoryKey: string;
  // The height of the page's own sticky header, under which the rails and bars stick
  headerOffset?: number | undefined;
}

// ——— A · Colonne ———

function ColumnReader({ source, format, headerOffset = DEFAULT_HEADER_OFFSET_PX }: IReaderProps) {
  const articleRef = useRef<HTMLElement>(null);
  const headingList = useHeadings(articleRef, source);
  const { activeId } = useScrollSpy(articleRef, headingList);
  const hasToc = headingList.length > 1;
  return (
    <div className="@container">
      <div className={cn('grid gap-10', hasToc && '@5xl:grid-cols-[minmax(0,1fr)_14rem]')}>
        <div className="min-w-0">
          <div className="mx-auto max-w-[70ch]">
            <ReadingMeta source={source} sectionCount={headingList.filter(({ level }) => level === 2).length}>
              <div className="@5xl:hidden">
                <TocSheet headingList={headingList} activeId={activeId} />
              </div>
            </ReadingMeta>
            <article ref={articleRef}>
              <ArtifactContent source={source} format={format} />
            </article>
          </div>
        </div>
        {hasToc ? (
          <aside className="hidden @5xl:block">
            <nav className="sticky overflow-y-auto pb-6" style={railStyle(headerOffset)}>
              <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">Sur cette page</p>
              <TocList headingList={headingList} activeId={activeId} />
              <Button
                variant="ghost"
                size="xs"
                className="mt-4 text-muted-foreground"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              >
                <ArrowUpIcon />
                Revenir en haut
              </Button>
            </nav>
          </aside>
        ) : null}
      </div>
    </div>
  );
}

// ——— B · Rail et marge ———

function MarginNotes({
  memoryKey,
  sectionList,
  activeId,
}: {
  memoryKey: string;
  sectionList: IHeading[];
  activeId: string;
}) {
  const [noteById, setNoteById] = useMemory<Record<string, string>>(`notes:${memoryKey}`, {});
  const active = sectionList.find(({ id }) => id === activeId) ?? sectionList[0];
  const otherList = sectionList.filter(({ id }) => id !== active?.id && (noteById[id] ?? '').trim() !== '');
  if (active === undefined) {
    return null;
  }
  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-3">
        <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <NotebookPenIcon className="size-3.5" />
          Note de marge
        </p>
        <p className="mb-2 line-clamp-2 text-sm font-medium">{active.text}</p>
        <Textarea
          value={noteById[active.id] ?? ''}
          onChange={(event) => setNoteById({ ...noteById, [active.id]: event.target.value })}
          placeholder="Ce que tu veux retenir de cette section, une formule à dire, un doute à lever…"
          className="min-h-28 resize-none bg-background text-sm"
        />
        <p className="mt-1.5 text-[11px] text-muted-foreground">Gardée le temps de la session (prototype).</p>
      </div>
      {otherList.length === 0 ? null : (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Tes autres notes</p>
          <ul className="space-y-2">
            {otherList.map(({ id, text }) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => scrollToHeading(id)}
                  className="w-full rounded-lg border-l-2 border-primary/40 bg-muted/40 px-3 py-2 text-left hover:bg-muted"
                >
                  <span className="block truncate text-xs font-medium">{text}</span>
                  <span className="line-clamp-2 text-xs text-muted-foreground">{noteById[id]}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function RailReader({ source, format, memoryKey, headerOffset = DEFAULT_HEADER_OFFSET_PX }: IReaderProps) {
  const articleRef = useRef<HTMLElement>(null);
  const headingList = useHeadings(articleRef, source);
  const sectionList = headingList.filter(({ level }) => level === 2);
  const { activeId, progress } = useScrollSpy(articleRef, sectionList);
  const activeIndex = Math.max(
    0,
    sectionList.findIndex(({ id }) => id === activeId),
  );
  const [noteById] = useMemory<Record<string, string>>(`notes:${memoryKey}`, {});
  const noteCount = Object.values(noteById).filter((note) => note.trim() !== '').length;
  const percent = Math.round(progress * 100);
  return (
    <div className="@container">
      {/* Narrow: the rail folds into a sticky progress line */}
      <div
        className="sticky z-10 -mx-4 mb-4 border-b bg-background/95 px-4 py-2 backdrop-blur @3xl:hidden"
        style={{ top: headerOffset }}
      >
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="truncate font-medium">{sectionList[activeIndex]?.text ?? 'Lecture'}</span>
          <span className="shrink-0 text-muted-foreground tabular-nums">{percent} %</span>
        </div>
        <Progress value={percent} className="mt-1.5 h-1" />
      </div>
      <div
        className={cn(
          'grid gap-8',
          sectionList.length > 0 && '@3xl:grid-cols-[12rem_minmax(0,1fr)] @6xl:grid-cols-[12rem_minmax(0,1fr)_16rem]',
        )}
      >
        {sectionList.length > 0 ? (
          <aside className="hidden @3xl:block">
            <nav className="sticky overflow-y-auto pb-6" style={railStyle(headerOffset)}>
              <div className="mb-4">
                <div className="mb-1.5 flex items-baseline justify-between text-xs">
                  <span className="font-medium">Progression</span>
                  <span className="text-muted-foreground tabular-nums">{percent} %</span>
                </div>
                <Progress value={percent} className="h-1" />
              </div>
              <ol className="relative space-y-0.5">
                {sectionList.map(({ id, text }, index) => {
                  const isActive = index === activeIndex;
                  const isRead = index < activeIndex;
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => scrollToHeading(id)}
                        className={cn(
                          'group flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] leading-5 transition-colors hover:bg-muted',
                          isActive && 'bg-muted',
                        )}
                      >
                        <span
                          className={cn(
                            'mt-px grid size-5 shrink-0 place-items-center rounded-full border text-[10px] font-semibold tabular-nums',
                            isActive && 'border-primary bg-primary text-primary-foreground',
                            isRead && 'border-primary/40 text-primary',
                            !isActive && !isRead && 'text-muted-foreground',
                          )}
                        >
                          {isRead ? <CheckIcon className="size-3" /> : index + 1}
                        </span>
                        <span className={cn('min-w-0', isActive ? 'font-medium' : 'text-muted-foreground')}>
                          {text}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </nav>
          </aside>
        ) : null}
        <div className="min-w-0">
          <div className="max-w-[72ch]">
            <ReadingMeta source={source} sectionCount={sectionList.length}>
              {sectionList.length > 0 ? (
                <div className="@6xl:hidden">
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant="outline" size="xs">
                        <NotebookPenIcon />
                        Notes de marge
                        {noteCount > 0 ? <Badge className="ml-0.5 h-4 px-1.5 text-[10px]">{noteCount}</Badge> : null}
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-80 overflow-y-auto">
                      <SheetHeader>
                        <SheetTitle>Notes de marge</SheetTitle>
                        <SheetDescription>Une note par section, pour réviser.</SheetDescription>
                      </SheetHeader>
                      <div className="px-4 pb-6">
                        <MarginNotes memoryKey={memoryKey} sectionList={sectionList} activeId={activeId} />
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>
              ) : null}
            </ReadingMeta>
            <article ref={articleRef}>
              <ArtifactContent source={source} format={format} />
            </article>
          </div>
        </div>
        {sectionList.length > 0 ? (
          <aside className="hidden @6xl:block">
            <div className="sticky overflow-y-auto pb-6" style={railStyle(headerOffset)}>
              <MarginNotes memoryKey={memoryKey} sectionList={sectionList} activeId={activeId} />
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}

// ——— C · Étude ———

function StudyReader({ source, format, memoryKey, headerOffset = DEFAULT_HEADER_OFFSET_PX }: IReaderProps) {
  const sectionList = useMemo(() => splitSections(source), [source]);
  const [index, setIndex] = useMemory<number>(`study-index:${memoryKey}`, 0);
  const [masteredList, setMasteredList] = useMemory<string[]>(`study-mastered:${memoryKey}`, []);
  const cardRef = useRef<HTMLDivElement>(null);
  const current = sectionList[Math.min(index, sectionList.length - 1)];
  const total = sectionList.length;
  const masteredCount = sectionList.filter(({ id }) => masteredList.includes(id)).length;
  const isMastered = current !== undefined && masteredList.includes(current.id);

  const go = useCallback(
    (next: number) => {
      const bounded = Math.min(total - 1, Math.max(0, next));
      setIndex(bounded);
      const top = cardRef.current?.getBoundingClientRect().top ?? 0;
      if (top < 0) {
        cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    [setIndex, total],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.altKey || event.metaKey || event.ctrlKey) {
        return;
      }
      if (
        event.target instanceof Element &&
        event.target.closest('input, textarea, [contenteditable], [role=tablist]')
      ) {
        return;
      }
      if (event.key === 'j') {
        go(index + 1);
      } else if (event.key === 'k') {
        go(index - 1);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [go, index]);

  if (current === undefined || total <= 1) {
    return <ColumnReader source={source} format={format} memoryKey={memoryKey} headerOffset={headerOffset} />;
  }

  function toggleMastered() {
    if (current === undefined) {
      return;
    }
    const isNowMastered = !masteredList.includes(current.id);
    setMasteredList(isNowMastered ? [...masteredList, current.id] : masteredList.filter((id) => id !== current.id));
    if (isNowMastered && index < total - 1) {
      go(index + 1);
    }
  }

  const position = Math.min(index, total - 1);
  return (
    <div className="@container">
      <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-48 flex-1">
          <div className="mb-1.5 flex items-baseline justify-between text-xs">
            <span className="font-medium">
              {masteredCount === total
                ? 'Tout est maîtrisé'
                : `${String(masteredCount)} sur ${String(total)} maîtrisées`}
            </span>
            <span className="text-muted-foreground">≈ {readingMinutes(source)} min de lecture</span>
          </div>
          <Progress value={(masteredCount / total) * 100} className="h-1.5" />
        </div>
      </div>
      <div className="grid gap-6 @4xl:grid-cols-[15rem_minmax(0,1fr)]">
        <nav className="hidden @4xl:block">
          <ol className="sticky space-y-0.5" style={railStyle(headerOffset)}>
            {sectionList.map(({ id, title }, sectionIndex) => {
              const isCurrent = sectionIndex === position;
              const isDone = masteredList.includes(id);
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => go(sectionIndex)}
                    className={cn(
                      'flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] leading-5 transition-colors hover:bg-muted',
                      isCurrent && 'bg-primary/[0.07] ring-1 ring-primary/20',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-px grid size-5 shrink-0 place-items-center rounded-full border text-[10px] font-semibold tabular-nums',
                        isDone && 'border-emerald-600/40 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400',
                        isCurrent && !isDone && 'border-primary text-primary',
                      )}
                    >
                      {isDone ? <CheckIcon className="size-3" /> : sectionIndex + 1}
                    </span>
                    <span className={cn('min-w-0', isCurrent ? 'font-medium' : 'text-muted-foreground')}>{title}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
        <div className="min-w-0">
          <div className="mb-3 @4xl:hidden">
            <Select value={String(position)} onValueChange={(value) => go(Number(value))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sectionList.map(({ id, title }, sectionIndex) => (
                  <SelectItem key={id} value={String(sectionIndex)}>
                    {sectionIndex + 1}. {title}
                    {masteredList.includes(id) ? ' ✓' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div
            ref={cardRef}
            className="scroll-mt-24 rounded-2xl border bg-card px-5 py-7 shadow-xs @2xl:px-10 @2xl:py-10"
          >
            <div className="mb-6 flex items-center justify-between gap-3">
              <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Section {position + 1} sur {total}
              </span>
              {isMastered ? (
                <Badge variant="outline" className="border-emerald-600/40 text-emerald-700 dark:text-emerald-400">
                  <CheckIcon />
                  Maîtrisée
                </Badge>
              ) : null}
            </div>
            <div className="mx-auto max-w-[68ch]">
              <ArtifactContent
                key={current.id}
                source={current.source}
                format={format}
                className="prose-h1:text-[1.5rem] prose-h2:mt-0"
              />
            </div>
          </div>
          <div className="sticky bottom-16 z-10 mt-4 flex items-center justify-between gap-2 rounded-xl border bg-background/95 p-2 shadow-sm backdrop-blur">
            <Button variant="ghost" size="sm" disabled={position === 0} onClick={() => go(position - 1)}>
              <ChevronLeftIcon />
              <span className="hidden sm:inline">Précédente</span>
            </Button>
            <div className="flex items-center gap-2">
              <span className="hidden text-[11px] text-muted-foreground @2xl:inline">
                <kbd className="rounded border px-1">K</kbd> <kbd className="rounded border px-1">J</kbd>
              </span>
              <Button variant={isMastered ? 'outline' : 'default'} size="sm" onClick={toggleMastered}>
                <CheckIcon />
                {isMastered ? 'Maîtrisée' : 'Je la maîtrise'}
              </Button>
            </div>
            <Button variant="ghost" size="sm" disabled={position === total - 1} onClick={() => go(position + 1)}>
              <span className="hidden sm:inline">Suivante</span>
              <ChevronRightIcon />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ——— The switch ———

export function ArtifactReader({ variant, ...props }: IReaderProps & { variant: ReadingVariant }) {
  if (variant === 'B') {
    return <RailReader {...props} />;
  }
  if (variant === 'C') {
    return <StudyReader {...props} />;
  }
  return <ColumnReader {...props} />;
}
