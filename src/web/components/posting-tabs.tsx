import { cn } from 'cn';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '#/web/components/ui/badge.tsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/web/components/ui/tabs.tsx';

import type { State } from './badge.tsx';

// The tabs of the Posting page, in the order of the workflow (spec #125, « The Posting page »)
export const POSTING_TAB_LIST = ['posting', 'research', 'letter', 'interviews', 'notes'] as const;

export type PostingTab = (typeof POSTING_TAB_LIST)[number];

// The state an Artifact tab shows as a dot, always with its label (DESIGN.md « The State Hue Rule »)
const DOT_BY_STATE: Record<State, string> = {
  absent: 'bg-muted-foreground/30',
  queued: 'bg-pending',
  in_progress: 'bg-pending',
  ready: 'bg-validated',
  failed: 'bg-destructive',
};

// The dot leads the tab; its label follows the tab's name, for a screen reader
function StateDot({ state }: Readonly<{ state: State }>) {
  return <span aria-hidden className={cn('inline-block size-1.5 rounded-full', DOT_BY_STATE[state])} />;
}

function StateLabel({ state }: Readonly<{ state: State }>) {
  const { t } = useTranslation('posting');
  return <span className="sr-only">{t('page.tabState', { stateLabel: t(`stateLabelByState.${state}`) })}</span>;
}

// Only the open tab's panel is rendered: the page's route chooses it from the URL
export function PostingTabs({
  tab,
  onTabChange,
  stateByTab,
  interviewCount,
  children,
}: Readonly<{
  tab: PostingTab;
  onTabChange: (tab: string) => void;
  stateByTab: Partial<Record<PostingTab, State | undefined>>;
  interviewCount: number;
  children: ReactNode;
}>) {
  const { t } = useTranslation('posting');
  return (
    <Tabs value={tab} onValueChange={onTabChange}>
      <TabsList
        variant="line"
        className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b px-0 pb-1 group-data-horizontal/tabs:h-auto"
      >
        {POSTING_TAB_LIST.map((value) => {
          const state = stateByTab[value];
          return (
            <TabsTrigger key={value} value={value} className="flex-none gap-2 px-3 py-2">
              {state !== undefined && <StateDot state={state} />}
              {t(`page.tabLabelByTab.${value}`)}
              {state !== undefined && <StateLabel state={state} />}
              {value === 'interviews' && interviewCount > 0 && (
                <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[10px] tabular-nums">
                  {interviewCount}
                </Badge>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>
      <TabsContent value={tab} className="pt-6">
        {children}
      </TabsContent>
    </Tabs>
  );
}
