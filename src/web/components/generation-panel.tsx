import { cn } from 'cn';
import type { TFunction } from 'i18next';
import {
  BriefcaseIcon,
  CheckCircle2Icon,
  CheckIcon,
  ChevronRightIcon,
  ClipboardCopyIcon,
  EyeIcon,
  FileCheck2Icon,
  LoaderIcon,
  LockIcon,
  PlusIcon,
  SendIcon,
  SparklesIcon,
  StickyNoteIcon,
  TriangleAlertIcon,
  UserRoundIcon,
  type LucideIcon,
} from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type { Artifact } from '#/actions/index.ts';
import { segmentsOf } from '#/actions/substitution.ts';
import { Alert, AlertDescription, AlertTitle } from '#/web/components/ui/alert.tsx';
import { Button } from '#/web/components/ui/button.tsx';
import { Checkbox } from '#/web/components/ui/checkbox.tsx';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '#/web/components/ui/collapsible.tsx';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '#/web/components/ui/dialog.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '#/web/components/ui/tooltip.tsx';

import type { Generation, GenerationInput } from './artifact.ts';

type InputGroup = 'posting' | 'profile' | 'annex';

const STEP_LIST = ['read', 'write', 'recap'] as const;

// From three Past Letters on, they fold into one bundle: a long history stays manageable (spec #125)
const BUNDLE_MIN_COUNT = 3;

const ICON_BY_KIND: Record<GenerationInput['kind'], LucideIcon> = {
  job_description: BriefcaseIcon,
  artifact: FileCheck2Icon,
  notes: StickyNoteIcon,
  profile_document: UserRoundIcon,
  past_letter: SendIcon,
};

// What the run does once launched, as the panel follows it: its job's state, then the Version it wrote
export interface IRunView {
  state: 'queued' | 'in_progress' | 'ready' | 'failed';
  number: number;
  failure: string | null;
}

// The Posting's Inputs, the Profile's core and Past Letters, and the Annexes to add
function groupOf({ kind, mode }: GenerationInput): InputGroup {
  if (kind === 'profile_document' && mode === 'optional') {
    return 'annex';
  }
  return kind === 'profile_document' || kind === 'past_letter' ? 'profile' : 'posting';
}

// An Artifact read, of this Posting, of one of its Interviews or of the Posting a Repost publishes again
function artifactLabelOf(
  t: TFunction<'posting'>,
  reference: string,
  { readVersion, artifact }: GenerationInput,
): string {
  const artifactLabel = artifact === null ? '' : t(`artifactLabelByArtifact.${artifact}`, { ns: 'common' });
  if (readVersion === null) {
    return t('generation.inputLabel.artifactMissing', { artifactLabel });
  }
  const { number, interviewNumber } = readVersion;
  if (readVersion.reference !== reference) {
    return t('generation.inputLabel.artifactOfPosting', { artifactLabel, number, reference: readVersion.reference });
  }
  return interviewNumber === null
    ? t('generation.inputLabel.artifact', { artifactLabel, number })
    : t('generation.inputLabel.artifactOfInterview', { artifactLabel, number, interviewNumber });
}

// An Input as the Candidate names it, the Profile's documents told apart by their name
function labelOf(t: TFunction<'posting'>, reference: string, input: GenerationInput): string {
  const { kind, fileName, readVersion } = input;
  switch (kind) {
    case 'job_description': {
      return t('generation.inputLabel.jobDescription');
    }
    case 'notes': {
      return t('generation.inputLabel.notes');
    }
    case 'profile_document': {
      if (fileName === 'cv.md' || fileName === 'facts.md') {
        return t(fileName === 'cv.md' ? 'generation.inputLabel.cv' : 'generation.inputLabel.facts');
      }
      return t('generation.inputLabel.annex', { name: fileName });
    }
    case 'past_letter': {
      return fileName === null
        ? t('generation.inputLabel.sentLetter', { title: readVersion?.title })
        : t('generation.inputLabel.pastLetter', { name: fileName });
    }
    case 'artifact': {
      return artifactLabelOf(t, reference, input);
    }
  }
}

