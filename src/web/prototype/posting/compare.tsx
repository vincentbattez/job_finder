// PROTOTYPE · Posting page agent. « Comparer à l'Original »: the Original the AI produced beside the
// Version as the Candidate corrected it, side by side in a shadcn Resizable, the passages that changed
// highlighted and the unchanged runs folded, each passage aligned with its counterpart. On a phone, two
// tabs instead of two columns.
import { ChevronsUpDownIcon, SparklesIcon, UserRoundPenIcon } from 'lucide-react';
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { Badge } from '#/web/prototype/components/ui/badge.tsx';
import { Button } from '#/web/prototype/components/ui/button.tsx';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '#/web/prototype/components/ui/resizable.tsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/web/prototype/components/ui/tabs.tsx';
import { useIsMobile } from '#/web/prototype/hooks/use-mobile.ts';
import { cn } from '#/web/prototype/lib/utils.ts';

import { UnfoldContext } from '../mdx-catalogue.tsx';
import { ArtifactContent } from './reader.tsx';
import { diffBlocks, type Hunk } from './text.ts';

type Side = 'original' | 'text';

const FOLD_MIN_BLOCKS = 4;

function Blocks({ blockList, format }: { blockList: string[]; format: 'mdx' | 'markdown' }) {
  return (
    <>
      {blockList.map((block, index) => (
        <ArtifactContent key={index} source={block} format={format} className="prose-sm [&>:first-child]:mt-0" />
      ))}
    </>
  );
}

function HunkView({
  hunk,
  side,
  format,
  isOpen,
  onOpen,
}: {
  hunk: Hunk;
  side: Side;
  format: 'mdx' | 'markdown';
  isOpen: boolean;
  onOpen: () => void;
}) {
  if (hunk.kind === 'change') {
    const blockList = side === 'original' ? hunk.removed : hunk.added;
    if (blockList.length === 0) {
      return (
        <div className="grid min-h-12 place-items-center rounded-lg border border-dashed text-xs text-muted-foreground">
          {side === 'original' ? 'Rien ici dans l’Original' : 'Passage retiré de ta Version'}
        </div>
      );
    }
    return (
      <div
        className={cn(
          'relative space-y-3 rounded-lg px-3 py-2.5 ring-1',
          side === 'original' ? 'bg-destructive/[0.05] ring-destructive/20' : 'bg-primary/[0.06] ring-primary/25',
        )}
      >
        <span
          className={cn(
            'absolute -top-2 right-2 rounded-full bg-background px-1.5 text-[10px] font-medium',
            side === 'original' ? 'text-destructive' : 'text-primary',
          )}
        >
          {side === 'original' ? 'Original' : 'Corrigé'}
        </span>
        <Blocks blockList={blockList} format={format} />
      </div>
    );
  }
  if (isOpen || hunk.blocks.length < FOLD_MIN_BLOCKS) {
    return (
      <div className="space-y-3 px-3 opacity-80">
        <Blocks blockList={hunk.blocks} format={format} />
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-muted/50 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <ChevronsUpDownIcon className="size-3.5" />
      {hunk.blocks.length} passages identiques
    </button>
  );
}

function PaneHeader({ side, children }: { side: Side; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2.5 text-sm font-medium">
      {side === 'original' ? (
        <SparklesIcon className="size-4 text-muted-foreground" />
      ) : (
        <UserRoundPenIcon className="size-4 text-primary" />
      )}
      {side === 'original' ? 'Original (produit par l’IA)' : 'Ta Version, corrigée'}
      {children}
    </div>
  );
}

export function CompareView({
  original,
  text,
  format,
  versionNumber,
}: {
  original: string;
  text: string;
  format: 'mdx' | 'markdown';
  versionNumber: number;
}) {
  const hunkList = useMemo(() => diffBlocks(original, text), [original, text]);
  const changeCount = hunkList.filter(({ kind }) => kind === 'change').length;
  const [openSet, setOpenSet] = useState<ReadonlySet<number>>(new Set());
  const [isAllOpen, setIsAllOpen] = useState(false);
  const groupRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const isOpen = (index: number) => isAllOpen || openSet.has(index);
  const open = (index: number) => setOpenSet((previous) => new Set(previous).add(index));

  // Each passage as tall as its counterpart, so the two columns stay aligned
  useLayoutEffect(() => {
    const root = groupRef.current;
    if (root === null) {
      return;
    }
    function align() {
      if (root === null) {
        return;
      }
      const leftList = root.querySelectorAll<HTMLElement>('[data-side=original] [data-hunk]');
      const rightList = root.querySelectorAll<HTMLElement>('[data-side=text] [data-hunk]');
      leftList.forEach((left, index) => {
        const right = rightList[index];
        if (right === undefined) {
          return;
        }
        left.style.minHeight = '';
        right.style.minHeight = '';
        const height = Math.max(left.offsetHeight, right.offsetHeight);
        left.style.minHeight = `${String(height)}px`;
        right.style.minHeight = `${String(height)}px`;
      });
    }
    align();
    const observer = new ResizeObserver(() => requestAnimationFrame(align));
    for (const pane of root.querySelectorAll('[data-side]')) {
      observer.observe(pane);
    }
    return () => observer.disconnect();
  }, [hunkList, openSet, isAllOpen, isMobile]);

  function pane(side: Side) {
    return (
      <UnfoldContext.Provider value>
        <div data-side={side} className="space-y-4 p-4">
          {hunkList.map((hunk, index) => (
            <div key={index} data-hunk={index}>
              <HunkView hunk={hunk} side={side} format={format} isOpen={isOpen(index)} onOpen={() => open(index)} />
            </div>
          ))}
        </div>
      </UnfoldContext.Provider>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <Badge variant="secondary">Version {versionNumber}</Badge>
        <span className="text-muted-foreground">
          {changeCount === 0
            ? 'Aucune correction : ta Version est identique à l’Original.'
            : `${String(changeCount)} passage${changeCount > 1 ? 's' : ''} corrigé${changeCount > 1 ? 's' : ''} depuis l’Original`}
        </span>
        <Button variant="ghost" size="xs" className="ml-auto" onClick={() => setIsAllOpen(!isAllOpen)}>
          <ChevronsUpDownIcon />
          {isAllOpen ? 'Replier l’identique' : 'Tout afficher'}
        </Button>
      </div>
      {isMobile ? (
        <Tabs defaultValue="text">
          <TabsList className="w-full">
            <TabsTrigger value="original">Original</TabsTrigger>
            <TabsTrigger value="text">Ta Version</TabsTrigger>
          </TabsList>
          <TabsContent value="original" className="rounded-xl border">
            {pane('original')}
          </TabsContent>
          <TabsContent value="text" className="rounded-xl border">
            {pane('text')}
          </TabsContent>
        </Tabs>
      ) : (
        <div className="overflow-hidden rounded-xl border" ref={groupRef}>
          <ResizablePanelGroup orientation="horizontal" className="items-stretch">
            <ResizablePanel defaultSize="50" minSize="25">
              <PaneHeader side="original" />
              {pane('original')}
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize="50" minSize="25">
              <PaneHeader side="text" />
              {pane('text')}
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      )}
    </div>
  );
}
