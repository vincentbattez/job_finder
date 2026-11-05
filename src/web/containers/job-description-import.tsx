import { UploadIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetcher, useNavigate } from 'react-router';
import { toast } from 'sonner';

import { JobDescriptionImportDialog } from '#/web/components/job-description-import-dialog.tsx';
import { HeaderActionLabel } from '#/web/components/page-header.tsx';
import { Button } from '#/web/components/ui/button.tsx';
import { useIsHydrated } from '#/web/components/use-is-hydrated.ts';
import type { IRefusal } from '#/web/failure.ts';

import { useFeedback } from './use-feedback.ts';

// A file read in the browser into the text, whatever a drop lets through the input's accept
const TEXT_FILE_PATTERN = /\.(?:md|markdown|mdx|txt)$/iu;

// The shape of the import action: the job of the extraction, with its Posting
interface IImport extends IRefusal {
  job: { posting: { title: string } } | null;
}

// The same action as jf import, by a dropped file or a pasted text; the Posting is named after its file,
// or as pasted, until the worker reads its fields, then its Research follows (ADR-0018)
export function JobDescriptionImport() {
  const fetcher = useFetcher<IImport>();
  const { t } = useTranslation('lists');
  const navigate = useNavigate();
  const isHydrated = useIsHydrated();
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const isSentReference = useRef(false);
  useFeedback(
    fetcher,
    () => t('jobDescriptionImport.imported', { title: fetcher.data?.job?.posting.title }),
    () => ({
      label: t('jobDescriptionImport.see'),
      onClick: () => {
        void navigate('/to-apply');
      },
    }),
  );
  // Imported, the dialog closes empty; refused, it keeps what was typed
  useEffect(() => {
    if (fetcher.state !== 'idle' || !isSentReference.current) {
      return;
    }
    isSentReference.current = false;
    if (fetcher.data?.job == null) {
      return;
    }
    setIsOpen(false);
    setText('');
    setFileName(null);
  }, [fetcher.state, fetcher.data]);

  async function readFile(file: File): Promise<void> {
    if (!TEXT_FILE_PATTERN.test(file.name)) {
      toast.error(t('jobDescriptionImport.notText', { fileName: file.name }));
      return;
    }
    setText(await file.text());
    setFileName(file.name);
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={!isHydrated}
        onClick={() => {
          setIsOpen(true);
        }}
      >
        <UploadIcon aria-hidden />
        <HeaderActionLabel>{t('jobDescriptionImport.open')}</HeaderActionLabel>
      </Button>
      <JobDescriptionImportDialog
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        text={text}
        fileName={fileName}
        isPending={fetcher.state !== 'idle'}
        onTextChange={(newText) => {
          setText(newText);
          if (newText === '') {
            setFileName(null);
          }
        }}
        onFile={(file) => void readFile(file)}
        onSubmit={() => {
          isSentReference.current = true;
          void fetcher.submit(
            { fileName: fileName ?? t('jobDescriptionImport.pastedTitle'), markdown: text },
            { method: 'post', action: '/import' },
          );
        }}
      />
    </>
  );
}
