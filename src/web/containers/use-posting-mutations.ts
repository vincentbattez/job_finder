import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetcher } from 'react-router';

import type { ILetterStanding } from '#/web/components/artifact.ts';
import type { Status, Step } from '#/web/components/step-badge.tsx';
import type { IRefusal } from '#/web/failure.ts';

import { useFeedback } from './use-feedback.ts';

export const IN_PROGRESS_STEP_LIST: Set<Step> = new Set(['applied', 'invited', 'interviewed']);

// What the Sheet and the Posting page do to a Posting, each through its route, which refuses what the rules
// forbid; archiving acts at once and offers its undo in the toast
export function usePostingMutations({
  reference,
  step,
  isArchived,
  letter,
}: Readonly<{ reference: string; step: Step; isArchived: boolean; letter: ILetterStanding }>) {
  const { t } = useTranslation('posting');
  const statusFetcher = useFetcher<IRefusal>();
  const archiveFetcher = useFetcher<IRefusal>();
  const keepFetcher = useFetcher<IRefusal>();
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
  // The toast tells what was just done, read once it settled: the Posting is then Archived, or no longer.
  // Archiving a New Posting is dismissing it.
  useFeedback(
    archiveFetcher,
    () => {
      if (!isArchived) {
        return t('page.unarchived');
      }
      return step === 'new' ? t('page.dismissed') : t('page.archived');
    },
    () => ({
      label: t('page.undo'),
      onClick: () => {
        submitArchive(isArchived ? 'unarchive' : 'archive');
      },
    }),
  );
  const keep = () => {
    void keepFetcher.submit({}, { method: 'post', action: `/postings/${reference}/keep`, preventScrollReset: true });
  };
  const changeStatus = (
    status: Status,
    letterAnswer: { letterNumber: number } | { isWithoutLetter: true } | null = null,
  ) => {
    submittedStatus.current = status;
    void statusFetcher.submit(
      { status, ...letterAnswer },
      { method: 'post', action: `/postings/${reference}/status`, preventScrollReset: true },
    );
  };
  const [isAppliedDialogOpen, setIsAppliedDialogOpen] = useState(false);
  // The Letter sent is the one recorded: Applied waits for the Candidate's word on a Letter not validated
  const markApplied = () => {
    if (letter.draftNumber === null && letter.chosenNumber !== null) {
      changeStatus('applied');
    } else {
      setIsAppliedDialogOpen(true);
    }
  };
  return {
    keep,
    submitArchive,
    changeStatus,
    markApplied,
    isKeepPending: keepFetcher.state !== 'idle',
    isArchivePending: archiveFetcher.state !== 'idle',
    isAnyStatusPending: statusFetcher.state !== 'idle',
    // To Apply and the outcomes both offer Applied: only the button of the Status being sent spins
    isStatusPending: (status: Status) => statusFetcher.state !== 'idle' && submittedStatus.current === status,
    appliedDialog: {
      isOpen: isAppliedDialogOpen,
      onOpenChange: setIsAppliedDialogOpen,
      ...letter,
      onApply: (letterNumber: number | null) => {
        changeStatus('applied', letterNumber === null ? { isWithoutLetter: true } : { letterNumber });
      },
    },
  };
}
