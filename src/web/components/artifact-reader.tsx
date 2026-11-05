import { cn } from 'cn';
import { CheckIcon, ClockIcon, NotebookPenIcon } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';

import { ArtifactText, type ArtifactTextFormat } from '#/web/components/mdx/artifact-text.tsx';
import { Button } from '#/web/components/ui/button.tsx';
import { Progress } from '#/web/components/ui/progress.tsx';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '#/web/components/ui/sheet.tsx';

import { Recipients, type IRecipients } from './recipients.tsx';

// The page header's height (components/page-header.tsx): the progress line sticks right under it, the
// rail a little lower
const HEADER_OFFSET_CLASS = 'top-[61px]';
// Where a section counts as being read: just under the header
const SPY_OFFSET_PX = 140;
// Where a section the rail leads to lands: below the header, above that line
const SECTION_LANDING_PX = 96;
const WORDS_PER_MINUTE = 200;

// The reading size, its headings as DESIGN.md « Typography » sets them; the column holds 65 to 75
// characters per line at that size (DESIGN.md « The Reading Column Rule »)
const READING_PROSE = cn(
  'max-w-[34em] text-reading prose-neutral prose-headings:max-w-none',
  'prose-h1:text-headline prose-h2:mt-14 prose-h2:mb-4 prose-h2:text-[1.35rem] prose-h3:mt-9 prose-h3:text-[1.08rem]',
  'prose-li:my-1 prose-a:text-primary prose-hr:my-10',
);

interface ISection {
  element: HTMLHeadingElement;
  title: string;
}

// The level-2 headings of the text itself, those folded inside a catalogue component left out; read once
// the text is in the page, so the server renders the rail without its sections
function useSections(articleReference: RefObject<HTMLElement | null>, text: string): ISection[] {
  const [sectionList, setSectionList] = useState<ISection[]>([]);
  useEffect(() => {
    const headingList = articleReference.current?.querySelectorAll<HTMLHeadingElement>(':scope > div > h2') ?? [];
    setSectionList([...headingList].map((element) => ({ element, title: element.textContent.trim() })));
  }, [articleReference, text]);
  return sectionList;
}

