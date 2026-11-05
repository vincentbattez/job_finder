import { cn } from 'cn';
import { FileUpIcon, UploadIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '#/web/components/ui/button.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/web/components/ui/dialog.tsx';
import { Label } from '#/web/components/ui/label.tsx';
import { Textarea } from '#/web/components/ui/textarea.tsx';

const TEXT_FILE_ACCEPT = '.md,.markdown,.mdx,.txt,text/markdown,text/plain';

// The import of New's header: a file dropped or chosen fills the text, which a paste fills as well
export function JobDescriptionImportDialog({
  isOpen,
  onOpenChange,
  text,
  fileName,
  isPending,
  onTextChange,
  onFile,
  onSubmit,
}: Readonly<{
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  text: string;
  fileName: string | null;
  isPending: boolean;
  onTextChange: (text: string) => void;
  onFile: (file: File) => void;
  onSubmit: () => void;
}>) {
  const { t } = useTranslation('lists');
  const textId = useId();
  const [isDragOver, setIsDragOver] = useState(false);

  function takeFile(file: File | undefined): void {
    if (file !== undefined) {
      onFile(file);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-title">{t('jobDescriptionImport.heading')}</DialogTitle>
          <DialogDescription>{t('jobDescriptionImport.description')}</DialogDescription>
        </DialogHeader>
        <label
          onDragOver={(event) => {
            // Lets the file drop here, instead of the browser opening it
            event.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => {
            setIsDragOver(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragOver(false);
            takeFile(event.dataTransfer.files[0]);
          }}
          className={cn(
            'flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center text-sm transition-colors hover:bg-muted/50 has-focus-visible:ring-3 has-focus-visible:ring-ring/50',
            isDragOver && 'border-primary bg-primary/5',
          )}
        >
          <FileUpIcon aria-hidden className="size-6 text-muted-foreground" />
          {fileName === null ? (
            <>
              <span className="font-medium">{t('jobDescriptionImport.dropPrompt')}</span>
              <span className="text-muted-foreground">{t('jobDescriptionImport.dropHint')}</span>
            </>
          ) : (
            <span className="font-medium">{fileName}</span>
          )}
          <input
            type="file"
            accept={TEXT_FILE_ACCEPT}
            className="sr-only"
            onChange={(event) => {
              takeFile(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
        </label>
        <div className="grid gap-1.5">
          <Label htmlFor={textId} className="text-xs text-muted-foreground">
            {t('jobDescriptionImport.orPaste')}
          </Label>
          <Textarea
            id={textId}
            aria-label={t('jobDescriptionImport.textLabel')}
            value={text}
            placeholder={t('jobDescriptionImport.textPlaceholder')}
            className="max-h-48 min-h-24"
            onChange={(event) => {
              onTextChange(event.target.value);
            }}
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            {t('jobDescriptionImport.cancel')}
          </Button>
          <Button disabled={text.trim() === ''} isPending={isPending} onClick={onSubmit}>
            <UploadIcon aria-hidden />
            {t('jobDescriptionImport.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
