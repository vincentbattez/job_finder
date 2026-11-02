// PROTOTYPE · generation panel, variant C « Étapes »: a short stepper, one question per screen:
// 1. what Claude reads (two columns, Offre | Profil, Annexes as chips), 2. how it writes (the
// Instructions, the Fixed Part folded), 3. a recap in one plain-French paragraph and [Lancer]. Bet: the
// Candidate decides one thing at a time and ends on a sentence that says exactly what will happen.
import { CheckIcon, ClipboardCopyIcon, EyeIcon, PlusIcon, SparklesIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';

import { Button } from '#/web/prototype/components/ui/button.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/web/prototype/components/ui/dialog.tsx';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '#/web/prototype/components/ui/sheet.tsx';
import { cn } from '#/web/prototype/lib/utils.ts';

import {
  AddInputButton,
  AddInputDialog,
  Blockers,
  FixedPartFold,
  focusSelf,
  InputBundle,
  InputCheckbox,
  InputContent,
  InputMeta,
  InstructionsEditor,
  keepSwitcherClicks,
  KIND_ICON,
  PrefillNote,
  RunProgress,
} from './parts.tsx';
import {
  formatDocuments,
  formatWords,
  GROUP_LABEL,
  itemsOf,
  summarizeInputs,
  type GenerationPanelState,
  type IPanelInput,
} from './use-generation-panel.ts';

const STEP_LIST = ['Ce que Claude lit', 'Comment il écrit', 'Récapitulatif'] as const;

// « a, b et c »
function joinFrench(list: string[]): string {
  if (list.length <= 1) {
    return list.join('');
  }
  return `${list.slice(0, -1).join(', ')} et ${list.at(-1) ?? ''}`;
}

export function PanelStepper({
  panel,
  onClose,
  subtitle,
}: {
  panel: GenerationPanelState;
  onClose: () => void;
  subtitle: string;
}) {
  const [step, setStep] = useState(0);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const preview = panel.inputs.find(({ key }) => key === previewKey);
  const isLast = step === STEP_LIST.length - 1;

  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
    >
      <DialogContent
        className="flex h-[min(760px,calc(100svh-9rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
        onInteractOutside={keepSwitcherClicks}
        onOpenAutoFocus={focusSelf}
      >
        <DialogHeader className="space-y-3 border-b px-6 pt-5 pb-4">
          <div className="space-y-1">
            <DialogTitle className="text-lg">{panel.explanation.title}</DialogTitle>
            <DialogDescription>{subtitle}</DialogDescription>
          </div>
          {panel.run === undefined ? (
            <ol className="flex items-center gap-2" aria-label="Étapes">
              {STEP_LIST.map((label, index) => (
                <li
                  key={label}
                  className={cn('flex min-w-0 flex-1 items-center gap-2', index === step && 'max-sm:flex-[4]')}
                >
                  <button
                    type="button"
                    onClick={() => setStep(index)}
                    aria-current={index === step ? 'step' : undefined}
                    data-step={index}
                    className="flex min-w-0 items-center gap-2 rounded-md text-left text-sm"
                  >
                    <span
                      className={cn(
                        'grid size-6 shrink-0 place-items-center rounded-full border text-xs font-medium',
                        index === step && 'border-primary bg-primary text-primary-foreground',
                        index < step && 'border-primary text-primary',
                      )}
                    >
                      {index < step ? <CheckIcon className="size-3.5" /> : index + 1}
                    </span>
                    <span
                      className={cn(
                        'truncate',
                        index === step ? 'font-medium' : 'text-muted-foreground',
                        index !== step && 'max-sm:hidden',
                      )}
                    >
                      {label}
                    </span>
                  </button>
                  {index < STEP_LIST.length - 1 ? <span className="h-px min-w-4 flex-1 bg-border" /> : null}
                </li>
              ))}
            </ol>
          ) : null}
        </DialogHeader>

        {panel.run === undefined ? (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {step === 0 ? <ReadStep panel={panel} onPreview={setPreviewKey} onAdd={() => setIsAdding(true)} /> : null}
              {step === 1 ? (
                <div className="space-y-4">
                  <StepIntro>
                    Claude suit d’abord la Partie fixe de {panel.explanation.theLabel}, puis ces Consignes. Modifie-les
                    ici si tu veux un autre ton, une autre longueur, un autre angle.
                  </StepIntro>
                  <InstructionsEditor panel={panel} rows={14} />
                  <FixedPartFold panel={panel} />
                </div>
              ) : null}
              {isLast ? <RecapStep panel={panel} /> : null}
            </div>
            <footer className="flex items-center gap-2 border-t bg-muted/30 px-6 py-3">
              <p className="mr-auto text-xs text-muted-foreground max-sm:hidden">
                {formatDocuments(panel.checkedInputs.length)} · {formatWords(panel.checkedWords)} ·{' '}
                {panel.explanation.duration}
              </p>
              {step === 0 ? (
                <Button variant="outline" onClick={onClose}>
                  Annuler
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setStep(step - 1)}>
                  Retour
                </Button>
              )}
              {isLast ? (
                <Button disabled={!panel.canLaunch} onClick={() => void panel.launch()}>
                  <SparklesIcon data-icon="inline-start" />
                  {panel.isLaunching ? 'Lancement…' : 'Lancer'}
                </Button>
              ) : (
                <Button onClick={() => setStep(step + 1)}>Continuer</Button>
              )}
            </footer>
          </>
        ) : (
          <div className="px-6 py-6">
            <RunProgress panel={panel} onClose={onClose} />
          </div>
        )}
        <AddInputDialog panel={panel} open={isAdding} onOpenChange={setIsAdding} />
        <Sheet
          open={preview !== undefined}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setPreviewKey(null);
            }
          }}
        >
          <SheetContent
            side="right"
            className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
            onInteractOutside={keepSwitcherClicks}
          >
            <SheetHeader className="border-b pr-12">
              <SheetTitle>{preview?.label}</SheetTitle>
              <SheetDescription>
                Texte exact lu par Claude
                {preview === undefined ? null : (
                  <>
                    {' · '}
                    <InputMeta input={preview} />
                  </>
                )}
              </SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {preview === undefined ? null : <InputContent input={preview} />}
            </div>
          </SheetContent>
        </Sheet>
      </DialogContent>
    </Dialog>
  );
}

