// PROTOTYPE (branch prototype/v1-ux, never merged). Small pieces the three variants of the generation
// panel share: an Input's checkbox (locked with its reason when required), its exact content, the
// Instructions edited in place, the Fixed Part folded, the form adding a text or a file, the run's
// progress. Each variant lays them out its own way.
import {
  BriefcaseIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  FileCheck2Icon,
  FileUpIcon,
  LockIcon,
  PaperclipIcon,
  SendIcon,
  StickyNoteIcon,
  UserRoundIcon,
  type LucideIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { Alert, AlertDescription, AlertTitle } from '#/web/prototype/components/ui/alert.tsx';
import { Badge } from '#/web/prototype/components/ui/badge.tsx';
import { Button } from '#/web/prototype/components/ui/button.tsx';
import { Checkbox } from '#/web/prototype/components/ui/checkbox.tsx';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '#/web/prototype/components/ui/collapsible.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/web/prototype/components/ui/dialog.tsx';
import { Input } from '#/web/prototype/components/ui/input.tsx';
import { Label } from '#/web/prototype/components/ui/label.tsx';
import { Progress } from '#/web/prototype/components/ui/progress.tsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/web/prototype/components/ui/tabs.tsx';
import { Textarea } from '#/web/prototype/components/ui/textarea.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '#/web/prototype/components/ui/tooltip.tsx';
import { cn } from '#/web/prototype/lib/utils.ts';

import { ARTIFACT_LABEL, type IArtifact, type IInputSpec } from '../model.ts';
import { segmentsOf } from './fixed-part.ts';
import {
  checkedPhrase,
  formatWords,
  summarizeInputs,
  type GenerationPanelState,
  type IPanelInput,
} from './use-generation-panel.ts';

export const KIND_ICON: Record<IInputSpec['kind'], LucideIcon> = {
  job_description: BriefcaseIcon,
  artifact: FileCheck2Icon,
  notes: StickyNoteIcon,
  custom: PaperclipIcon,
  profile: UserRoundIcon,
  sent_letter: SendIcon,
};

// Radix Dialogs close on a click outside: the prototype switcher dock is not outside
export function keepSwitcherClicks(event: { target: EventTarget | null; preventDefault: () => void }) {
  if (event.target instanceof Element && event.target.closest('[data-prototype-switcher]') !== null) {
    event.preventDefault();
  }
}

// Opening focuses the panel itself: the first focusable is a lock whose tooltip would pop open
export function focusSelf(event: Event) {
  event.preventDefault();
  if (event.currentTarget instanceof HTMLElement) {
    event.currentTarget.focus();
  }
}

// The checkbox of an Input; a required one is locked, its tooltip says why
export function InputCheckbox({
  input,
  panel,
  className,
}: {
  input: IPanelInput;
  panel: GenerationPanelState;
  className?: string;
}) {
  if (input.mode === 'required') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn('inline-flex size-4 shrink-0 items-center justify-center text-muted-foreground', className)}
            aria-label={`Requis : ${input.reason ?? ''}`}
            tabIndex={0}
          >
            <LockIcon className="size-3.5" />
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-64">
          <div>
            <p className="font-medium">Toujours lu</p>
            <p className="opacity-80">{input.reason}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }
  return (
    <Checkbox
      id={`input-${input.key}`}
      className={className}
      checked={input.isChecked}
      onCheckedChange={(checked) => panel.setChecked(input.key, checked === true)}
      aria-label={input.label}
    />
  );
}

// A line of meta under an Input's label: its size, why it is there
export function InputMeta({ input }: { input: IPanelInput }) {
  if (input.mode === 'required' && !input.isAvailable) {
    return <span className="text-destructive">Pas encore de Version validée</span>;
  }
  return (
    <span>
      {formatWords(input.wordCount)}
      {input.mode === 'required' ? ' · requis' : ''}
    </span>
  );
}

// The exact text Claude reads, untouched
export function InputContent({ input, className }: { input: Pick<IPanelInput, 'content'>; className?: string }) {
  if (input.content.trim() === '') {
    return <p className={cn('text-sm text-muted-foreground italic', className)}>Vide pour l’instant.</p>;
  }
  return (
    <pre
      className={cn(
        'font-sans text-[13px] leading-relaxed whitespace-pre-wrap text-foreground/90 [overflow-wrap:anywhere]',
        className,
      )}
    >
      {input.content}
    </pre>
  );
}

