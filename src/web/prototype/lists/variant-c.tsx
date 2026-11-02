// PROTOTYPE. Variant C « Par échéance » bets on the order of work: the list is a column of dense cards
// grouped by what to do first (Deadline this week / this month… for New and To Apply; Interviewed,
// Invited, Applied for Applications); the map takes the same groups as its colors.
// The split is resizable.
import { MapPinIcon } from 'lucide-react';

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '#/web/prototype/components/ui/resizable.tsx';
import { cn } from '#/web/prototype/lib/utils.ts';

import { formatDateTime, type IPosting } from '../model.ts';
import {
  ArtifactStates,
  Countdown,
  DeadlineCell,
  FoundBadge,
  RepostMark,
  rowStateClass,
  SortButtons,
  StepBadge,
} from './cells.tsx';
import { useRunningKeysByReference } from './columns.tsx';
import { ApplicationTabs, ListFilters } from './filters.tsx';
import { useListController, useRowSync } from './list-context.tsx';
import { ListMap, MapLegend } from './list-map.tsx';
import { formatShortDate, groupPostings, mapLegendOf, mapToneOf, upcomingInterviewOf } from './list-model.ts';
import { EmptyList } from './variant-a.tsx';

function PostingCard({ posting, runningKeys }: { posting: IPosting; runningKeys: string[] }) {
  const { list } = useListController();
  const { rowProps, ...state } = useRowSync(posting.reference);
  const interview = upcomingInterviewOf(posting);
  return (
    <li
      {...rowProps}
      className={cn(
        rowStateClass({ ...state, isArchived: posting.archivedAt !== null }),
        'rounded-lg border bg-card p-3 shadow-xs',
        state.isHovered && 'border-foreground/20 bg-card',
        state.isActive && 'border-primary/50 shadow-none',
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm leading-snug font-medium" title={posting.title}>
            {posting.isSynthetic ? <FoundBadge /> : null} {posting.title}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{posting.employer ?? 'Employeur non précisé'}</p>
        </div>
        {list === 'applications' ? <StepBadge step={posting.step} className="shrink-0" /> : null}
      </div>
      <dl className="mt-2.5 grid grid-cols-3 gap-2 text-xs">
        <div className="min-w-0">
          <dt className="text-muted-foreground">Ville</dt>
          <dd className="flex items-center gap-1 truncate font-medium">
            <MapPinIcon className="size-3 shrink-0 text-muted-foreground" />
            <span className="truncate">{posting.city ?? '—'}</span>
          </dd>
        </div>
        {list === 'applications' ? (
          <>
            <div>
              <dt className="text-muted-foreground">Postulée le</dt>
              <dd className="font-medium tabular-nums">{formatShortDate(posting.appliedAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Entretien</dt>
              <dd className="font-medium tabular-nums">
                {interview === null ? '—' : formatDateTime(interview.startAt)}{' '}
                <Countdown iso={interview?.startAt ?? null} />
              </dd>
            </div>
          </>
        ) : (
          <>
            <div>
              <dt className="text-muted-foreground">Date limite</dt>
              <dd className="font-medium">
                <DeadlineCell deadline={posting.deadline} layout="inline" />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{list === 'new' ? 'Publiée' : 'Prise de poste'}</dt>
              <dd className="font-medium tabular-nums">
                {formatShortDate(list === 'new' ? posting.publishedAt : posting.startDate)}
              </dd>
            </div>
          </>
        )}
      </dl>
      {list === 'new' || list === 'to_apply' ? (
        <div className="mt-2.5 flex items-center justify-between gap-2 border-t pt-2.5">
          {list === 'new' ? (
            <>
              <RepostMark posting={posting} isLabelled />
              {posting.archivedAt === null ? (
                <SortButtons reference={posting.reference} size="card" className="ml-auto" />
              ) : null}
            </>
          ) : (
            <ArtifactStates posting={posting} runningKeys={runningKeys} isCompact={false} />
          )}
        </div>
      ) : null}
    </li>
  );
}

export function VariantC() {
  const { list, postings } = useListController();
  const runningKeysByReference = useRunningKeysByReference();
  const groupList = groupPostings(list, postings);
  return (
    <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
      <ResizablePanel defaultSize="44" minSize="30" maxSize="65" className="flex flex-col">
        <div className="space-y-3 border-b bg-muted/30 px-4 py-3">
          <ApplicationTabs />
          <ListFilters />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto bg-muted/30">
          {postings.length === 0 ? <EmptyList /> : null}
          {groupList.map((group) => (
            <section key={group.key} aria-label={group.label}>
              <h3 className="sticky top-0 z-10 flex items-baseline gap-2 border-b bg-background/90 px-4 py-2 text-sm font-semibold backdrop-blur">
                {group.label}
                <span className="font-normal text-muted-foreground tabular-nums">{group.postings.length}</span>
                {group.hint === '' ? null : (
                  <span className="ml-auto text-xs font-normal text-muted-foreground">{group.hint}</span>
                )}
              </h3>
              <ul className="space-y-2 p-3">
                {group.postings.map((posting) => (
                  <PostingCard
                    key={posting.reference}
                    posting={posting}
                    runningKeys={runningKeysByReference.get(posting.reference) ?? []}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel minSize="30">
        <div className="relative isolate size-full">
          <ListMap className="absolute inset-0" toneOf={mapToneOf(list)} zoomPosition="topleft" />
          <MapLegend items={mapLegendOf(list)} className="absolute right-3 bottom-6 max-w-[calc(100%-1.5rem)]" />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