// The section being read and how far the text is read, in percent, as the window scrolls
function useReadingPosition(
  articleReference: RefObject<HTMLElement | null>,
  sectionList: ISection[],
): { activeIndex: number; percent: number } {
  const [position, setPosition] = useState({ activeIndex: 0, percent: 0 });
  useEffect(() => {
    let frame = 0;
    function measure() {
      frame = 0;
      const activeIndex = Math.max(
        0,
        sectionList.findLastIndex(({ element }) => element.getBoundingClientRect().top < SPY_OFFSET_PX),
      );
      const box = articleReference.current?.getBoundingClientRect();
      const travel = box === undefined ? 0 : box.height - window.innerHeight + SPY_OFFSET_PX;
      const ratio = box === undefined || travel <= 0 ? 1 : (SPY_OFFSET_PX - box.top) / travel;
      const percent = Math.round(Math.min(1, Math.max(0, ratio)) * 100);
      setPosition((previous) =>
        previous.activeIndex === activeIndex && previous.percent === percent ? previous : { activeIndex, percent },
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
  }, [articleReference, sectionList]);
  return position;
}

function ReadingProgress({ percent, className }: Readonly<{ percent: number; className?: string }>) {
  const { t } = useTranslation('posting');
  return (
    <Progress
      value={percent}
      aria-label={t('reader.progressLabel')}
      aria-valuenow={percent}
      className={cn('h-1', className)}
    />
  );
}

// The rail (DESIGN.md « Reading mode, rail and margin »): the progress, then the numbered sections, the
// current one filled, the read ones checked
function Rail({
  sectionList,
  activeIndex,
  percent,
}: Readonly<{ sectionList: ISection[]; activeIndex: number; percent: number }>) {
  const { t } = useTranslation('posting');
  return (
    <nav
      aria-label={t('reader.sections')}
      className="sticky top-[85px] max-h-[calc(100svh-109px)] overflow-y-auto pb-6"
    >
      <div className="mb-4">
        <div className="mb-1.5 flex items-baseline justify-between text-xs">
          <span className="font-medium">{t('reader.progress')}</span>
          <span className="text-muted-foreground tabular-nums">{t('reader.percent', { percent })}</span>
        </div>
        <ReadingProgress percent={percent} />
      </div>
      <ol className="space-y-0.5">
        {sectionList.map(({ element, title }, index) => {
          const isActive = index === activeIndex;
          const isRead = index < activeIndex;
          return (
            <li key={index}>
              <button
                type="button"
                aria-current={isActive ? 'location' : undefined}
                onClick={() => {
                  window.scrollTo({
                    top: window.scrollY + element.getBoundingClientRect().top - SECTION_LANDING_PX,
                    behavior: 'smooth',
                  });
                }}
                className={cn(
                  'flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] leading-5 transition-colors hover:bg-muted',
                  isActive && 'bg-muted',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'mt-px grid size-5 shrink-0 place-items-center rounded-full border text-[10px] font-semibold tabular-nums',
                    isActive && 'border-primary bg-primary text-primary-foreground',
                    isRead && 'border-primary/40 text-primary',
                    !isActive && !isRead && 'text-muted-foreground',
                  )}
                >
                  {isRead ? <CheckIcon className="size-3" /> : index + 1}
                </span>
                <span className={cn('min-w-0', isActive ? 'font-medium' : 'text-muted-foreground')}>{title}</span>
                {isRead && <span className="sr-only"> {t('reader.read')}</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// What the Revision writes beside the text: its margin, given the titles of the sections and the one being
// read, and told of those titles once the text is in the page
interface IReaderMargin {
  render: (reading: { titleList: string[]; activeIndex: number }) => ReactNode;
  onTitleListChange: (titleList: string[]) => void;
}

// The margin below `@6xl`: a Sheet the reading-time line opens
function MarginSheet({ children }: Readonly<{ children: ReactNode }>) {
  const { t } = useTranslation('posting');
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="xs" className="@6xl:hidden">
          <NotebookPenIcon />
          {t('reader.margin')}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t('reader.margin')}</SheetTitle>
          <SheetDescription>{t('reader.marginDescription')}</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

// An Artifact in reading mode (spec #125, « Reading and Revision »): the rail beside a column set for
// reading, which folds into a sticky progress line on a narrow container. Only the Revision gives it a
// margin, a third column from `@6xl`, a Sheet below.
export function ArtifactReader({
  text,
  format,
  margin,
  isRevising = false,
}: Readonly<{ text: string; format: ArtifactTextFormat; margin?: IReaderMargin; isRevising?: boolean }>) {
  const { t } = useTranslation('posting');
  const articleReference = useRef<HTMLElement>(null);
  const sectionList = useSections(articleReference, text);
  const { activeIndex, percent } = useReadingPosition(articleReference, sectionList);
  const minutes = Math.max(1, Math.round(text.split(/\s+/u).length / WORDS_PER_MINUTE));
  const titleList = sectionList.map(({ title }) => title);
  const titleKey = titleList.join('\n');
  const onTitleListChange = margin?.onTitleListChange;
  useEffect(() => {
    onTitleListChange?.(titleKey === '' ? [] : titleKey.split('\n'));
  }, [onTitleListChange, titleKey]);
  const marginContent = margin?.render({ titleList, activeIndex });
  return (
    <div className="@container">
      <div
        className={cn(
          'sticky z-10 -mx-4 mb-4 border-b bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 @3xl:hidden',
          HEADER_OFFSET_CLASS,
        )}
      >
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="truncate font-medium">{sectionList[activeIndex]?.title}</span>
          <span className="shrink-0 text-muted-foreground tabular-nums">{t('reader.percent', { percent })}</span>
        </div>
        <ReadingProgress percent={percent} className="mt-1.5" />
      </div>
      <div
        className={cn(
          'grid gap-8 @3xl:grid-cols-[12rem_minmax(0,1fr)]',
          margin !== undefined && '@6xl:grid-cols-[12rem_minmax(0,1fr)_16rem]',
        )}
      >
        <aside className="hidden @3xl:block">
          <Rail sectionList={sectionList} activeIndex={activeIndex} percent={percent} />
        </aside>
        <div className="min-w-0">
          <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ClockIcon aria-hidden className="size-3.5" />
              {t('reader.readingTime', { count: minutes })}
            </span>
            {sectionList.length > 0 && (
              <>
                <span aria-hidden>·</span>
                <span className="tabular-nums">{t('reader.sectionCount', { count: sectionList.length })}</span>
              </>
            )}
            {marginContent !== undefined && <MarginSheet>{marginContent}</MarginSheet>}
          </div>
          <article ref={articleReference}>
            <ArtifactText text={text} format={format} className={READING_PROSE} isRevising={isRevising} />
          </article>
        </div>
        {marginContent !== undefined && (
          <aside aria-label={t('reader.margin')} className="hidden @6xl:block">
            <div data-reader-margin className="sticky top-[85px] max-h-[calc(100svh-109px)] overflow-y-auto pb-6">
              {marginContent}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

// The Letter as a page, the way the employer receives it, under the recipients it recommends (To, Cc)
export function LetterPage({ text, recipients }: Readonly<{ text: string; recipients: IRecipients | null }>) {
  return (
    <div className="mx-auto max-w-[42rem] space-y-6">
      {recipients !== null && <Recipients recipients={recipients} />}
      <article className="rounded-xl border bg-card px-6 py-8 shadow-whisper sm:p-12">
        <ArtifactText text={text} format="markdown" className="max-w-[34em] prose-lg prose-neutral prose-p:my-3" />
      </article>
    </div>
  );
}