// The Instructions, editable in place; saving makes them the Candidate's for every Artifact of the type
export function InstructionsEditor({
  panel,
  rows = 10,
  className,
}: {
  panel: GenerationPanelState;
  rows?: number;
  className?: string;
}) {
  const { instructions, type } = panel;
  const label = ARTIFACT_LABEL[type];
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={instructions.isCandidate ? 'default' : 'secondary'}>
          {instructions.isCandidate ? 'Tes Consignes' : 'Consignes par défaut'}
        </Badge>
        {instructions.isDirty ? (
          <span className="text-xs text-amber-700 dark:text-amber-400">Modifiées, pas encore enregistrées</span>
        ) : null}
      </div>
      <Textarea
        value={instructions.text}
        onChange={(event) => instructions.edit(event.target.value)}
        rows={rows}
        className="field-sizing-fixed resize-y font-sans text-[13px] leading-relaxed md:text-[13px]"
        aria-label={`Consignes de la ${label}`}
      />
      {instructions.isDirty ? (
        <div className="space-y-2 rounded-md border border-amber-300/60 bg-amber-50 p-3 text-xs dark:border-amber-500/30 dark:bg-amber-500/10">
          <p>
            Enregistrées, elles deviennent <strong>tes Consignes</strong> pour chaque {label} à venir, sur toutes tes
            Offres. Lancer sans enregistrer les enregistre aussi.
          </p>
          <div className="flex gap-2">
            <Button size="xs" disabled={instructions.isSaving} onClick={() => void instructions.save()}>
              Enregistrer comme mes Consignes
            </Button>
            <Button size="xs" variant="ghost" onClick={instructions.discard}>
              Annuler mes modifications
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {instructions.isCandidate
            ? `Elles s’appliquent à chaque ${label}. `
            : `Modifie-les ici : elles deviendront les tiennes pour chaque ${label}. `}
          {instructions.isCandidate ? (
            <button
              type="button"
              className="underline underline-offset-2 hover:text-foreground"
              disabled={instructions.isSaving}
              onClick={() => void instructions.restoreDefault()}
            >
              Rétablir celles par défaut
            </button>
          ) : null}
        </p>
      )}
    </div>
  );
}

// The Fixed Part of the Prompt: folded, read-only
export function FixedPartFold({ panel, className }: { panel: GenerationPanelState; className?: string }) {
  return (
    <Collapsible className={cn('rounded-lg border', className)}>
      <CollapsibleTrigger className="group flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm">
        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
        <span className="font-medium">Partie fixe du Prompt</span>
        <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
          <LockIcon className="size-3" /> non modifiable
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 border-t px-3 py-3">
        <FixedPartBody panel={panel} />
      </CollapsibleContent>
    </Collapsible>
  );
}

export function FixedPartBody({ panel }: { panel: GenerationPanelState }) {
  const { artifact, explanation } = panel;
  return (
    <>
      <p className="text-xs text-muted-foreground">
        Ce qui vient avec {explanation.theLabel} et qu’aucune Consigne ne peut lever : son objectif, les fichiers lus et
        écrits, ses règles.
        {artifact.isFixedPartExample ? ' Exemple tiré d’une autre Offre (chemins et référence de celle-ci).' : ''}
      </p>
      {artifact.fixedPart === null ? (
        <p className="text-sm text-muted-foreground italic">Indisponible dans cet instantané.</p>
      ) : (
        <>
          <SubstitutedLegend artifact={artifact} />
          <FixedPartText artifact={artifact} />
        </>
      )}
    </>
  );
}

const SUBSTITUTED_CLASS =
  'rounded-[3px] bg-violet-500/12 px-0.5 text-violet-800 ring-1 ring-violet-500/30 ring-inset dark:bg-violet-400/15 dark:text-violet-200 dark:ring-violet-400/30';

// « ▮ remplacé automatiquement », only when something was
export function SubstitutedLegend({ artifact, className }: { artifact: IArtifact; className?: string }) {
  if (artifact.fixedPartMarked == null) {
    return null;
  }
  return (
    <p className={cn('flex items-center gap-2 text-xs text-muted-foreground', className)}>
      <span className={cn(SUBSTITUTED_CLASS, 'shrink-0')}>surligné</span>
      <span>
        remplacé automatiquement pour cette Offre : référence, titre, employeur, chemins des fichiers, Entretien…
      </span>
    </p>
  );
}

