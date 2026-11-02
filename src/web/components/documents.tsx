import { FilePlus2Icon, FileTextIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ArtifactText } from '#/web/components/mdx/artifact-text.tsx';
import { AsideSection } from '#/web/components/posting-facts.tsx';
import { Badge } from '#/web/components/ui/badge.tsx';
import { Button } from '#/web/components/ui/button.tsx';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '#/web/components/ui/dialog.tsx';

// A Custom Artifact as the Documents section reads it
export interface ICustomArtifact {
  key: string;
  title: string;
  interviewNumber: number | null;
  text: string;
  createdAt: Date;
}

// The Documents section of the Posting tab (spec #125): the Custom Artifacts of the Posting and of its
// Interviews, each read in a Dialog, and Add a document
export function DocumentsSection({
  customArtifactList,
  onAdd,
}: Readonly<{ customArtifactList: ICustomArtifact[]; onAdd: () => void }>) {
  const { t } = useTranslation('posting');
  const [openKey, setOpenKey] = useState<string | null>(null);
  const open = customArtifactList.find(({ key }) => key === openKey);
  return (
    <AsideSection
      title={t('documents.heading')}
      icon={<FileTextIcon />}
      action={
        <Button variant="ghost" size="xs" aria-label={t('documents.addLabel')} onClick={onAdd}>
          <FilePlus2Icon aria-hidden />
          {t('documents.add')}
        </Button>
      }
    >
      {customArtifactList.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('documents.empty')}</p>
      ) : (
        <ul className="-mx-1 space-y-0.5">
          {customArtifactList.map(({ key, title, interviewNumber }) => (
            <li key={key}>
              <button
                type="button"
                aria-label={t('documents.open', { title })}
                onClick={() => {
                  setOpenKey(key);
                }}
                className="flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-left text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <FileTextIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{title}</span>
                {interviewNumber !== null && (
                  <Badge variant="outline">{t('documents.ofInterview', { number: interviewNumber })}</Badge>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      <Dialog
        open={open !== undefined}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setOpenKey(null);
          }
        }}
      >
        <DialogContent className="max-h-[calc(100svh-6rem)] overflow-y-auto sm:max-w-2xl">
          {open !== undefined && (
            <>
              <DialogHeader>
                <DialogTitle className="text-title">{open.title}</DialogTitle>
                <DialogDescription>
                  {open.interviewNumber === null
                    ? t('documents.readDescription', { date: open.createdAt })
                    : t('documents.readDescriptionOfInterview', { date: open.createdAt, number: open.interviewNumber })}
                </DialogDescription>
              </DialogHeader>
              <ArtifactText text={open.text} format="mdx" className="prose-sm" />
            </>
          )}
        </DialogContent>
      </Dialog>
    </AsideSection>
  );
}
