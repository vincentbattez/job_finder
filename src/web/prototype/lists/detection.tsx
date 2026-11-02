// PROTOTYPE. The header of New (DECISIONS.md « Navigation »): Detection and Import. A Detection shows
// live in a collapsible Card under the header, one line per Watch; the Postings it finds land on top
// of the list; its result links to the Watches page for the Near Misses. Import is a stub: a drop zone
// or pasted text, then a toast (an imported Job Description would skip New and start To Apply).
import { CheckCircle2Icon, ChevronDownIcon, FileUpIcon, Loader2Icon, RadarIcon, UploadIcon, XIcon } from 'lucide-react';
import { useState, type DragEvent } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';

import { Button } from '#/web/prototype/components/ui/button.tsx';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '#/web/prototype/components/ui/collapsible.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/web/prototype/components/ui/dialog.tsx';
import { Progress } from '#/web/prototype/components/ui/progress.tsx';
import { Textarea } from '#/web/prototype/components/ui/textarea.tsx';
import { cn } from '#/web/prototype/lib/utils.ts';

import { useActions, useDetection, usePrototype } from '../store.ts';

function ImportDialog({ isOpen, onOpenChange }: { isOpen: boolean; onOpenChange: (isOpen: boolean) => void }) {
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPending, setIsPending] = useState(false);

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file !== undefined) {
      setFileName(file.name);
    }
  }

  async function submit() {
    setIsPending(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    setIsPending(false);
    onOpenChange(false);
    setText('');
    setFileName(null);
    toast.info('Import simulé : rien n’a été enregistré', {
      description: 'Une Fiche de poste importée passe directement À traiter et lance sa Recherche.',
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importer une Fiche de poste</DialogTitle>
          <DialogDescription>
            Une offre trouvée ailleurs que dans tes Veilles : elle passe directement À traiter.
          </DialogDescription>
        </DialogHeader>
        <label
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={cn(
            'flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center text-sm transition-colors hover:bg-muted/50',
            isDragging && 'border-primary bg-primary/5',
          )}
        >
          <FileUpIcon className="size-6 text-muted-foreground" />
          {fileName === null ? (
            <>
              <span className="font-medium">Dépose un fichier ici</span>
              <span className="text-muted-foreground">PDF, Markdown ou texte · ou clique pour choisir</span>
            </>
          ) : (
            <span className="font-medium">{fileName}</span>
          )}
          <input
            type="file"
            accept=".pdf,.md,.txt"
            className="sr-only"
            onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
          />
        </label>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          ou colle son texte
          <span className="h-px flex-1 bg-border" />
        </div>
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Intitulé, employeur, lieu, missions…"
          className="max-h-48 min-h-24"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button disabled={isPending || (text.trim() === '' && fileName === null)} onClick={() => void submit()}>
            {isPending ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}
            Importer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Import and Detection, on the right of New's header
export function NewHeaderActions() {
  const actions = useActions();
  const detection = useDetection();
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const isRunning = detection?.isRunning === true;

  async function start() {
    setIsStarting(true);
    await actions.startDetection();
    setIsStarting(false);
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setIsImportOpen(true)} aria-label="Importer">
        <UploadIcon />
        <span className="hidden sm:inline">Importer</span>
      </Button>
      <Button
        size="sm"
        disabled={isRunning || isStarting}
        onClick={() => void start()}
        aria-label="Lancer une Détection"
      >
        {isRunning || isStarting ? <Loader2Icon className="animate-spin" /> : <RadarIcon />}
        <span className="hidden sm:inline">{isRunning ? 'Détection en cours…' : 'Lancer une Détection'}</span>
      </Button>
      <ImportDialog isOpen={isImportOpen} onOpenChange={setIsImportOpen} />
    </>
  );
}

// The live progress of the Detection, then its result, until closed or the next one starts
export function DetectionCard({ className }: { className?: string }) {
  const detection = useDetection();
  const { watches } = usePrototype();
  const [closedStartedAt, setClosedStartedAt] = useState<number | null>(null);
  const [isOpen, setIsOpen] = useState(true);
  if (detection === null || closedStartedAt === detection.startedAt) {
    return null;
  }
  const doneCount = detection.watches.filter(({ step }) => step === 'done').length;
  const total = detection.watches.length;
  const readCount = detection.watches.reduce((sum, watch) => sum + watch.readCount, 0);
  const readTotal = detection.watches.reduce((sum, watch) => sum + watch.readTotal, 0);
  const foundCount = detection.foundReferences.length;
  const nearMissCount = watches.reduce((sum, watch) => sum + watch.nearMisses.length, 0);
  const title = detection.isRunning
    ? `Détection en cours · ${String(doneCount)}/${String(total)} ${total > 1 ? 'Veilles' : 'Veille'}`
    : foundCount === 0
      ? 'Détection terminée · aucune nouvelle Offre'
      : `Détection terminée · ${String(foundCount)} ${foundCount > 1 ? 'nouvelles Offres' : 'nouvelle Offre'} en tête de liste`;

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={cn(
        'mx-4 mt-3 shrink-0 rounded-lg border bg-card text-sm shadow-xs',
        !detection.isRunning && foundCount > 0 && 'border-primary/30',
        className,
      )}
    >
      <div className="flex items-center gap-3 px-3 py-2">
        {detection.isRunning ? (
          <Loader2Icon className="size-4 shrink-0 animate-spin text-primary" />
        ) : (
          <CheckCircle2Icon className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        )}
        <span className="min-w-0 flex-1 truncate font-medium">{title}</span>
        {detection.isRunning ? (
          <Progress value={(readCount / Math.max(1, readTotal)) * 100} className="hidden w-32 sm:flex" />
        ) : (
          <Button asChild variant="link" size="sm" className="hidden h-auto px-0 sm:inline-flex">
            <Link to="/prototype/watches#near-misses">
              {nearMissCount > 0 ? `${String(nearMissCount)} titres écartés de peu` : 'Voir les Veilles'}
            </Link>
          </Button>
        )}
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="icon-xs" aria-label={isOpen ? 'Replier' : 'Déplier'}>
            <ChevronDownIcon className={cn('transition-transform', isOpen && 'rotate-180')} />
          </Button>
        </CollapsibleTrigger>
        {detection.isRunning ? null : (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Fermer"
            onClick={() => setClosedStartedAt(detection.startedAt)}
          >
            <XIcon />
          </Button>
        )}
      </div>
      <CollapsibleContent>
        <ul className="divide-y border-t">
          {detection.watches.map((watch) => (
            <li
              key={watch.id}
              className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_12rem_8rem]"
            >
              <span className="flex min-w-0 items-center gap-2">
                <RadarIcon
                  className={cn(
                    'size-3.5 shrink-0 text-muted-foreground',
                    watch.step !== 'done' && watch.step !== 'waiting' && 'text-primary',
                  )}
                />
                <span className="truncate">{watch.label}</span>
              </span>
              <span className="text-xs text-muted-foreground sm:order-none">
                {watch.stepLabel}
                {watch.step === 'reading' ? ` · ${String(watch.readCount)}/${String(watch.readTotal)}` : ''}
              </span>
              <span className="col-span-2 sm:col-span-1">
                {watch.step === 'done' ? (
                  <span className="text-xs font-medium">
                    {watch.foundReferences.length === 0
                      ? 'Rien de nouveau'
                      : `${String(watch.foundReferences.length)} trouvée${watch.foundReferences.length > 1 ? 's' : ''}`}
                  </span>
                ) : (
                  <Progress value={(watch.readCount / Math.max(1, watch.readTotal)) * 100} />
                )}
              </span>
            </li>
          ))}
        </ul>
        {detection.isRunning ? null : (
          <p className="border-t px-3 py-2 text-xs text-muted-foreground sm:hidden">
            <Link to="/prototype/watches#near-misses" className="text-primary underline-offset-4 hover:underline">
              Titres écartés de peu, dans les Veilles
            </Link>
          </p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