// The Fixed Part's exact text, each substituted value highlighted
export function FixedPartText({ artifact, className }: { artifact: IArtifact; className?: string }) {
  const marked = artifact.fixedPartMarked;
  if (marked == null) {
    return (
      <InputContent input={{ content: artifact.fixedPart ?? '' }} className={cn('text-muted-foreground', className)} />
    );
  }
  return (
    <pre
      className={cn(
        'font-sans text-[13px] leading-relaxed whitespace-pre-wrap text-muted-foreground [overflow-wrap:anywhere]',
        className,
      )}
    >
      {segmentsOf(marked).map((segment, index) =>
        segment.isSubstituted ? (
          <mark key={index} className={SUBSTITUTED_CLASS} title="Remplacé automatiquement">
            {segment.text}
          </mark>
        ) : (
          segment.text
        ),
      )}
    </pre>
  );
}

// Why the run cannot start, when it cannot
export function Blockers({ panel }: { panel: GenerationPanelState }) {
  if (panel.blockers.length === 0) {
    return null;
  }
  return (
    <Alert variant="destructive">
      <AlertTitle>Impossible de lancer pour l’instant</AlertTitle>
      <AlertDescription>
        <ul className="list-disc pl-4">
          {panel.blockers.map((blocker) => (
            <li key={blocker}>{blocker}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

// « Prérempli comme la Version 2 »
export function PrefillNote({ panel, className }: { panel: GenerationPanelState; className?: string }) {
  const { previous } = panel;
  if (previous === undefined) {
    return null;
  }
  const readList = previous.inputs.map(({ label }) => label);
  return (
    <p className={cn('text-xs text-muted-foreground', className)}>
      Prérempli comme la <span className="font-medium text-foreground">v{previous.number}</span>
      {readList.length === 0 ? '.' : `, produite à partir de : ${readList.join(', ')}.`}
    </p>
  );
}

// The run once launched: its phase, its progress, then the Draft it wrote
export function RunProgress({ panel, onClose }: { panel: GenerationPanelState; onClose: () => void }) {
  const { run, explanation, artifact } = panel;
  if (run === undefined) {
    return null;
  }
  const isDone = run.status === 'done';
  return (
    <div className="space-y-4" aria-live="polite">
      <div className="flex items-start gap-3">
        {isDone ? (
          <CheckCircle2Icon className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <span className="mt-1.5 size-2.5 shrink-0 animate-pulse rounded-full bg-primary" />
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium">
            {isDone
              ? `Version ${String(run.versionNumber ?? '')} ${explanation.ofLabel} prête, en Brouillon`
              : `${run.phase}…`}
          </p>
          <p className="text-sm text-muted-foreground">
            {isDone
              ? `Relis-la puis valide-la pour qu’elle devienne la Version retenue. ${artifact.chosenNumber === null ? '' : `La v${String(artifact.chosenNumber)} reste retenue d’ici là.`}`
              : `Claude lit ${checkedPhrase(panel.checkedInputs.length)} et écrit ${explanation.theLabel}. Tu peux fermer : la génération continue et une notification s’affichera.`}
          </p>
        </div>
      </div>
      <Progress value={run.progress * 100} />
      {isDone ? (
        <p className="text-xs text-muted-foreground">
          Produite à partir de : {summarizeInputs(panel.checkedInputs).join(', ')}.
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">Prototype : la génération est simulée en quelques secondes.</p>
      <div className="flex justify-end">
        <Button variant={isDone ? 'default' : 'outline'} onClick={onClose}>
          {isDone ? 'Voir le Brouillon' : 'Fermer, continuer en fond'}
        </Button>
      </div>
    </div>
  );
}

// « + Ajouter un texte ou un fichier »: a Custom Artifact for this Posting, or an Annex in the Profile
export function AddInputDialog({
  panel,
  open,
  onOpenChange,
}: {
  panel: GenerationPanelState;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [scope, setScope] = useState<'posting' | 'profile'>('posting');
  const [isPending, setIsPending] = useState(false);

  function reset() {
    setTitle('');
    setText('');
    setFileName(null);
    setScope('posting');
  }

  async function readFile(file: File) {
    setFileName(file.name);
    if (title.trim() === '') {
      setTitle(file.name.replace(/\.[^.]+$/u, ''));
    }
    // A PDF is converted to Markdown by the real app; the prototype only pretends
    setText(
      file.type === 'application/pdf'
        ? `# ${file.name}\n\n(Conversion du PDF simulée par le prototype.)`
        : await file.text(),
    );
  }

  async function submit() {
    setIsPending(true);
    await panel.addInput({ title: title.trim(), text, scope });
    setIsPending(false);
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" onInteractOutside={keepSwitcherClicks}>
        <DialogHeader>
          <DialogTitle>Ajouter un texte ou un fichier</DialogTitle>
          <DialogDescription>Claude le lira avec le reste. Il sera coché pour cette génération.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="add-input-title">Titre</Label>
            <Input
              id="add-input-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex. : Échange avec la greffière en chef"
            />
          </div>
          <Tabs defaultValue="text">
            <TabsList>
              <TabsTrigger value="text">Écrire un texte</TabsTrigger>
              <TabsTrigger value="file">Déposer un fichier</TabsTrigger>
            </TabsList>
            <TabsContent value="text">
              <Textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={6}
                className="field-sizing-fixed"
                placeholder="Ce que Claude doit savoir, en Markdown ou en texte simple."
              />
            </TabsContent>
            <TabsContent value="file">
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground hover:bg-muted/50">
                <FileUpIcon className="size-5" />
                {fileName ?? 'Choisir un .md, un .txt ou un PDF (converti en texte)'}
                <input
                  type="file"
                  accept=".md,.txt,.pdf,text/markdown,text/plain,application/pdf"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file !== undefined) {
                      void readFile(file);
                    }
                  }}
                />
              </label>
            </TabsContent>
          </Tabs>
          <fieldset className="space-y-2">
            <legend className="mb-1.5 text-sm font-medium">Où le garder</legend>
            <ScopeOption
              isSelected={scope === 'posting'}
              onSelect={() => setScope('posting')}
              title="Pour cette Offre"
              description="Un document de l’Offre, lu par ses prochaines générations."
            />
            <ScopeOption
              isSelected={scope === 'profile'}
              onSelect={() => setScope('profile')}
              isDisabled={!panel.canAddAnnex}
              title="Dans mon Profil"
              description={
                panel.canAddAnnex
                  ? 'Une Annexe, réutilisable pour tes autres Offres.'
                  : `${panel.explanation.theLabel.replace(/^./u, (first) => first.toUpperCase())} ne lit pas le Profil : garde-le pour cette Offre.`
              }
            />
          </fieldset>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button disabled={isPending || title.trim() === '' || text.trim() === ''} onClick={() => void submit()}>
            Ajouter et cocher
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScopeOption({
  isSelected,
  isDisabled = false,
  onSelect,
  title,
  description,
}: {
  isSelected: boolean;
  isDisabled?: boolean;
  onSelect: () => void;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      disabled={isDisabled}
      onClick={onSelect}
      className={cn(
        'flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60',
        isSelected && 'border-primary bg-primary/5 ring-1 ring-primary/30',
      )}
    >
      <span
        className={cn(
          'mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border',
          isSelected && 'border-primary',
        )}
      >
        {isSelected ? <span className="size-2 rounded-full bg-primary" /> : null}
      </span>
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}

// The dashed button that opens AddInputDialog
export function AddInputButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      className={cn('w-full border-dashed text-muted-foreground', className)}
      onClick={onClick}
    >
      + Ajouter un texte ou un fichier
    </Button>
  );
}

// A small heading of a section
export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{children}</h3>
      {aside === undefined ? null : <span className="text-xs text-muted-foreground">{aside}</span>}
    </div>
  );
}

// Many alike Inputs under one line: a tri-state checkbox, a count, unfolded on demand
export function InputBundle({
  panel,
  title,
  hint,
  inputs,
  defaultOpen = false,
  className,
  children,
}: {
  panel: GenerationPanelState;
  title: string;
  hint?: string;
  inputs: IPanelInput[];
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const checkedList = inputs.filter(({ isChecked }) => isChecked);
  const words = checkedList.reduce((total, { wordCount }) => total + wordCount, 0);
  const state = checkedList.length === 0 ? false : checkedList.length === inputs.length ? true : 'indeterminate';
  const keys = inputs.map(({ key }) => key);
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <div className="flex items-center gap-3 px-3 py-2">
        <Checkbox
          checked={state}
          onCheckedChange={() => panel.setManyChecked(keys, state !== true)}
          aria-label={`Tout cocher : ${title}`}
        />
        <CollapsibleTrigger className="group flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm">
              {title} <span className="text-muted-foreground">· {inputs.length}</span>
            </span>
            <span className="block text-xs text-muted-foreground">
              {checkedList.length === inputs.length
                ? `Toutes lues · ${formatWords(words)}`
                : checkedList.length === 0
                  ? 'Aucune lue'
                  : `${String(checkedList.length)} sur ${String(inputs.length)} lues · ${formatWords(words)}`}
            </span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium">
            {isOpen ? 'Replier' : 'Détailler'}
            <ChevronRightIcon className="size-3.5 transition-transform group-data-[state=open]:rotate-90" />
          </span>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        {hint === undefined ? null : <p className="px-3 pb-2 pl-10 text-xs text-muted-foreground">{hint}</p>}
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