function StepIntro({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function ReadStep({
  panel,
  onPreview,
  onAdd,
}: {
  panel: GenerationPanelState;
  onPreview: (key: string) => void;
  onAdd: () => void;
}) {
  const annexList = panel.inputs.filter(({ group }) => group === 'annex');
  return (
    <div className="space-y-5">
      <StepIntro>
        Claude lit ces documents mot pour mot, rien d’autre. Les cadenas sont toujours lus ; décoche ce qui ne sert pas
        cette fois.
      </StepIntro>
      <PrefillNote panel={panel} />
      <Blockers panel={panel} />
      <div className="grid gap-5 md:grid-cols-2">
        {(['posting', 'profile'] as const).map((group) => {
          const inputList = panel.inputs.filter((input) => input.group === group);
          return inputList.length === 0 ? null : (
            <section key={group} className="min-w-0 space-y-2">
              <h3 className="text-sm font-medium">{GROUP_LABEL[group]}</h3>
              <ul className="space-y-1.5">
                {itemsOf(inputList).map((item) =>
                  item.kind === 'input' ? (
                    <InputCard
                      key={item.input.key}
                      panel={panel}
                      input={item.input}
                      onPreview={() => onPreview(item.input.key)}
                    />
                  ) : (
                    <li key={item.key} className="rounded-lg border bg-card">
                      <InputBundle panel={panel} title={item.title} hint={item.hint} inputs={item.inputs}>
                        <ul className="space-y-1.5 border-t p-2">
                          {item.inputs.map((input) => (
                            <InputCard
                              key={input.key}
                              panel={panel}
                              input={input}
                              onPreview={() => onPreview(input.key)}
                            />
                          ))}
                        </ul>
                      </InputBundle>
                    </li>
                  ),
                )}
              </ul>
            </section>
          );
        })}
      </div>
      {annexList.length === 0 ? null : (
        <section className="space-y-2">
          <h3 className="text-sm font-medium">
            {GROUP_LABEL.annex}
            <span className="ml-2 text-xs font-normal text-muted-foreground">Clique pour en ajouter une.</span>
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {annexList.map((input) => (
              <span key={input.key} className="inline-flex">
                <button
                  type="button"
                  aria-pressed={input.isChecked}
                  onClick={() => panel.setChecked(input.key, !input.isChecked)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-l-full border py-1 pr-2 pl-2.5 text-xs transition-colors hover:bg-muted',
                    input.isChecked && 'border-primary/40 bg-primary/10 text-foreground hover:bg-primary/15',
                  )}
                >
                  {input.isChecked ? <CheckIcon className="size-3" /> : <PlusIcon className="size-3" />}
                  {input.label.replace(/^Annexe · /u, '')}
                </button>
                <button
                  type="button"
                  onClick={() => onPreview(input.key)}
                  aria-label={`Aperçu : ${input.label}`}
                  className={cn(
                    'rounded-r-full border border-l-0 px-2 text-muted-foreground hover:bg-muted hover:text-foreground',
                    input.isChecked && 'border-primary/40',
                  )}
                >
                  <EyeIcon className="size-3" />
                </button>
              </span>
            ))}
          </div>
        </section>
      )}
      <AddInputButton onClick={onAdd} className="sm:w-auto" />
    </div>
  );
}

function InputCard({
  panel,
  input,
  onPreview,
}: {
  panel: GenerationPanelState;
  input: IPanelInput;
  onPreview: () => void;
}) {
  const Icon = KIND_ICON[input.kind];
  return (
    <li
      className={cn(
        'flex items-center gap-3 rounded-lg border bg-card px-3 py-2',
        !input.isChecked && 'border-dashed bg-transparent',
      )}
    >
      <InputCheckbox input={input} panel={panel} />
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <label
        htmlFor={input.mode === 'required' ? undefined : `input-${input.key}`}
        className={cn('min-w-0 flex-1', !input.isChecked && 'text-muted-foreground')}
      >
        <span className="block truncate text-sm">{input.label}</span>
        <span className="block text-xs text-muted-foreground">
          <InputMeta input={input} />
        </span>
      </label>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onPreview}
        aria-label={`Aperçu : ${input.label}`}
        data-preview-toggle={input.key}
      >
        <EyeIcon />
      </Button>
    </li>
  );
}

