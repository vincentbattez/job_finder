import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetcher } from 'react-router';

import { AddDocumentFields } from '#/web/components/add-document.tsx';
import { Button } from '#/web/components/ui/button.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/web/components/ui/dialog.tsx';
import type { IRefusal } from '#/web/failure.ts';

import { useFeedback } from './use-feedback.ts';

interface IAddDocumentOption {
  reference: string;
  // The Interview of the panel it opens from, which a Custom Artifact then belongs to
  interviewNumber: number | null;
  isAnnexAllowed: boolean;
  // Opened from the generation panel, which checks what it adds at once
  isFromPanel: boolean;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  // The key of the Input added: a Custom Artifact's, or the Annex's in the Profile
  onAdded?: (key: string) => void;
}

// Add a document (spec #125, « Custom Artifacts and Annexes »): a Custom Artifact of the Posting,
// or of the Interview of the panel, or an Annex in the Profile; the documents route answers the key of
// the Input added, and the form keeps what was typed when it is refused
export function AddDocumentDialog({
  reference,
  interviewNumber,
  isAnnexAllowed,
  isFromPanel,
  isOpen,
  onOpenChange,
  onAdded,
}: Readonly<IAddDocumentOption>) {
  const { t } = useTranslation('posting');
  const fetcher = useFetcher<IRefusal & { added?: { key: string } }>();
  const sent = useRef<{ isSent: boolean; title: string; scope: string }>({ isSent: false, title: '', scope: '' });
  useFeedback(fetcher, () =>
    t(sent.current.scope === 'profile' ? 'documents.annexAdded' : 'documents.added', { title: sent.current.title }),
  );
  const onAddedReference = useRef(onAdded);
  onAddedReference.current = onAdded;
  const onOpenChangeReference = useRef(onOpenChange);
  onOpenChangeReference.current = onOpenChange;
  useEffect(() => {
    if (fetcher.state !== 'idle' || !sent.current.isSent) {
      return;
    }
    sent.current.isSent = false;
    if (fetcher.data?.added === undefined) {
      return;
    }
    onAddedReference.current?.(fetcher.data.added.key);
    onOpenChangeReference.current(false);
  }, [fetcher.state, fetcher.data]);
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-title">
            {isFromPanel ? t('documents.dialogTitleFromPanel') : t('documents.dialogTitle')}
          </DialogTitle>
          <DialogDescription>
            {isFromPanel ? t('documents.dialogDescriptionFromPanel') : t('documents.dialogDescription')}
          </DialogDescription>
        </DialogHeader>
        {isOpen && (
          <form
            className="grid gap-6"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              const textOf = (name: string) => {
                const value = formData.get(name);
                return typeof value === 'string' ? value : '';
              };
              sent.current = { isSent: true, title: textOf('title'), scope: textOf('scope') };
              void fetcher.submit(formData, {
                method: 'post',
                action: `/postings/${encodeURIComponent(reference)}/documents`,
                preventScrollReset: true,
              });
            }}
          >
            {interviewNumber !== null && <input type="hidden" name="interview" value={interviewNumber} />}
            <AddDocumentFields interviewNumber={interviewNumber} isAnnexAllowed={isAnnexAllowed} />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                }}
              >
                {t('documents.cancel')}
              </Button>
              <Button type="submit" isPending={fetcher.state !== 'idle'}>
                {isFromPanel ? t('documents.submitFromPanel') : t('documents.submit')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