// The icon of an Input's kind
function KindIcon({ kind, className }: Readonly<{ kind: GenerationInput['kind']; className: string }>) {
  const ICON = ICON_BY_KIND[kind];
  return <ICON aria-hidden className={className} />;
}

// What the panel needs of each Input: its label, and whether it is read
interface IPanelInput extends GenerationInput {
  label: string;
  isRead: boolean;
}

interface IChecks {
  onCheck: (keyList: string[], isChecked: boolean) => void;
}

// The lock of a required Input, its tooltip saying why; a checkbox for the others
function InputCheck({ input, onCheck }: Readonly<{ input: IPanelInput } & IChecks>) {
  const { t } = useTranslation('posting');
  if (input.mode === 'required') {
    const reason = input.reason === null ? '' : t(`generation.reasonByReason.${input.reason}`);
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="img"
            tabIndex={0}
            aria-label={t('generation.lockedLabel', { reason })}
            className="inline-flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <LockIcon aria-hidden className="size-3.5" />
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-64">
          <p className="font-medium">{t('generation.alwaysRead')}</p>
          <p className="opacity-80">{reason}</p>
        </TooltipContent>
      </Tooltip>
    );
  }
  return (
    <Checkbox
      checked={input.isRead}
      aria-label={input.label}
      onCheckedChange={(checked) => {
        onCheck([input.key], checked === true);
      }}
    />
  );
}

function InputMeta({ input }: Readonly<{ input: IPanelInput }>) {
  const { t } = useTranslation('posting');
  if (input.mode === 'required' && !input.isAvailable) {
    return <span className="text-destructive">{t('generation.noValidatedVersion')}</span>;
  }
  return (
    <span className="tabular-nums">
      {t('generation.words', { count: input.wordCount })}
      {input.mode === 'required' && ` · ${t('generation.required')}`}
    </span>
  );
}

// The exact text Claude reads, untouched
function InputContent({ content }: Readonly<{ content: string }>) {
  const { t } = useTranslation('posting');
  if (content.trim() === '') {
    return <p className="text-sm text-muted-foreground italic">{t('generation.emptyContent')}</p>;
  }
  return (
    <pre className="max-h-72 overflow-y-auto font-sans text-[13px] leading-relaxed wrap-anywhere whitespace-pre-wrap text-foreground/90">
      {content}
    </pre>
  );
}

// One Input: its check, its label and size, and an eye that unfolds its exact content
function InputRow({ input, onCheck }: Readonly<{ input: IPanelInput } & IChecks>) {
  const { t } = useTranslation('posting');
  return (
    <li data-input={input.key}>
      <Collapsible className={cn('rounded-lg border bg-card', !input.isRead && 'border-dashed bg-transparent')}>
        <div className="flex items-center gap-3 px-3 py-2">
          <InputCheck input={input} onCheck={onCheck} />
          <KindIcon kind={input.kind} className="size-4 shrink-0 text-muted-foreground" />
          <span className={cn('min-w-0 flex-1', !input.isRead && 'text-muted-foreground')}>
            <span className="block truncate text-sm">{input.label}</span>
            <span className="block text-xs text-muted-foreground">
              <InputMeta input={input} />
            </span>
          </span>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t('generation.preview', { label: input.label })}>
              <EyeIcon />
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="border-t px-3 py-3">
          <InputContent content={input.content} />
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}

