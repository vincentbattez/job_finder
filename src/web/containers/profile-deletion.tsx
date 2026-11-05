import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetcher } from 'react-router';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/web/components/ui/alert-dialog.tsx';
import type { IRefusal } from '#/web/failure.ts';

import { useFeedback } from './use-feedback.ts';

type DeletionIntent = 'delete' | 'deleteUpload';

export interface IProfileDeletion {
  ask: (intent: DeletionIntent, fileName: string) => void;
  // The file whose deletion is on its way, whose button is pending
  pendingFileName: string | null;
  dialog: ReactNode;
}

// Deleting a document of the Profile or an Upload goes through one AlertDialog; its fetcher belongs to
// the page, which outlives the row it removes, so that the toast still shows
export function useProfileDeletion(): IProfileDeletion {
  const { t } = useTranslation('settings');
  const [deletion, setDeletion] = useState<{ isOpen: boolean; intent: DeletionIntent; fileName: string }>({
    isOpen: false,
    intent: 'delete',
    fileName: '',
  });
  const { fileName } = deletion;
  const fetcher = useFetcher<IRefusal>();
  useFeedback(fetcher, () => t('profileFile.deleted', { fileName }));
  return {
    ask: (intent, askedFileName) => {
      setDeletion({ isOpen: true, intent, fileName: askedFileName });
    },
    pendingFileName: fetcher.state === 'idle' ? null : fileName,
    dialog: (
      <AlertDialog
        open={deletion.isOpen}
        onOpenChange={(isOpen) => {
          setDeletion({ ...deletion, isOpen });
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('profileFile.deleteTitle', { fileName })}</AlertDialogTitle>
            <AlertDialogDescription>{t('profileFile.deleteDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('profileFile.keep')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                void fetcher.submit(
                  { intent: deletion.intent, fileName },
                  { method: 'post', action: '/profile', preventScrollReset: true },
                );
              }}
            >
              {t('profileFile.confirmDelete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    ),
  };
}