// The run as one paragraph, then the details it rests on
function RecapStep({ panel }: { panel: GenerationPanelState }) {
  const { explanation, instructions } = panel;
  const readLabels = summarizeInputs(panel.checkedInputs);
  const instructionsLabel = instructions.isCandidate ? 'tes Consignes' : 'les Consignes par défaut';
  return (
    <div className="space-y-5">
      <p className="text-[15px] leading-7">
        Claude va lire <strong className="font-medium">{joinFrench(readLabels)}</strong>, soit{' '}
        {formatWords(panel.checkedWords)}. Puis il {explanation.does.replace(/^./u, (first) => first.toLowerCase())} Il
        suit {instructionsLabel} et la Partie fixe, et écrit{' '}
        <strong className="font-medium">{explanation.writes}</strong>.
      </p>
      <ReadBreakdown panel={panel} />
      <dl className="grid gap-3 rounded-lg bg-muted/50 p-4 text-sm sm:grid-cols-3">
        <RecapItem term="Après">{explanation.keeps}</RecapItem>
        <RecapItem term="Durée">{explanation.duration} environ ; tu peux fermer, la génération continue.</RecapItem>
        <RecapItem term="Web">
          {explanation.usesWeb
            ? 'Oui : chaque fait trouvé est cité avec sa source.'
            : 'Non : seulement les documents ci-dessus.'}
        </RecapItem>
      </dl>
      <CopyPrompt panel={panel} />
      <Blockers panel={panel} />
    </div>
  );
}

const PERCENT_FORMAT = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 0 });

// Each checked Input with its weight in what Claude reads, largest first, then the total
function ReadBreakdown({ panel }: { panel: GenerationPanelState }) {
  const total = panel.checkedWords;
  const sortedList = panel.checkedInputs.toSorted((first, second) => second.wordCount - first.wordCount);
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Ce que Claude lit, par poids
      </h3>
      <ul className="divide-y rounded-lg border">
        {sortedList.map((input) => {
          const share = total === 0 ? 0 : input.wordCount / total;
          const Icon = KIND_ICON[input.kind];
          return (
            <li key={input.key} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 px-3 py-2">
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{input.label}</span>
              </span>
              <span className="text-right text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                {formatWords(input.wordCount)} ·{' '}
                <span className="inline-block w-10 font-medium whitespace-nowrap text-foreground">
                  {PERCENT_FORMAT.format(share)}
                </span>
              </span>
              <div className="col-span-2 h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div className="h-full rounded-full bg-primary/70" style={{ width: `${String(share * 100)}%` }} />
              </div>
            </li>
          );
        })}
        <li className="flex items-center justify-between gap-4 bg-muted/40 px-3 py-2 text-sm font-medium">
          <span>Total · {formatDocuments(panel.checkedInputs.length)}</span>
          <span className="text-xs whitespace-nowrap tabular-nums">
            {formatWords(total)} · <span className="inline-block w-10 whitespace-nowrap">100 %</span>
          </span>
        </li>
      </ul>
    </section>
  );
}

// « Copier le Prompt »: the whole Markdown the AI receives, without the highlight
function CopyPrompt({ panel }: { panel: GenerationPanelState }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(panel.promptMarkdown);
      toast.success('Prompt copié', {
        description: `Partie fixe, ${formatDocuments(panel.checkedInputs.length)} et Consignes, en Markdown.`,
      });
    } catch {
      toast.error('Copie impossible', { description: 'Le navigateur a refusé l’accès au presse-papiers.' });
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed px-3 py-2.5">
      <p className="min-w-0 flex-1 text-xs text-muted-foreground">
        Tout ce que Claude recevra, mot pour mot : la Partie fixe, les documents cochés puis les Consignes.
      </p>
      <Button variant="outline" size="sm" onClick={() => void copy()}>
        <ClipboardCopyIcon data-icon="inline-start" />
        Copier le Prompt
      </Button>
    </div>
  );
}

function RecapItem({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{term}</dt>
      <dd className="text-muted-foreground">{children}</dd>
    </div>
  );
}