// The Past Letters under one line: a checkbox for all of them, a count, unfolded on demand
function PastLetterBundle({ inputList, onCheck }: Readonly<{ inputList: IPanelInput[] } & IChecks>) {
  const { t } = useTranslation('posting');
  const [isOpen, setIsOpen] = useState(false);
  const label = t('generation.pastLetterBundle');
  const readList = inputList.filter(({ isRead }) => isRead);
  const words = t('generation.words', { count: readList.reduce((total, { wordCount }) => total + wordCount, 0) });
  const checkState = readList.length === 0 ? false : readList.length === inputList.length || 'indeterminate';
  let state = t('generation.bundleSomeRead', { checked: readList.length, count: inputList.length, words });
  if (readList.length === 0) {
    state = t('generation.bundleNoneRead');
  } else if (readList.length === inputList.length) {
    state = t('generation.bundleAllRead', { words });
  }
  return (
    <li className="rounded-lg border bg-card">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center gap-3 px-3 py-2">
          <Checkbox
            checked={checkState}
            aria-label={t('generation.checkAll', { label })}
            onCheckedChange={() => {
              onCheck(
                inputList.map(({ key }) => key),
                checkState !== true,
              );
            }}
          />
          <CollapsibleTrigger className="group flex min-w-0 flex-1 items-center gap-2 rounded-sm text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">
                {label} <span className="text-muted-foreground tabular-nums">· {inputList.length}</span>
              </span>
              <span className="block text-xs text-muted-foreground tabular-nums">{state}</span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium">
              {isOpen ? t('generation.fold') : t('generation.unfold')}
              <ChevronRightIcon
                aria-hidden
                className="size-3.5 transition-transform group-data-[state=open]:rotate-90"
              />
            </span>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <p className="px-3 pb-2 text-xs text-muted-foreground">{t('generation.pastLetterHint')}</p>
          <ul className="space-y-1.5 border-t p-2">
            {inputList.map((input) => (
              <InputRow key={input.key} input={input} onCheck={onCheck} />
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}

// An Annex, unchecked by default, added with a click; its exact content in a popover-free fold
function AnnexChip({ input, onCheck }: Readonly<{ input: IPanelInput } & IChecks>) {
  const { t } = useTranslation('posting');
  const [isOpen, setIsOpen] = useState(false);
  return (
    <li className={cn(isOpen && 'basis-full')}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <span className="inline-flex">
          <button
            type="button"
            aria-pressed={input.isRead}
            onClick={() => {
              onCheck([input.key], !input.isRead);
            }}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-l-full border py-1 pr-2 pl-2.5 text-xs transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50',
              input.isRead && 'border-primary/40 bg-primary/10 hover:bg-primary/15',
            )}
          >
            {input.isRead ? <CheckIcon aria-hidden className="size-3" /> : <PlusIcon aria-hidden className="size-3" />}
            {input.label}
            <span className="text-muted-foreground tabular-nums">
              · {t('generation.words', { count: input.wordCount })}
            </span>
          </button>
          <CollapsibleTrigger
            aria-label={t('generation.preview', { label: input.label })}
            className={cn(
              'rounded-r-full border border-l-0 px-2 text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50',
              input.isRead && 'border-primary/40',
            )}
          >
            <EyeIcon aria-hidden className="size-3" />
          </CollapsibleTrigger>
        </span>
        <CollapsibleContent className="mt-2 rounded-lg border px-3 py-3">
          <InputContent content={input.content} />
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}

function InputColumn({
  group,
  inputList,
  onCheck,
}: Readonly<{ group: 'posting' | 'profile'; inputList: IPanelInput[] } & IChecks>) {
  const { t } = useTranslation('posting');
  const headingId = useId();
  const pastLetterList = inputList.filter(({ kind }) => kind === 'past_letter');
  const isBundled = pastLetterList.length >= BUNDLE_MIN_COUNT;
  return (
    <section aria-labelledby={headingId} className="min-w-0 space-y-2">
      <h3 id={headingId} className="max-w-none text-sm font-medium">
        {t(`generation.groupLabelByGroup.${group}`)}
      </h3>
      <ul className="space-y-1.5">
        {inputList
          .filter(({ kind }) => !isBundled || kind !== 'past_letter')
          .map((input) => (
            <InputRow key={input.key} input={input} onCheck={onCheck} />
          ))}
        {isBundled && <PastLetterBundle inputList={pastLetterList} onCheck={onCheck} />}
      </ul>
    </section>
  );
}

// Why Launch waits, when it does
function Blockers({ blockerList }: Readonly<{ blockerList: string[] }>) {
  const { t } = useTranslation('posting');
  if (blockerList.length === 0) {
    return null;
  }
  return (
    <Alert variant="destructive">
      <TriangleAlertIcon aria-hidden />
      <AlertTitle>{t('generation.blockersTitle')}</AlertTitle>
      <AlertDescription>
        <ul className="list-disc pl-4">
          {blockerList.map((blocker) => (
            <li key={blocker}>{blocker}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

// Step 1, what Claude reads: the Posting's column, the Profile's, then the Annexes as chips
function ReadStep({
  inputList,
  blockerList,
  onCheck,
}: Readonly<{ inputList: IPanelInput[]; blockerList: string[] } & IChecks>) {
  const { t } = useTranslation('posting');
  const listOf = (group: InputGroup) => inputList.filter((input) => groupOf(input) === group);
  const annexList = listOf('annex');
  const profileList = listOf('profile');
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">{t('generation.readIntro')}</p>
      <Blockers blockerList={blockerList} />
      <div className={cn('grid gap-5', profileList.length > 0 && 'md:grid-cols-2')}>
        <InputColumn group="posting" inputList={listOf('posting')} onCheck={onCheck} />
        {profileList.length > 0 && <InputColumn group="profile" inputList={profileList} onCheck={onCheck} />}
      </div>
      {annexList.length > 0 && (
        <section className="space-y-2">
          <h3 className="max-w-none text-sm font-medium">
            {t('generation.groupLabelByGroup.annex')}
            <span className="ml-2 text-xs font-normal text-muted-foreground">{t('generation.annexHint')}</span>
          </h3>
          <ul className="flex flex-wrap gap-1.5">
            {annexList.map((input) => (
              <AnnexChip key={input.key} input={input} onCheck={onCheck} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// A value the tool substituted in the Fixed Part: fuchsia, never Invited's violet (DESIGN.md « Substituted values »)
const SUBSTITUTED_CLASS =
  'rounded-[3px] bg-substituted/12 px-0.5 text-substituted-foreground ring-1 ring-substituted/30 ring-inset';

// The Fixed Part's exact text, each value the tool substituted for this Posting or Interview highlighted
function FixedPart({ marked }: Readonly<{ marked: string }>) {
  const { t } = useTranslation('posting');
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className={cn(SUBSTITUTED_CLASS, 'shrink-0')}>{t('generation.substitutedChip')}</span>
        <span>{t('generation.substitutedLegend')}</span>
      </p>
      <pre className="font-sans text-[13px] leading-relaxed wrap-anywhere whitespace-pre-wrap text-muted-foreground">
        {segmentsOf(marked).map(({ text, isSubstituted }, index) =>
          isSubstituted ? (
            // The segments of one text never move: their index keys them
            <mark key={index} className={SUBSTITUTED_CLASS} title={t('generation.substituted')}>
              {text}
            </mark>
          ) : (
            text
          ),
        )}
      </pre>
    </div>
  );
}

// Step 2, how it writes: the Instructions in effect, in the editor its Container hands in, then the Fixed
// Part, folded and read-only
function WriteStep({
  artifact,
  prompt,
  instructions,
}: Readonly<{ artifact: Artifact; prompt: Generation['prompt']; instructions: ReactNode }>) {
  const { t } = useTranslation('posting');
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('generation.writeIntro', {
          context: artifact,
          artifactLabel: t(`artifactLabelByArtifact.${artifact}`, { ns: 'common' }),
        })}
      </p>
      <section className="space-y-2">
        <h3 className="max-w-none text-sm font-medium">{t('generation.instructions')}</h3>
        {instructions ?? (
          <p className="rounded-lg bg-muted/50 px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap">
            {prompt?.instructions}
          </p>
        )}
      </section>
      {prompt !== null && (
        <Collapsible className="rounded-lg border">
          <CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <ChevronRightIcon
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90"
            />
            <span className="font-medium">{t('generation.fixedPart')}</span>
            <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
              <LockIcon aria-hidden className="size-3" /> {t('generation.notEditable')}
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent className="border-t px-3 py-3">
            <FixedPart marked={prompt.markedFixedPart} />
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

function RecapItem({ term, children }: Readonly<{ term: string; children: ReactNode }>) {
  return (
    <div className="space-y-1">
      <dt className="text-label font-medium tracking-wide text-muted-foreground uppercase">{term}</dt>
      <dd className="text-muted-foreground">{children}</dd>
    </div>
  );
}

// Each read Input with its weight in what Claude reads, largest first, then the total
function ReadBreakdown({ readList, totalWords }: Readonly<{ readList: IPanelInput[]; totalWords: number }>) {
  const { t } = useTranslation('posting');
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="space-y-2">
      <h3 id={headingId} className="max-w-none text-label font-medium tracking-wide text-muted-foreground uppercase">
        {t('generation.breakdown')}
      </h3>
      <ul className="divide-y rounded-lg border">
        {readList
          .toSorted((first, second) => second.wordCount - first.wordCount)
          .map((input) => {
            const share = totalWords === 0 ? 0 : input.wordCount / totalWords;
            return (
              <li key={input.key} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 px-3 py-2">
                <span className="flex min-w-0 items-center gap-2 text-sm">
                  <KindIcon kind={input.kind} className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{input.label}</span>
                </span>
                <span className="text-right text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                  {t('generation.words', { count: input.wordCount })} ·{' '}
                  <span className="inline-block w-10 font-medium text-foreground">
                    {t('generation.percent', { value: share })}
                  </span>
                </span>
                <div aria-hidden className="col-span-2 h-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary/70" style={{ width: `${String(share * 100)}%` }} />
                </div>
              </li>
            );
          })}
        <li className="flex items-center justify-between gap-4 bg-muted/40 px-3 py-2 text-sm font-medium">
          <span>{t('generation.total', { documents: t('generation.documents', { count: readList.length }) })}</span>
          <span className="text-xs whitespace-nowrap tabular-nums">
            {t('generation.words', { count: totalWords })} ·{' '}
            <span className="inline-block w-10">{t('generation.percent', { value: 1 })}</span>
          </span>
        </li>
      </ul>
    </section>
  );
}

interface IRecap {
  generation: Generation;
  readList: IPanelInput[];
  totalWords: number;
  blockerList: string[];
  // The Prompt of the read Inputs, null while it loads or while the run is refused
  prompt: string | null;
  onCopy: (prompt: string) => void;
}

// Step 3, recap and launch: the run in plain words, then the details it rests on
function RecapStep({ generation, readList, totalWords, blockerList, prompt, onCopy }: Readonly<IRecap>) {
  const { t } = useTranslation('posting');
  const { artifact, nextNumber, chosenNumber, isSearchingWeb } = generation;
  const artifactLabel = t(`artifactLabelByArtifact.${artifact}`, { ns: 'common' });
  return (
    <div className="space-y-5">
      <p className="text-[15px] leading-7">
        {t(`generation.doesByArtifact.${artifact}`)}{' '}
        {t('generation.recapReads', {
          documents: t('generation.documents', { count: readList.length }),
          words: t('generation.words', { count: totalWords }),
          writes: t('generation.writes', { artifactLabel, number: nextNumber }),
        })}
      </p>
      <ReadBreakdown readList={readList} totalWords={totalWords} />
      <dl className="grid gap-3 rounded-lg bg-muted/50 p-4 text-sm sm:grid-cols-3">
        <RecapItem term={t('generation.afterTerm')}>
          {chosenNumber === null ? t('generation.keepsNone') : t('generation.keepsChosen', { number: chosenNumber })}
        </RecapItem>
        <RecapItem term={t('generation.durationTerm')}>
          {t('generation.durationValue', { duration: t(`generation.durationByArtifact.${artifact}`) })}
        </RecapItem>
        <RecapItem term={t('generation.webTerm')}>
          {isSearchingWeb ? t('generation.webYes') : t('generation.webNo')}
        </RecapItem>
      </dl>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed px-3 py-2.5">
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">{t('generation.copyHint')}</p>
        <Button
          variant="outline"
          size="sm"
          disabled={prompt === null}
          onClick={() => {
            if (prompt !== null) {
              onCopy(prompt);
            }
          }}
        >
          <ClipboardCopyIcon data-icon="inline-start" />
          {t('generation.copyPrompt')}
        </Button>
      </div>
      <Blockers blockerList={blockerList} />
    </div>
  );
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
    label: labelOf(t, reference, input),
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
              {step === 0 && <ReadStep inputList={inputList} blockerList={blockerList} onCheck={onCheck} />}
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
