// PROTOTYPE · Posting page agent. « Ajouter la mienne »: the Candidate brings their own Version of an
// Artifact, pasted, dropped as a .md, or dropped as a PDF (its conversion simulated). It lands as a
// Draft with no Original, to validate like any other.
import { FileTextIcon, FileUpIcon, LoaderIcon } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';

import { Button } from '#/web/prototype/components/ui/button.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/web/prototype/components/ui/dialog.tsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/web/prototype/components/ui/tabs.tsx';
import { Textarea } from '#/web/prototype/components/ui/textarea.tsx';
import { cn } from '#/web/prototype/lib/utils.ts';

const PDF_CONVERSION_MS = 1200;

function DropZone({ accept, hint, onFile }: { accept: string; hint: string; onFile: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOver, setIsOver] = useState(false);
  function onDrop(event: DragEvent) {
    event.preventDefault();
    setIsOver(false);
    const file = event.dataTransfer.files[0];
    if (file !== undefined) {
      onFile(file);
    }
  }
  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      onDragOver={(event) => {
        event.preventDefault();
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={onDrop}
      className={cn(
        'flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/40',
        isOver && 'border-primary bg-primary/5 text-foreground',
      )}
    >
      <FileUpIcon className="size-6" />
      <span className="font-medium text-foreground">Dépose un fichier ici, ou clique pour le choisir</span>
      <span className="text-xs">{hint}</span>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file !== undefined) {
            onFile(file);
          }
        }}
      />
    </button>
  );
}

export function AddVersionDialog({
  label,
  isOpen,
  onOpenChange,
  onAdd,
}: {
  // « la Recherche », « la Lettre »…
  label: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onAdd: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [isPending, setIsPending] = useState(false);

  function reset() {
    setText('');
    setFileName(null);
    setIsConverting(false);
  }

  async function readMarkdown(file: File) {
    setFileName(file.name);
    setText(await file.text());
  }

  function convertPdf(file: File) {
    setFileName(file.name);
    setIsConverting(true);
    setTimeout(() => {
      setIsConverting(false);
      setText(
        `# ${file.name.replace(/\.pdf$/iu, '')}\n\n_Texte extrait du PDF « ${file.name} » (conversion simulée dans le prototype)._\n\nLe texte converti apparaît ici, prêt à relire avant de l’ajouter.`,
      );
    }, PDF_CONVERSION_MS);
  }

  async function submit() {
    setIsPending(true);
    await onAdd(text);
    setIsPending(false);
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          reset();
        }
        onOpenChange(open);
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ajouter ta propre version de {label}</DialogTitle>
          <DialogDescription>
            Elle arrive en Brouillon, sans Original à comparer : relis-la puis valide-la pour qu’elle devienne la
            Version retenue.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="paste" className="gap-3">
          <TabsList>
            <TabsTrigger value="paste">Coller un texte</TabsTrigger>
            <TabsTrigger value="markdown">Fichier .md</TabsTrigger>
            <TabsTrigger value="pdf">PDF</TabsTrigger>
          </TabsList>
          <TabsContent value="paste">
            <Textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Colle ici ton texte (Markdown accepté)…"
              className="min-h-64 font-mono text-sm"
            />
          </TabsContent>
          <TabsContent value="markdown" className="space-y-3">
            <DropZone
              accept=".md,.mdx,.txt,text/markdown"
              hint="Markdown ou MDX"
              onFile={(file) => void readMarkdown(file)}
            />
          </TabsContent>
          <TabsContent value="pdf" className="space-y-3">
            <DropZone
              accept="application/pdf,.pdf"
              hint="Converti en texte, à relire avant l’ajout"
              onFile={convertPdf}
            />
          </TabsContent>
        </Tabs>
        {fileName === null ? null : (
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
            {isConverting ? <LoaderIcon className="size-4 animate-spin" /> : <FileTextIcon className="size-4" />}
            <span className="truncate font-medium">{fileName}</span>
            <span className="ml-auto shrink-0 text-xs text-muted-foreground">
              {isConverting ? 'Conversion…' : `${String(text.length)} caractères lus`}
            </span>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button disabled={text.trim() === '' || isPending || isConverting} onClick={() => void submit()}>
            {isPending ? 'Ajout…' : 'Ajouter en Brouillon'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
