import { cn } from 'cn';
import { ChevronsUpDownIcon, SparklesIcon, UserRoundPenIcon } from 'lucide-react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '#/web/components/ui/button.tsx';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '#/web/components/ui/resizable.tsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/web/components/ui/tabs.tsx';
import { useIsMobile } from '#/web/hooks/use-mobile.ts';

import { ArtifactText } from './mdx/artifact-text.tsx';
import { compareBlocks, type BlockRun } from './mdx/blocks.ts';

type Side = 'original' | 'text';

// A run this short shows whole: folding it would hide less than its fold takes
const FOLD_MIN_BLOCK_COUNT = 3;

function Blocks({ blockList, format }: Readonly<{ blockList: string[]; format: 'mdx' | 'markdown' }>) {
  return blockList.map((block, index) => (
    <ArtifactText
      key={index}
      text={block}
      format={format}
      isUnfolded
      className="prose-sm [&>:first-child]:mt-0 [&>:last-child]:mb-0"
    />
  ));
}

function RunView({
  run,
  side,
  format,
  isOpen,
  onOpen,
}: Readonly<{ run: BlockRun; side: Side; format: 'mdx' | 'markdown'; isOpen: boolean; onOpen: () => void }>) {
  const { t } = useTranslation('posting');
  if (run.kind === 'change') {
    const blockList = side === 'original' ? run.originalList : run.textList;
    if (blockList.length === 0) {
      return (
        <p className="grid min-h-12 place-items-center rounded-lg border border-dashed text-xs text-muted-foreground">
          {side === 'original' ? t('artifactView.compare.nothingInOriginal') : t('artifactView.compare.removed')}
        </p>
      );
    }
    return (
      <div
        data-change={side}
        className={cn(
          'relative space-y-3 rounded-lg px-3 py-2.5 ring-1',
          side === 'original' ? 'bg-destructive/5 ring-destructive/20' : 'bg-primary/5 ring-primary/25',
        )}
      >
        <span
          className={cn(
            'absolute -top-2 right-2 rounded-full bg-background px-1.5 text-[10px] font-medium',
            side === 'original' ? 'text-destructive' : 'text-primary',
          )}
        >
          {side === 'original' ? t('artifactView.compare.originalTag') : t('artifactView.compare.correctedTag')}
        </span>
        <Blocks blockList={blockList} format={format} />
      </div>
    );
  }
  if (isOpen || run.blockList.length < FOLD_MIN_BLOCK_COUNT) {
    return (
      <div className="space-y-3 px-3 text-muted-foreground">
        <Blocks blockList={run.blockList} format={format} />
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-muted/50 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <ChevronsUpDownIcon aria-hidden className="size-3.5" />
      {t('artifactView.compare.sameCount', { count: run.blockList.length })}
    </button>
  );
}

function PaneHeader({ side }: Readonly<{ side: Side }>) {
  const { t } = useTranslation('posting');
  return (
    <p className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2.5 text-sm font-medium">
      {side === 'original' ? (
        <SparklesIcon aria-hidden className="size-4 text-muted-foreground" />
      ) : (
        <UserRoundPenIcon aria-hidden className="size-4 text-primary" />
      )}
      {side === 'original' ? t('artifactView.compare.original') : t('artifactView.compare.text')}
    </p>
  );
}

// « Comparer à l'Original » (spec #125): the AI's text beside the Candidate's, in two resizable columns, each
// changed passage highlighted and as tall as its counterpart, the unchanged runs folded; two tabs on a phone.
// The Original is only read.
export function CompareView({
  original,
  text,
  format,
}: Readonly<{ original: string; text: string; format: 'mdx' | 'markdown' }>) {
  const { t } = useTranslation('posting');
  const runList = useMemo(() => compareBlocks(original, text), [original, text]);
  const changeCount = runList.filter(({ kind }) => kind === 'change').length;
  const [openSet, setOpenSet] = useState<ReadonlySet<number>>(new Set());
  const [isAllOpen, setIsAllOpen] = useState(false);
  const groupReference = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const isOpen = (index: number) => isAllOpen || openSet.has(index);

  // Each run as tall as its counterpart, so the two columns stay aligned
  useLayoutEffect(() => {
    const root = groupReference.current;
    if (root === null) {
      return;
    }
    function align(): void {
      if (root === null) {
        return;
      }
      const leftList = root.querySelectorAll<HTMLElement>(':scope [data-side=original] [data-run]');
      const rightList = root.querySelectorAll<HTMLElement>(':scope [data-side=text] [data-run]');
      for (const [index, left] of leftList.entries()) {
        const right = rightList[index];
        if (right === undefined) {
          continue;
        }
        left.style.minHeight = '';
        right.style.minHeight = '';
        const height = `${String(Math.max(left.offsetHeight, right.offsetHeight))}px`;
        left.style.minHeight = height;
        right.style.minHeight = height;
      }
    }
    align();
    const observer = new ResizeObserver(() => requestAnimationFrame(align));
    for (const pane of root.querySelectorAll(':scope [data-side]')) {
      observer.observe(pane);
    }
    return () => {
      observer.disconnect();
    };
  }, [runList, openSet, isAllOpen, isMobile]);

  function pane(side: Side) {
    return (
      <div data-side={side} className="space-y-4 p-4">
        {runList.map((run, index) => (
          <div key={index} data-run={index}>
            <RunView
              run={run}
              side={side}
              format={format}
              isOpen={isOpen(index)}
              onOpen={() => {
                setOpenSet((previous) => new Set(previous).add(index));
              }}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div data-compare className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <p className="text-muted-foreground tabular-nums">
          {changeCount === 0
            ? t('artifactView.compare.noChange')
            : t('artifactView.compare.changeCount', { count: changeCount })}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="ml-auto"
          aria-pressed={isAllOpen}
          onClick={() => {
            setIsAllOpen(!isAllOpen);
          }}
        >
          <ChevronsUpDownIcon aria-hidden />
          {isAllOpen ? t('artifactView.compare.foldSame') : t('artifactView.compare.showAll')}
        </Button>
      </div>
      {isMobile ? (
        <Tabs defaultValue="text">
          <TabsList className="w-full">
            <TabsTrigger value="original">{t('artifactView.compare.originalTab')}</TabsTrigger>
            <TabsTrigger value="text">{t('artifactView.compare.textTab')}</TabsTrigger>
          </TabsList>
          <TabsContent value="original" className="rounded-xl border">
            {pane('original')}
          </TabsContent>
          <TabsContent value="text" className="rounded-xl border">
            {pane('text')}
          </TabsContent>
        </Tabs>
      ) : (
        <div ref={groupReference} className="overflow-hidden rounded-xl border">
          <ResizablePanelGroup orientation="horizontal" className="items-stretch">
            <ResizablePanel defaultSize="50" minSize="25">
              <section aria-label={t('artifactView.compare.original')}>
                <PaneHeader side="original" />
                {pane('original')}
              </section>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize="50" minSize="25">
              <section aria-label={t('artifactView.compare.text')}>
                <PaneHeader side="text" />
                {pane('text')}
              </section>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      )}
    </div>
  );
}
