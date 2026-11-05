import { useTranslation } from 'react-i18next';

import type { ILetterStanding } from '#/web/components/artifact.ts';
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

// Marking Applied while the Letter is not validated asks first (spec #125, « The Posting page »): validate the
// Draft and mark Applied at once, or mark Applied without a Letter, which an older Chosen Version gives way to
export function AppliedDialog({
  isOpen,
  onOpenChange,
  draftNumber,
  chosenNumber,
  onApply,
}: Readonly<
  ILetterStanding & {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onApply: (letterNumber: number | null) => void;
  }
>) {
  const { t } = useTranslation('posting');
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('appliedDialog.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {draftNumber === null
              ? t('appliedDialog.noLetterDescription')
              : t('appliedDialog.draftDescription', { number: draftNumber })}
            {chosenNumber !== null && ` ${t('appliedDialog.olderChosenDescription', { number: chosenNumber })}`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:flex-wrap">
          <AlertDialogCancel>{t('appliedDialog.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            variant={draftNumber === null ? 'default' : 'outline'}
            onClick={() => {
              onApply(null);
            }}
          >
            {t('appliedDialog.applyWithoutLetter')}
          </AlertDialogAction>
          {draftNumber !== null && (
            <AlertDialogAction
              onClick={() => {
                onApply(draftNumber);
              }}
            >
              {t('appliedDialog.validateAndApply')}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
