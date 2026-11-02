// PROTOTYPE. The columns of each list (DECISIONS.md « Lists »), for the table of variant A:
// - New: Title · Employer · City · Published · Deadline · Repost · [Garder] [Écarter]
// - To Apply: Title · City · Deadline (with countdown) · Start Date · Research/Letter state
// - Applications: Title · City · Step · Next Interview · Applied on
import type { ReactNode } from 'react';

import { formatDateTime, type IPosting, type ListName } from '../model.ts';
import { useRuns } from '../store.ts';
import { ArtifactStates, Countdown, DeadlineCell, FoundBadge, RepostMark, SortButtons, StepBadge } from './cells.tsx';
import { formatShortDate, upcomingInterviewOf } from './list-model.ts';

export interface IColumn {
  key: string;
  header: string;
  className?: string;
  cell: (posting: IPosting, context: { runningKeys: string[] }) => ReactNode;
}

function TitleCell({ posting, withEmployer }: { posting: IPosting; withEmployer: boolean }) {
  return (
    <div className="min-w-0">
      <div className="flex items-start gap-1.5">
        {posting.isSynthetic ? <FoundBadge /> : null}
        <span className="line-clamp-2 leading-snug font-medium" title={posting.title}>
          {posting.title}
        </span>
      </div>
      {withEmployer ? (
        <div className="truncate text-xs text-muted-foreground">{posting.employer ?? 'Employeur non précisé'}</div>
      ) : null}
    </div>
  );
}

const CITY_COLUMN: IColumn = {
  key: 'city',
  header: 'Ville',
  className: 'w-32',
  cell: (posting) => <span className="block truncate">{posting.city ?? '—'}</span>,
};

export const COLUMNS_BY_LIST: Record<ListName, IColumn[]> = {
  new: [
    {
      key: 'title',
      header: 'Offre · Employeur',
      className: 'whitespace-normal',
      cell: (posting) => <TitleCell posting={posting} withEmployer />,
    },
    CITY_COLUMN,
    {
      key: 'published',
      header: 'Publiée',
      className: 'w-20 tabular-nums',
      cell: (posting) => <span className="text-muted-foreground">{formatShortDate(posting.publishedAt)}</span>,
    },
    {
      key: 'deadline',
      header: 'Date limite',
      className: 'w-24',
      cell: (posting) => <DeadlineCell deadline={posting.deadline} />,
    },
    { key: 'repost', header: 'Republ.', className: 'w-16', cell: (posting) => <RepostMark posting={posting} /> },
    {
      key: 'actions',
      header: '',
      className: 'w-40 text-right',
      cell: (posting) =>
        posting.archivedAt === null ? <SortButtons reference={posting.reference} className="justify-end" /> : null,
    },
  ],
  to_apply: [
    {
      key: 'title',
      header: 'Offre',
      className: 'whitespace-normal',
      cell: (posting) => <TitleCell posting={posting} withEmployer />,
    },
    CITY_COLUMN,
    {
      key: 'deadline',
      header: 'Date limite',
      className: 'w-28',
      cell: (posting) => <DeadlineCell deadline={posting.deadline} />,
    },
    {
      key: 'start',
      header: 'Prise de poste',
      className: 'w-28 tabular-nums',
      cell: (posting) =>
        posting.startDate === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          formatShortDate(posting.startDate)
        ),
    },
    {
      key: 'artifacts',
      header: 'Recherche · Lettre',
      className: 'w-32',
      cell: (posting, { runningKeys }) => <ArtifactStates posting={posting} runningKeys={runningKeys} />,
    },
  ],
  applications: [
    {
      key: 'title',
      header: 'Offre',
      className: 'whitespace-normal',
      cell: (posting) => <TitleCell posting={posting} withEmployer />,
    },
    CITY_COLUMN,
    { key: 'step', header: 'Étape', className: 'w-36', cell: (posting) => <StepBadge step={posting.step} /> },
    {
      key: 'interview',
      header: 'Prochain entretien',
      className: 'w-40',
      cell: (posting) => {
        const interview = upcomingInterviewOf(posting);
        return interview === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className="flex flex-col tabular-nums">
            {formatDateTime(interview.startAt)}
            <Countdown iso={interview.startAt} />
          </span>
        );
      },
    },
    {
      key: 'applied',
      header: 'Postulée le',
      className: 'w-24 tabular-nums',
      cell: (posting) => formatShortDate(posting.appliedAt),
    },
  ],
};

// The Artifacts being generated, by Posting: a row shows them as running
export function useRunningKeysByReference(): Map<string, string[]> {
  const runList = useRuns();
  const keysByReference = new Map<string, string[]>();
  for (const run of runList) {
    if (run.status === 'running') {
      keysByReference.set(run.reference, [...(keysByReference.get(run.reference) ?? []), run.artifactKey]);
    }
  }
  return keysByReference;
}
