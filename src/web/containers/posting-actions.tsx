import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  CalendarClockIcon,
  CalendarPlusIcon,
  ChevronDownIcon,
  ExternalLinkIcon,
  FlagIcon,
  MoreHorizontalIcon,
  RepeatIcon,
  RotateCcwIcon,
  SendIcon,
  ThumbsDownIcon,
  TrophyIcon,
} from 'lucide-react';
import { useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useFetcher } from 'react-router';

import type { Status, Step } from '#/web/components/badge.tsx';
import { Button } from '#/web/components/ui/button.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/web/components/ui/dropdown-menu.tsx';
import type { IRefusal } from '#/web/failure.ts';

import { useFeedback } from './use-feedback.ts';

interface IPostingActions {
  reference: string;
  step: Step;
  isArchived: boolean;
  // What the Status rules let the Posting move to (ADR-0007, ADR-0009)
  statusChoiceList: Status[];
  url: string | null;
  repostOf: { reference: string } | null;
  // The first Interview still to come, which an Invited Application leads to
  nextInterviewNumber: number | null;
}

const IN_PROGRESS_STEP_LIST: Set<Step> = new Set(['applied', 'invited', 'interviewed']);

const OUTCOME_ICON_BY_STATUS = { hired: <TrophyIcon />, rejected: <ThumbsDownIcon /> };

// On a phone the header's actions keep their icon only (DESIGN.md « Layout »), their name for a screen reader
function ButtonLabel({ children }: Readonly<{ children: ReactNode }>) {
  return <span className="sr-only sm:not-sr-only">{children}</span>;
}

