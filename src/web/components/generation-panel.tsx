import { cn } from 'cn';
import { CheckCircle2Icon, CheckIcon, LoaderIcon, PlusIcon, SparklesIcon, TriangleAlertIcon } from 'lucide-react';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type { Artifact } from '#/actions/index.ts';
import { Alert, AlertDescription } from '#/web/components/ui/alert.tsx';
import { Button } from '#/web/components/ui/button.tsx';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '#/web/components/ui/dialog.tsx';

import type { Generation } from './artifact.ts';
import { ReadStep, type IPanelInput } from './generation-read-step.tsx';
import { RecapStep } from './generation-recap-step.tsx';
import { WriteStep } from './generation-write-step.tsx';
import { inputLabelOf } from './input-label.ts';

const STEP_LIST = ['read', 'write', 'recap'] as const;

// What the run does once launched, as the panel follows it: its job's state, then the Version it wrote
export interface IRunView {
  state: 'queued' | 'in_progress' | 'ready' | 'failed';
  number: number;
  failure: string | null;
}

// The run once launched: its state, then the Draft it wrote
function RunProgress({
  artifact,
  run,
  onClose,
  onViewDraft,
}: Readonly<{ artifact: Artifact; run: IRunView; onClose: () => void; onViewDraft: () => void }>) {
  const { t } = useTranslation('posting');
  const artifactLabel = t(`artifactLabelByArtifact.${artifact}`, { ns: 'common' });
  let heading = t('generation.running', { context: artifact, artifactLabel });
  let note: string | null = t('generation.runningNote');
  switch (run.state) {
    case 'queued': {
      heading = t('generation.queued');
      break;
    }
    case 'ready': {
      heading = t('generation.ready', { number: run.number });
      note = t('generation.readyNote');
      break;
    }
    case 'failed': {
      heading = t('generation.failed');
      note = run.failure;
      break;
    }
    case 'in_progress': {
      break;
    }
  }
  return (
    <div className="space-y-4" data-run={run.state}>
      <div role="status" className="flex items-start gap-3">
        {run.state === 'ready' && (
          <CheckCircle2Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-validated-foreground" />
        )}
        {run.state === 'failed' && (
          <TriangleAlertIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-destructive" />
        )}
        {(run.state === 'queued' || run.state === 'in_progress') && (
          <LoaderIcon aria-hidden className="mt-0.5 size-5 shrink-0 animate-spin text-draft" />
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium">{heading}</p>
          {note !== null && <p className="text-sm whitespace-pre-wrap text-muted-foreground">{note}</p>}
        </div>
      </div>
      <div className="flex justify-end">
        {run.state === 'ready' ? (
          <Button onClick={onViewDraft}>{t('generation.viewDraft')}</Button>
        ) : (
          <Button variant="outline" onClick={onClose}>
            {run.state === 'failed' ? t('generation.close') : t('generation.closeRunning')}
          </Button>
        )}
      </div>
    </div>
  );
}

function Stepper({ step, onStep }: Readonly<{ step: number; onStep: (step: number) => void }>) {
  const { t } = useTranslation('posting');
  return (
    <ol aria-label={t('generation.steps')} className="flex items-center gap-2">
      {STEP_LIST.map((name, index) => (
        <li key={name} className={cn('flex min-w-0 flex-1 items-center gap-2', index === step && 'max-sm:flex-4')}>
          <button
            type="button"
            aria-current={index === step ? 'step' : undefined}
            onClick={() => {
              onStep(index);
            }}
            className="flex min-w-0 items-center gap-2 rounded-md text-left text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span
              className={cn(
                'grid size-6 shrink-0 place-items-center rounded-full border text-xs font-medium tabular-nums',
                index === step && 'border-primary bg-primary text-primary-foreground',
                index < step && 'border-primary text-primary',
              )}
            >
              {index < step ? <CheckIcon aria-hidden className="size-3.5" /> : index + 1}
            </span>
            <span className={cn('truncate', index === step ? 'font-medium' : 'text-muted-foreground max-sm:sr-only')}>
              {t(`generation.stepLabelByStep.${name}`)}
            </span>
          </button>
          {index < STEP_LIST.length - 1 && <span aria-hidden className="h-px min-w-4 flex-1 bg-border" />}
        </li>
      ))}
    </ol>
  );
}

interface IGenerationPanelProperties {
  reference: string;
  artifact: Artifact;
  // The Posting's title, and the Interview of an Artifact attached to one
  subtitle: string;
  isRegeneration: boolean;
  // null while the panel reads the Inputs
  generation: Generation | null;
  // The Instructions editor its Container hands in, and whether it holds an unsaved edit, which blocks Launch
  instructions: ReactNode;
  isInstructionsDirty: boolean;
  // The keys the Candidate checked or unchecked since the panel opened, over the initial checks
  checkOverride: Readonly<Record<string, boolean>>;
  step: number;
  // The Prompt of the read Inputs, for Copy the Prompt; null while it loads
  prompt: string | null;
  isLaunching: boolean;
  run: IRunView | null;
  // Add a text or a file, at the foot of what Claude reads
  addInput?: ReactNode;
  onCheck: (keyList: string[], isChecked: boolean) => void;
  onStep: (step: number, readKeyList: string[]) => void;
  onCopy: (prompt: string) => void;
  onLaunch: (readKeyList: string[]) => void;
  onClose: () => void;
  onViewDraft: () => void;
}

// The generation panel (spec #125, DESIGN.md « Generation panel, three steps »): Generate never runs,
// it opens this Dialog, which shows what Claude reads, how it writes, then the recap and Launch; once
// launched, it follows the run
export function GenerationPanel({
  reference,
  artifact,
  subtitle,
  isRegeneration,
  generation,
  instructions,
  isInstructionsDirty,
  checkOverride,
  step,
  prompt,
  isLaunching,
  run,
  addInput,
  onCheck,
  onStep,
  onCopy,
  onLaunch,
  onClose,
  onViewDraft,
}: Readonly<IGenerationPanelProperties>) {
  const { t } = useTranslation('posting');
  const artifactLabel = t(`artifactLabelByArtifact.${artifact}`, { ns: 'common' });
  const inputList: IPanelInput[] = (generation?.inputList ?? []).map((input) => ({
    ...input,
    label: inputLabelOf(t, reference, input),
    isRead: input.mode === 'required' || (checkOverride[input.key] ?? input.isChecked),
  }));
  const readList = inputList.filter(({ isRead }) => isRead);
  const readKeyList = readList.map(({ key }) => key);
  const totalWords = readList.reduce((total, { wordCount }) => total + wordCount, 0);
  const blockerList = [
    ...(generation?.refusal == null ? [] : [generation.refusal]),
    ...(isInstructionsDirty ? [t('instructions.unsavedBlocker', { ns: 'settings' })] : []),
  ];
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
        onOpenAutoFocus={(event) => {
          // The first focusable is a lock, whose tooltip would pop open
          event.preventDefault();
          if (event.currentTarget instanceof HTMLElement) {
            event.currentTarget.focus();
          }
        }}
      >
        <DialogHeader className="gap-3 border-b px-6 pt-5 pb-4">
          <div className="space-y-1 pr-8">
            <DialogTitle className="text-lg">
              {t(isRegeneration ? 'generation.titleAgain' : 'generation.title', { context: artifact, artifactLabel })}
            </DialogTitle>
            <DialogDescription>{subtitle}</DialogDescription>
          </div>
          {run === null && (
            <Stepper
              step={step}
              onStep={(next) => {
                onStep(next, readKeyList);
              }}
            />
          )}
        </DialogHeader>
        {run !== null && (
          <div className="px-6 py-6">
            <RunProgress artifact={artifact} run={run} onClose={onClose} onViewDraft={onViewDraft} />
          </div>
        )}
        {run === null && generation === null && (
          <p role="status" className="flex items-center gap-2 px-6 py-6 text-sm text-muted-foreground">
            <LoaderIcon aria-hidden className="size-4 animate-spin" />
            {t('generation.loading')}
          </p>
        )}
        {run === null && generation !== null && (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {step === 0 && (
                <ReadStep inputList={inputList} blockerList={blockerList} addInput={addInput} onCheck={onCheck} />
              )}
              {step === 1 && <WriteStep artifact={artifact} prompt={generation.prompt} instructions={instructions} />}
              {isLast && (
                <RecapStep
                  generation={generation}
                  readList={readList}
                  totalWords={totalWords}
                  blockerList={blockerList}
                  prompt={prompt}
                  onCopy={onCopy}
                />
              )}
            </div>
            <footer className="flex items-center gap-2 border-t bg-muted/30 px-6 py-3">
              <p className="mr-auto text-xs text-muted-foreground tabular-nums max-sm:hidden">
                {t('generation.documents', { count: readList.length })} · {t('generation.words', { count: totalWords })}{' '}
                · {t(`generation.durationByArtifact.${artifact}`)}
              </p>
              {step === 0 ? (
                <Button variant="outline" onClick={onClose}>
                  {t('generation.cancel')}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => {
                    onStep(step - 1, readKeyList);
                  }}
                >
                  {t('generation.back')}
                </Button>
              )}
              {isLast ? (
                <Button
                  disabled={blockerList.length > 0}
                  isPending={isLaunching}
                  onClick={() => {
                    onLaunch(readKeyList);
                  }}
                >
                  <SparklesIcon data-icon="inline-start" />
                  {t('generation.launch')}
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    onStep(step + 1, readKeyList);
                  }}
                >
                  {t('generation.next')}
                </Button>
              )}
            </footer>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Generate or Regenerate, which opens the panel, with beside it why a run is refused now (spec #125)
// The dashed button at the foot of the Inputs that opens Add a text or a file
export function AddInputButton({ onClick }: Readonly<{ onClick: () => void }>) {
  const { t } = useTranslation('posting');
  return (
    <Button variant="outline" size="sm" className="w-full border-dashed text-muted-foreground" onClick={onClick}>
      <PlusIcon aria-hidden />
      {t('documents.addFromPanel')}
    </Button>
  );
}

export function GenerateButton({
  isRegeneration,
  refusal,
  onOpen,
}: Readonly<{ isRegeneration: boolean; refusal: string | null; onOpen: () => void }>) {
  const { t } = useTranslation('posting');
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
      {refusal !== null && <p className="max-w-sm text-xs text-muted-foreground">{refusal}</p>}
      <Button variant="outline" size="sm" onClick={onOpen}>
        <SparklesIcon data-icon="inline-start" />
        {isRegeneration ? t('generation.regenerate') : t('generation.generate')}
      </Button>
    </div>
  );
}

// Why the last run failed, or why the worker does not move it, or why its notification was not sent: the
// Candidate was not warned (CODING_STANDARDS « Visible failure »)
export function RunFailure({ message }: Readonly<{ message: string | null }>) {
  if (message === null) {
    return null;
  }
  return (
    <Alert variant="destructive">
      <TriangleAlertIcon aria-hidden />
      <AlertDescription className="whitespace-pre-wrap">{message}</AlertDescription>
    </Alert>
  );
}
