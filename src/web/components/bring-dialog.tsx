import { cn } from 'cn';
import { FileTextIcon, FileUpIcon } from 'lucide-react';
import { useId, useRef, useState, type DragEvent } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/web/components/ui/tabs.tsx';
import { Textarea } from '#/web/components/ui/textarea.tsx';

// What the Candidate brings: a text, pasted or read from a Markdown file, or a PDF the worker converts
export type Brought = { kind: 'text'; markdown: string } | { kind: 'pdf'; file: File };

const SOURCE_LIST = ['paste', 'markdown', 'pdf'] as const;

function isSource(value: string): value is (typeof SOURCE_LIST)[number] {
  return SOURCE_LIST.some((source) => source === value);
}

function FileDrop({ accept, hint, onFile }: Readonly<{ accept: string; hint: string; onFile: (file: File) => void }>) {
  const { t } = useTranslation('posting');
  const inputId = useId();
  const [isOver, setIsOver] = useState(false);
  const inputReference = useRef<HTMLInputElement>(null);
  function onDrop(event: DragEvent) {
    event.preventDefault();
    setIsOver(false);
    const file = event.dataTransfer.files[0];
    if (file !== undefined) {
      onFile(file);
    }
  }
  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setIsOver(true);
      }}
      onDragLeave={() => {
        setIsOver(false);
      }}
      onDrop={onDrop}
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 text-center text-sm text-muted-foreground transition-colors',
        isOver && 'border-primary bg-primary/5 text-foreground',
      )}
    >
      <FileUpIcon aria-hidden className="size-6" />
      <span className="font-medium text-foreground">{t('artifactView.bringDialog.drop')}</span>
      <span className="text-xs">{hint}</span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-1"
        onClick={() => inputReference.current?.click()}
      >
        {t('artifactView.bringDialog.chooseFile')}
      </Button>
      <Label htmlFor={inputId} className="sr-only">
        {t('artifactView.bringDialog.chooseFile')}
      </Label>
      <input
        ref={inputReference}
        id={inputId}
        type="file"
        accept={accept}
        tabIndex={-1}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file !== undefined) {
            onFile(file);
          }
          event.target.value = '';
        }}
      />
    </div>
  );
}

// Bringing my own Version (spec #125): a pasted text, a Markdown file or a PDF,
// which lands as a Draft with no Original
export function BringDialog({
  artifactLabel,
  isOpen,
  isPending,
  onOpenChange,
  onBring,
}: Readonly<{
  artifactLabel: string;
  isOpen: boolean;
  isPending: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onBring: (brought: Brought) => void;
}>) {
  const { t } = useTranslation('posting');
  const pasteId = useId();
  const [source, setSource] = useState<(typeof SOURCE_LIST)[number]>('paste');
  const [pasted, setPasted] = useState('');
  const [markdownFile, setMarkdownFile] = useState<{ name: string; text: string } | null>(null);
  const [pdf, setPdf] = useState<File | null>(null);

  function brought(): Brought | null {
    if (source === 'pdf') {
      return pdf === null ? null : { kind: 'pdf', file: pdf };
    }
    const markdown = source === 'paste' ? pasted : (markdownFile?.text ?? '');
    return markdown.trim() === '' ? null : { kind: 'text', markdown };
  }
  const ready = brought();

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setPasted('');
          setMarkdownFile(null);
          setPdf(null);
        }
        onOpenChange(open);
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="max-w-none text-title">
            {t('artifactView.bringDialog.title', { artifactLabel })}
          </DialogTitle>
          <DialogDescription>{t('artifactView.bringDialog.description')}</DialogDescription>
        </DialogHeader>
        <Tabs
          value={source}
          onValueChange={(value) => {
            if (isSource(value)) {
              setSource(value);
            }
          }}
          className="gap-3"
        >
          <TabsList>
            <TabsTrigger value="paste">{t('artifactView.bringDialog.paste')}</TabsTrigger>
            <TabsTrigger value="markdown">{t('artifactView.bringDialog.markdown')}</TabsTrigger>
            <TabsTrigger value="pdf">{t('artifactView.bringDialog.pdf')}</TabsTrigger>
          </TabsList>
          <TabsContent value="paste" className="space-y-2">
            <Label htmlFor={pasteId}>{t('artifactView.bringDialog.pasteLabel')}</Label>
            <Textarea
              id={pasteId}
              value={pasted}
              placeholder={t('artifactView.bringDialog.pastePlaceholder')}
              onChange={(event) => {
                setPasted(event.target.value);
              }}
              className="max-h-[50svh] min-h-64 font-mono text-sm"
            />
          </TabsContent>
          <TabsContent value="markdown">
            <FileDrop
              accept=".md,.mdx,.markdown,.txt,text/markdown,text/plain"
              hint={t('artifactView.bringDialog.markdownHint')}
              onFile={(file) => {
                void file.text().then((text) => {
                  setMarkdownFile({ name: file.name, text });
                });
              }}
            />
          </TabsContent>
          <TabsContent value="pdf">
            <FileDrop accept="application/pdf,.pdf" hint={t('artifactView.bringDialog.pdfHint')} onFile={setPdf} />
          </TabsContent>
        </Tabs>
        {source === 'markdown' && markdownFile !== null && (
          <p className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm tabular-nums">
            <FileTextIcon aria-hidden className="size-4 shrink-0" />
            {t('artifactView.bringDialog.fileRead', { fileName: markdownFile.name, count: markdownFile.text.length })}
          </p>
        )}
        {source === 'pdf' && pdf !== null && (
          <p className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
            <FileTextIcon aria-hidden className="size-4 shrink-0" />
            {t('artifactView.bringDialog.pdfChosen', { fileName: pdf.name })}
          </p>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            {t('artifactView.cancel')}
          </Button>
          <Button
            type="button"
            disabled={ready === null}
            isPending={isPending}
            onClick={() => {
              if (ready !== null) {
                onBring(ready);
              }
            }}
          >
            {t('artifactView.bringDialog.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
