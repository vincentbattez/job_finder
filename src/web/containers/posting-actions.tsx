import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  CalendarPlusIcon,
  CheckIcon,
  ChevronDownIcon,
  ExternalLinkIcon,
  FlagIcon,
  GraduationCapIcon,
  MoreHorizontalIcon,
  RepeatIcon,
  RotateCcwIcon,
  SendIcon,
  ThumbsDownIcon,
  TrophyIcon,
  XIcon,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { AppliedDialog } from '#/web/components/applied-dialog.tsx';
import type { ILetterStanding } from '#/web/components/artifact.ts';
import { revisionPathOf } from '#/web/components/interviews.tsx';
import { HeaderActionLabel } from '#/web/components/page-header.tsx';
import type { Status, Step } from '#/web/components/step-badge.tsx';
import { Button } from '#/web/components/ui/button.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/web/components/ui/dropdown-menu.tsx';

import { InterviewDialog, type IInterviewPosting } from './interview-dialog.tsx';
import { IN_PROGRESS_STEP_LIST, usePostingMutations } from './use-posting-mutations.ts';

interface IPostingActions {
  reference: string;
  step: Step;
  isArchived: boolean;
  // What the Status rules let the Posting move to (ADR-0007, ADR-0009)
  statusChoiceList: Status[];
  url: string | null;
  repostOf: { reference: string } | null;
  // The first Interview still to come, whose Revision an Invited Application leads to
  nextInterviewNumber: number | null;
  // What the Interview Dialog reads, which its add-an-Interview action opens here
  posting: IInterviewPosting;
  letter: ILetterStanding;
}

const OUTCOME_ICON_BY_STATUS = { hired: <TrophyIcon />, rejected: <ThumbsDownIcon /> };

// The head of the Posting page (spec #125, « The Posting page »): ONE primary action that follows the
// Step, the rest in a ⋯ menu. The Status goes through its route, which refuses what the Status rules
// forbid; archiving acts at once and offers its undo in the toast. A New Posting is kept, or dismissed
// from the menu, which archives it (ADR-0018).
export function PostingActions({
  reference,
  step,
  isArchived,
  statusChoiceList,
  url,
  repostOf,
  nextInterviewNumber,
  posting,
  letter,
}: Readonly<IPostingActions>) {
  const { t } = useTranslation('posting');
  const mutations = usePostingMutations({ reference, step, isArchived, letter });
  const {
    keep,
    submitArchive,
    changeStatus,
    markApplied,
    isStatusPending,
    isStatusBusy,
    isKeepPending,
    isArchivePending,
  } = mutations;
  const isNew = step === 'new';
  const archiveIntent = isArchived ? 'unarchive' : 'archive';
  const isApplying = isStatusPending('applied');
  const isInProgress = IN_PROGRESS_STEP_LIST.has(step) && !isArchived;
  const outcomeList = (['hired', 'rejected'] as const).filter((status) => statusChoiceList.includes(status));
  const [isInterviewDialogOpen, setIsInterviewDialogOpen] = useState(false);
  const openInterviewDialog = () => {
    setIsInterviewDialogOpen(true);
  };
  let archiveLabel = isArchived ? t('unarchive') : t('archive');
  let archiveIcon = isArchived ? <ArchiveRestoreIcon /> : <ArchiveIcon />;
  if (isNew && !isArchived) {
    archiveLabel = t('page.dismiss');
    archiveIcon = <XIcon />;
  }

  function renderPrimary() {
    if (isArchived) {
      return (
        <Button
          size="sm"
          isPending={isArchivePending}
          onClick={() => {
            submitArchive('unarchive');
          }}
        >
          <ArchiveRestoreIcon />
          <HeaderActionLabel>{t('unarchive')}</HeaderActionLabel>
        </Button>
      );
    }
    switch (step) {
      case 'new': {
        return (
          <Button size="sm" isPending={isKeepPending} onClick={keep}>
            <CheckIcon />
            <HeaderActionLabel>{t('page.keep')}</HeaderActionLabel>
          </Button>
        );
      }
      case 'to_apply': {
        return (
          <Button size="sm" isPending={isApplying} onClick={markApplied}>
            <SendIcon />
            <HeaderActionLabel>{t('page.markApplied')}</HeaderActionLabel>
          </Button>
        );
      }
      case 'applied': {
        return (
          <Button size="sm" onClick={openInterviewDialog}>
            <CalendarPlusIcon />
            <HeaderActionLabel>{t('page.addInterview')}</HeaderActionLabel>
          </Button>
        );
      }
      case 'invited': {
        return (
          <Button size="sm" asChild>
            <Link to={revisionPathOf(reference, nextInterviewNumber ?? 1)}>
              <GraduationCapIcon />
              <HeaderActionLabel>{t('page.revise', { number: nextInterviewNumber })}</HeaderActionLabel>
            </Link>
          </Button>
        );
      }
      case 'interviewed': {
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" isPending={isStatusBusy}>
                <FlagIcon />
                <HeaderActionLabel>{t('page.recordOutcome')}</HeaderActionLabel>
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
            <HeaderActionLabel>{t('backInProgress')}</HeaderActionLabel>
          </Button>
        );
      }
    }
  }

  return (
    <>
      {renderPrimary()}
      <AppliedDialog {...mutations.appliedDialog} />
      <InterviewDialog
        posting={posting}
        interview={null}
        isOpen={isInterviewDialogOpen}
        onOpenChange={setIsInterviewDialogOpen}
      />
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
                <DropdownMenuItem onSelect={openInterviewDialog}>
                  <CalendarPlusIcon />
                  {t('page.addInterview')}
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
            disabled={isArchivePending}
            onSelect={() => {
              submitArchive(archiveIntent);
            }}
          >
            {archiveIcon}
            {archiveLabel}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
