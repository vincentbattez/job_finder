import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  CheckIcon,
  RotateCcwIcon,
  SendIcon,
  ThumbsDownIcon,
  TrophyIcon,
  XIcon,
} from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetcher, useSearchParams } from 'react-router';

import type { Actions } from '#/actions/index.ts';
import { PostingSheet as PostingSheetView } from '#/web/components/posting-sheet.tsx';
import type { Status } from '#/web/components/step-badge.tsx';
import { Button } from '#/web/components/ui/button.tsx';
import type { IRefusal } from '#/web/failure.ts';

import { Notes } from './notes.tsx';
import { useFeedback } from './use-feedback.ts';

type SheetPosting = Awaited<ReturnType<Actions['readPosting']>>;

const SHEET_PARAMETER = 'posting';

// The Sheet's Posting lives in the URL (`?posting=<reference>`, spec #125 « Navigation and URL state »):
// each opening is a step of the history, so Back shows the previous one again and a link opens it
export function useSheetSelection() {
  const [searchParameters, setSearchParameters] = useSearchParams();
  const change = (reference: string | null) => {
    setSearchParameters(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (reference === null) {
          next.delete(SHEET_PARAMETER);
        } else {
          next.set(SHEET_PARAMETER, reference);
        }
        return next;
      },
      { preventScrollReset: true },
    );
  };
  return {
    selectedReference: searchParameters.get(SHEET_PARAMETER),
    onSelect: (reference: string) => {
      change(reference);
    },
    onClose: () => {
      change(null);
    },
  };
}

const IN_PROGRESS_STATUS_LIST = new Set<string>(['applied', 'invited', 'interviewed']);

// The actions of the Posting's Step (spec #125 « The Sheet »): keep or dismiss when New, mark Applied
// when To Apply, the outcomes when In progress, put back In progress once closed, and archive always.
// Each posts through its route; archiving acts at once and offers its undo in the toast.
function SheetActions({ posting, statusChoiceList }: Readonly<Pick<SheetPosting, 'posting' | 'statusChoiceList'>>) {
  const { t } = useTranslation('posting');
  const { reference, step } = posting;
  const isArchived = posting.archivedAt !== null;
  const isNew = step === 'new';
  const statusFetcher = useFetcher<IRefusal | null>();
  const archiveFetcher = useFetcher<IRefusal | null>();
  const keepFetcher = useFetcher<IRefusal | null>();
  const submittedStatus = useRef<Status>('applied');
  useFeedback(keepFetcher, () => t('page.kept'));
  useFeedback(statusFetcher, () =>
    t('page.statusChanged', { statusLabel: t(`statusLabelByStatus.${submittedStatus.current}`, { ns: 'common' }) }),
  );
  const submitArchive = (intent: 'archive' | 'unarchive') => {
    void archiveFetcher.submit(
      { intent },
      { method: 'post', action: `/postings/${reference}/archive`, preventScrollReset: true },
    );
  };
  // The toast tells what was just done, read once it settled: the Posting is then Archived, or no longer
  useFeedback(
    archiveFetcher,
    () => {
      if (!isArchived) {
        return t('page.unarchived');
      }
      return isNew ? t('page.dismissed') : t('page.archived');
    },
    () => ({
      label: t('page.undo'),
      onClick: () => {
        submitArchive(isArchived ? 'unarchive' : 'archive');
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
  const isStatusPending = (status: Status) => statusFetcher.state !== 'idle' && submittedStatus.current === status;
  const isArchivePending = archiveFetcher.state !== 'idle';

  if (isArchived) {
    return (
      <Button
        variant="outline"
        isPending={isArchivePending}
        onClick={() => {
          submitArchive('unarchive');
        }}
      >
        <ArchiveRestoreIcon />
        {t('unarchive')}
      </Button>
    );
  }
  if (isNew) {
    return (
      <>
        <Button
          isPending={keepFetcher.state !== 'idle'}
          onClick={() => {
            void keepFetcher.submit(
              {},
              { method: 'post', action: `/postings/${reference}/keep`, preventScrollReset: true },
            );
          }}
        >
          <CheckIcon />
          {t('page.keep')}
        </Button>
        <Button
          variant="outline"
          isPending={isArchivePending}
          onClick={() => {
            submitArchive('archive');
          }}
        >
          <XIcon />
          {t('page.dismiss')}
        </Button>
      </>
    );
  }
  const outcomeList = (['hired', 'rejected'] as const).filter((status) => statusChoiceList.includes(status));
  return (
    <>
      {step === 'to_apply' && (
        <Button
          isPending={isStatusPending('applied')}
          onClick={() => {
            changeStatus('applied');
          }}
        >
          <SendIcon />
          {t('page.markApplied')}
        </Button>
      )}
      {IN_PROGRESS_STATUS_LIST.has(step) &&
        outcomeList.map((status) => (
          <Button
            key={status}
            variant={status === 'hired' ? 'default' : 'outline'}
            isPending={isStatusPending(status)}
            onClick={() => {
              changeStatus(status);
            }}
          >
            {status === 'hired' ? <TrophyIcon /> : <ThumbsDownIcon />}
            {t(`outcomeLabelByStatus.${status}`)}
          </Button>
        ))}
      {(step === 'hired' || step === 'rejected') && (
        <Button
          variant="outline"
          isPending={isStatusPending('applied')}
          onClick={() => {
            changeStatus('applied');
          }}
        >
          <RotateCcwIcon />
          {t('backInProgress')}
        </Button>
      )}
      <Button
        variant="ghost"
        className="ml-auto text-muted-foreground"
        isPending={isArchivePending}
        onClick={() => {
          submitArchive('archive');
        }}
      >
        <ArchiveIcon />
        {t('archive')}
      </Button>
    </>
  );
}

// The Sheet of a list, on the Posting its loader read for the URL, with its actions and its Notes,
// which the Notes tab of the Posting page shows too
export function PostingSheet({ detail, onClose }: Readonly<{ detail: SheetPosting | null; onClose: () => void }>) {
  return (
    <PostingSheetView
      detail={detail}
      onClose={onClose}
      actions={
        detail !== null && (
          <SheetActions
            key={detail.posting.reference}
            posting={detail.posting}
            statusChoiceList={detail.statusChoiceList}
          />
        )
      }
      notes={
        detail !== null && (
          <Notes
            key={detail.posting.reference}
            reference={detail.posting.reference}
            notes={detail.posting.notes}
            isCompact
          />
        )
      }
    />
  );
}