// The head of the Posting page (spec #125, « The Posting page »): ONE primary action that follows the
// Step, the rest in a ⋯ menu. The Status goes through its route, which refuses what the Status rules
// forbid; archiving acts at once and offers its undo in the toast.
export function PostingActions({
  reference,
  step,
  isArchived,
  statusChoiceList,
  url,
  repostOf,
  nextInterviewNumber,
}: Readonly<IPostingActions>) {
  const { t } = useTranslation('posting');
  const statusFetcher = useFetcher<IRefusal | null>();
  const archiveFetcher = useFetcher<IRefusal | null>();
  const submittedStatus = useRef<Status>('applied');
  useFeedback(statusFetcher, () =>
    t('page.statusChanged', { statusLabel: t(`statusLabelByStatus.${submittedStatus.current}`, { ns: 'common' }) }),
  );
  const archiveIntent = isArchived ? 'unarchive' : 'archive';
  const submitArchive = (intent: 'archive' | 'unarchive') => {
    void archiveFetcher.submit(
      { intent },
      { method: 'post', action: `/postings/${reference}/archive`, preventScrollReset: true },
    );
  };
  useFeedback(
    archiveFetcher,
    () => (isArchived ? t('page.archived') : t('page.unarchived')),
    () => ({
      label: t('page.undo'),
      onClick: () => {
        submitArchive(archiveIntent);
      },
    }),
  );
  const changeStatus = (status: Status) => {
    submittedStatus.current = status;
    void statusFetcher.submit(
      { status },
      { method: 'post', action: `/postings/${reference}/status`, preventScrollReset: true },
    );
  };
  // Applied is what both To Apply and an outcome move to: its button alone spins while it is sent
  const isApplying = statusFetcher.state !== 'idle' && submittedStatus.current === 'applied';
  const isInProgress = IN_PROGRESS_STEP_LIST.has(step) && !isArchived;
  const outcomeList = (['hired', 'rejected'] as const).filter((status) => statusChoiceList.includes(status));
  const interviewsTab = { search: '?tab=interviews' };
  const archiveLabel = isArchived ? t('unarchive') : t('archive');

  function renderPrimary() {
    if (isArchived) {
      return (
        <Button
          size="sm"
          isPending={archiveFetcher.state !== 'idle'}
          onClick={() => {
            submitArchive('unarchive');
          }}
        >
          <ArchiveRestoreIcon />
          <ButtonLabel>{t('unarchive')}</ButtonLabel>
        </Button>
      );
    }
    switch (step) {
      case 'to_apply': {
        return (
          <Button
            size="sm"
            isPending={isApplying}
            onClick={() => {
              changeStatus('applied');
            }}
          >
            <SendIcon />
            <ButtonLabel>{t('page.markApplied')}</ButtonLabel>
          </Button>
        );
      }
      case 'applied': {
        return (
          <Button size="sm" asChild>
            <Link to={interviewsTab} preventScrollReset>
              <CalendarPlusIcon />
              <ButtonLabel>{t('page.addInterview')}</ButtonLabel>
            </Link>
          </Button>
        );
      }
      case 'invited': {
        return (
          <Button size="sm" asChild>
            <Link to={{ search: `?tab=interviews&interview=${String(nextInterviewNumber)}` }} preventScrollReset>
              <CalendarClockIcon />
              <ButtonLabel>{t('page.seeInterview', { number: nextInterviewNumber })}</ButtonLabel>
            </Link>
          </Button>
        );
      }
      case 'interviewed': {
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" isPending={statusFetcher.state !== 'idle'}>
                <FlagIcon />
                <ButtonLabel>{t('page.recordOutcome')}</ButtonLabel>
                <ChevronDownIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {outcomeList.map((status) => (
                <DropdownMenuItem
                  key={status}
                  onSelect={() => {
                    changeStatus(status);
                  }}
                >
                  {OUTCOME_ICON_BY_STATUS[status]}
                  {t(`outcomeLabelByStatus.${status}`)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      }
      case 'hired':
      case 'rejected': {
        return (
          <Button
            size="sm"
            variant="outline"
            isPending={isApplying}
            onClick={() => {
              changeStatus('applied');
            }}
          >
            <RotateCcwIcon />
            <ButtonLabel>{t('backInProgress')}</ButtonLabel>
          </Button>
        );
      }
    }
  }

  return (
    <>
      {renderPrimary()}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon-sm" aria-label={t('page.moreActions')}>
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-60">
          {isInProgress && (
            <>
              {step !== 'applied' && (
                <DropdownMenuItem asChild>
                  <Link to={interviewsTab} preventScrollReset>
                    <CalendarPlusIcon />
                    {t('page.addInterview')}
                  </Link>
                </DropdownMenuItem>
              )}
              {outcomeList.map((status) => (
                <DropdownMenuItem
                  key={status}
                  onSelect={() => {
                    changeStatus(status);
                  }}
                >
                  {OUTCOME_ICON_BY_STATUS[status]}
                  {t(`outcomeLabelByStatus.${status}`)}
                </DropdownMenuItem>
              ))}
              {statusChoiceList.includes('to_apply') && (
                <DropdownMenuItem
                  onSelect={() => {
                    changeStatus('to_apply');
                  }}
                >
                  <RotateCcwIcon />
                  {t('page.backToApply')}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
            </>
          )}
          {url !== null && (
            <DropdownMenuItem asChild>
              <a href={url} target="_blank" rel="noreferrer">
                <ExternalLinkIcon />
                {t('page.openOnSource')}
              </a>
            </DropdownMenuItem>
          )}
          {repostOf !== null && (
            <DropdownMenuItem asChild>
              <Link to={`/postings/${repostOf.reference}`}>
                <RepeatIcon />
                {t('page.repostOf', { reference: repostOf.reference })}
              </Link>
            </DropdownMenuItem>
          )}
          {(url !== null || repostOf !== null) && <DropdownMenuSeparator />}
          <DropdownMenuItem
            disabled={archiveFetcher.state !== 'idle'}
            onSelect={() => {
              submitArchive(archiveIntent);
            }}
          >
            {isArchived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
            {archiveLabel}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
