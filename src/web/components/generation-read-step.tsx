import { cn } from 'cn';
import {
  BriefcaseIcon,
  CheckIcon,
  ChevronRightIcon,
  EyeIcon,
  FileCheck2Icon,
  FileTextIcon,
  LockIcon,
  PlusIcon,
  SendIcon,
  StickyNoteIcon,
  TriangleAlertIcon,
  UserRoundIcon,
  type LucideIcon,
} from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '#/web/components/ui/alert.tsx';
import { Button } from '#/web/components/ui/button.tsx';
import { Checkbox } from '#/web/components/ui/checkbox.tsx';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '#/web/components/ui/collapsible.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '#/web/components/ui/tooltip.tsx';

import type { GenerationInput } from './artifact.ts';

type InputGroup = 'posting' | 'profile' | 'annex';

// From three Past Letters on, they fold into one bundle: a long history stays manageable (spec #125)
const BUNDLE_MIN_COUNT = 3;

const ICON_BY_KIND: Record<GenerationInput['kind'], LucideIcon> = {
  job_description: BriefcaseIcon,
  artifact: FileCheck2Icon,
  custom_artifact: FileTextIcon,
  notes: StickyNoteIcon,
  profile_document: UserRoundIcon,
  past_letter: SendIcon,
};

// The Posting's Inputs, the Profile's core and Past Letters, and the Annexes to add
function groupOf({ kind, mode }: GenerationInput): InputGroup {
  if (kind === 'profile_document' && mode === 'optional') {
    return 'annex';
  }
  return kind === 'profile_document' || kind === 'past_letter' ? 'profile' : 'posting';
}

// The icon of an Input's kind
export function KindIcon({ kind, className }: Readonly<{ kind: GenerationInput['kind']; className: string }>) {
  const ICON = ICON_BY_KIND[kind];
  return <ICON aria-hidden className={className} />;
}

// What the panel needs of each Input: its label, and whether it is read
export interface IPanelInput extends GenerationInput {
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
export function Blockers({ blockerList }: Readonly<{ blockerList: string[] }>) {
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
export function ReadStep({
  inputList,
  blockerList,
  addInput,
  onCheck,
}: Readonly<{ inputList: IPanelInput[]; blockerList: string[]; addInput: ReactNode } & IChecks>) {
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
      {addInput}
    </div>
  );
}
