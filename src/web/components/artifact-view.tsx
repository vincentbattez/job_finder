import { cn } from 'cn';
import { BookOpenIcon, CheckIcon, FocusIcon, LoaderIcon, LockIcon, PencilLineIcon, SparklesIcon } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type { Artifact } from '#/actions/index.ts';
import { Badge } from '#/web/components/ui/badge.tsx';
import { Button } from '#/web/components/ui/button.tsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#/web/components/ui/select.tsx';
import { useSidebar } from '#/web/components/ui/sidebar.tsx';

import { ArtifactReader, LetterPage } from './artifact-reader.tsx';
import type { IArtifactVersions, IVersionDetail } from './artifact.ts';
import type { IRecipients } from './recipients.tsx';

export type ArtifactMode = 'read' | 'edit';

type ShownVersion = IVersionDetail['version'];

// A Version's state as the Select and its badge word it: its job's while it runs or once it failed, else
// its validation (ADR-0019)
function stateOf({ state, validation }: Pick<ShownVersion, 'state' | 'validation'>) {
  return state === 'ready' ? validation : state;
}

// A Draft is loud, in the Draft blue with its dot; the Chosen Version reads "Validated, chosen" with a check
// (DESIGN.md « Badges and chips »)
function VersionStateBadge({ version }: Readonly<{ version: ShownVersion }>) {
  const { t } = useTranslation('posting');
  const state = stateOf(version);
  if (state === 'draft') {
    return (
      <Badge variant="outline" data-validation="draft" className="gap-1.5 border-draft/40 text-draft">
        <span aria-hidden className="size-1.5 rounded-full bg-draft" />
        {t('artifactView.stateLabelByState.draft')}
      </Badge>
    );
  }
  if (state === 'validated') {
    return (
      <Badge
        variant={version.isChosen ? 'secondary' : 'outline'}
        data-validation="validated"
        className={cn(version.isChosen && 'bg-validated/10 text-validated-foreground')}
      >
        <CheckIcon aria-hidden />
        {version.isChosen ? t('artifactView.chosenBadge') : t('artifactView.stateLabelByState.validated')}
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className={cn(state === 'failed' ? 'border-destructive/40 text-destructive' : 'text-pending-foreground')}
    >
      {t(`artifactView.stateLabelByState.${state}`)}
    </Badge>
  );
}

function VersionSelect({
  versionList,
  version,
  onSelect,
}: Readonly<{ versionList: IVersionDetail[]; version: ShownVersion; onSelect: (number: number) => void }>) {
  const { t } = useTranslation('posting');
  return (
    <Select
      value={String(version.number)}
      onValueChange={(value) => {
        onSelect(Number(value));
      }}
    >
      <SelectTrigger size="sm" className="min-w-44 font-medium" aria-label={t('artifactView.versionSelect')}>
        <SelectValue>
          {t('artifactView.versionValue', {
            number: version.number,
            stateLabel: t(`artifactView.stateLabelByState.${stateOf(version)}`),
          })}
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="start">
        {versionList.toReversed().map(({ version: other }) => (
          <SelectItem key={other.number} value={String(other.number)}>
            <span className="font-medium">{t('artifactView.versionNumber', { number: other.number })}</span>
            <span className="text-muted-foreground">
              {t(other.isChosen ? 'artifactView.versionOptionChosen' : 'artifactView.versionOption', {
                stateLabel: t(`artifactView.stateLabelByState.${stateOf(other)}`),
                originLabel: t(`artifactView.originLabelByOrigin.${other.origin}`),
                date: other.createdAt,
              })}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// The modes of a Version: reading it, or correcting it in place when it is not frozen (ADR-0019)
function ModeSwitch({
  mode,
  isEditable,
  onModeChange,
}: Readonly<{ mode: ArtifactMode; isEditable: boolean; onModeChange: (mode: ArtifactMode) => void }>) {
  const { t } = useTranslation('posting');
  const modeList = [
    { value: 'read', label: t('artifactView.modeRead'), icon: <BookOpenIcon aria-hidden />, isDisabled: false },
    { value: 'edit', label: t('artifactView.modeEdit'), icon: <PencilLineIcon aria-hidden />, isDisabled: !isEditable },
  ] as const;
  return (
    <div role="group" aria-label={t('artifactView.modes')} className="flex rounded-md border p-0.5">
      {modeList.map(({ value, label, icon, isDisabled }) => (
        <Button
          key={value}
          type="button"
          size="sm"
          variant={mode === value ? 'secondary' : 'ghost'}
          aria-pressed={mode === value}
          disabled={isDisabled}
          className="h-7"
          onClick={() => {
            onModeChange(value);
          }}
        >
          {icon}
          {label}
        </Button>
      ))}
    </div>
  );
}

// Focus mode collapses the Sidebar, so the document takes the whole width (spec #125, user story 11)
function FocusModeButton() {
  const { t } = useTranslation('posting');
  const { state, toggleSidebar } = useSidebar();
  const isFocused = state === 'collapsed';
  return (
    <Button
      type="button"
      size="sm"
      variant={isFocused ? 'secondary' : 'ghost'}
      aria-pressed={isFocused}
      className="hidden md:inline-flex"
      onClick={toggleSidebar}
    >
      <FocusIcon aria-hidden />
      {t('reader.focusMode')}
    </Button>
  );
}

// The Instructions its run had, folded until asked, so that two Versions compare
function VersionInstructions({ version }: Readonly<{ version: ShownVersion }>) {
  const { t } = useTranslation('posting');
  return (
    <details className="group text-xs text-muted-foreground">
      <summary className="w-fit cursor-pointer rounded-sm underline-offset-4 hover:text-foreground hover:underline">
        {t('artifactView.instructionsSummary', {
          originLabel: version.hasCandidateInstructions
            ? t('instructions.candidateOrigin', { ns: 'settings' })
            : t('instructions.defaultOrigin', { ns: 'settings' }),
        })}
      </summary>
      <p className="mt-2 max-w-[72ch] rounded-lg bg-muted/50 px-3 py-2 text-sm whitespace-pre-wrap text-foreground">
        {version.instructions}
      </p>
    </details>
  );
}

// A generation under way: the new Version arrives as a Draft, the Chosen Version stays meanwhile
function RunningCard({ state }: Readonly<{ state: IArtifactVersions['state'] }>) {
  const { t } = useTranslation('posting');
  return (
    <div data-running className="rounded-xl border border-draft/25 bg-draft/5 p-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <LoaderIcon aria-hidden className="size-4 animate-spin text-draft" />
        {state === 'queued' ? t('artifactView.queued') : t('artifactView.running')}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{t('artifactView.runningNote')}</p>
    </div>
  );
}

// The banner that makes validating a Draft obvious (DESIGN.md « Artifact toolbar and Draft banner »)
function DraftBanner({
  artifact,
  number,
  chosenNumber,
  validateButton,
}: Readonly<{ artifact: Artifact; number: number; chosenNumber: number | null; validateButton: ReactNode }>) {
  const { t } = useTranslation('posting');
  return (
    <div
      data-draft-banner
      className="flex flex-col gap-3 rounded-xl border border-draft/30 bg-draft/5 p-4 sm:flex-row sm:items-center"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{t('artifactView.draftHeading', { number })}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {artifact === 'letter' ? t('artifactView.draftNoteLetter') : t('artifactView.draftNote')}{' '}
          {chosenNumber === null
            ? t('artifactView.draftNoChosenNote')
            : t('artifactView.draftChosenNote', { number: chosenNumber })}
        </p>
      </div>
      {validateButton}
    </div>
  );
}

// Before any Version: what the Artifact is for, and its launch
function EmptyArtifact({ artifact, launch }: Readonly<{ artifact: Artifact; launch: ReactNode }>) {
  const { t } = useTranslation('posting');
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed px-6 py-12 text-center">
      <div className="mb-4 grid size-11 place-items-center rounded-full bg-muted">
        <SparklesIcon aria-hidden className="size-5 text-muted-foreground" />
      </div>
      <p className="max-w-none text-base font-semibold">
        {t('artifactView.emptyHeading', { artifactLabel: t(`artifactLabelByArtifact.${artifact}`, { ns: 'common' }) })}
      </p>
      <p className="mt-1.5 max-w-md text-sm text-balance text-muted-foreground">
        {t(`artifactView.emptyPitchByArtifact.${artifact}`)}
      </p>
      <div className="mt-5 w-full max-w-xl text-left">{launch}</div>
    </div>
  );
}

// The Letter reads as a page, the way the employer receives it; every other Artifact, along its rail
function VersionBody({
  artifact,
  format,
  detail,
  recipients,
}: Readonly<{
  artifact: Artifact;
  format: IArtifactVersions['format'];
  detail: IVersionDetail;
  recipients: IRecipients | null;
}>) {
  const { t } = useTranslation('posting');
  if (detail.text === null) {
    return (
      <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
        {detail.version.state === 'running' ? t('artifactView.runningVersion') : t('artifactView.failedVersion')}
      </p>
    );
  }
  if (artifact === 'letter') {
    return <LetterPage text={detail.text} recipients={recipients} />;
  }
  return <ArtifactReader text={detail.text} format={format} />;
}

interface IArtifactViewSlots {
  // The launch of its module, its refusal and its Prompt
  launch: ReactNode;
  // Validating a Draft, or choosing an older Validated Version again
  validateButton: (number: number, kind: 'validate' | 'chooseAgain') => ReactNode;
  editor: (detail: IVersionDetail) => ReactNode;
}

// One Artifact of the Posting page (spec #125, « Versions: Draft, Validated, Original »): its toolbar with
// the Version Select and the Version's state, the Draft banner with its validate button, a muted lock
// bar for a frozen Letter, a running generation's card, then the Version's text, read or corrected
export function ArtifactView({
  artifact,
  state,
  format,
  isFrozen,
  versionList,
  selectedNumber,
  mode,
  onSelect,
  onModeChange,
  launch,
  validateButton,
  editor,
  recipients = null,
}: Readonly<
  Pick<IArtifactVersions, 'artifact' | 'state' | 'format' | 'isFrozen' | 'versionList'> &
    IArtifactViewSlots & {
      selectedNumber: number | null;
      mode: ArtifactMode;
      // The Letter's recommended To and Cc, shown above its page
      recipients?: IRecipients | null;
      onSelect: (number: number) => void;
      onModeChange: (mode: ArtifactMode) => void;
    }
>) {
  const { t } = useTranslation('posting');
  const headingId = useId();
  const detail = versionList.find(({ version }) => version.number === selectedNumber) ?? versionList.at(-1);
  const chosen = versionList.find(({ version }) => version.isChosen)?.version;
  const isRunning = state === 'queued' || state === 'in_progress';
  return (
    <section aria-labelledby={headingId} data-artifact={artifact} className="space-y-4">
      <h2 id={headingId} className="sr-only">
        {t(`artifactLabelByArtifact.${artifact}`, { ns: 'common' })}
      </h2>
      {detail === undefined ? (
        <>
          {isRunning && <RunningCard state={state} />}
          <EmptyArtifact artifact={artifact} launch={launch} />
        </>
      ) : (
        <>
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <VersionSelect versionList={versionList} version={detail.version} onSelect={onSelect} />
              <VersionStateBadge version={detail.version} />
              <div className="ml-auto flex items-center gap-2">
                <FocusModeButton />
                <ModeSwitch
                  mode={mode}
                  isEditable={detail.isCorrectable && detail.text !== null}
                  onModeChange={onModeChange}
                />
              </div>
            </div>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {detail.version.origin === 'ai' && <SparklesIcon aria-hidden className="size-3.5" />}
              {t(detail.version.origin === 'ai' ? 'artifactView.producedOn' : 'artifactView.broughtOn', {
                date: detail.version.createdAt,
              })}
            </p>
            {detail.version.origin === 'ai' && <VersionInstructions version={detail.version} />}
          </div>
          {launch}
          {isFrozen && (
            <p className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              <LockIcon aria-hidden className="size-4 shrink-0" />
              {t('artifactView.frozen')}
            </p>
          )}
          {isRunning && <RunningCard state={state} />}
          {detail.isValidatable && detail.version.validation === 'draft' && (
            <DraftBanner
              artifact={artifact}
              number={detail.version.number}
              chosenNumber={chosen?.number ?? null}
              validateButton={validateButton(detail.version.number, 'validate')}
            />
          )}
          {detail.version.validation === 'validated' && !detail.version.isChosen && chosen !== undefined && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              {t('artifactView.olderVersion', { number: chosen.number })}
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={() => {
                  onSelect(chosen.number);
                }}
              >
                {t('artifactView.seeChosen')}
              </Button>
              {detail.isValidatable && validateButton(detail.version.number, 'chooseAgain')}
            </div>
          )}
          <div className="pt-2">
            {mode === 'edit' && detail.isCorrectable && detail.text !== null ? (
              editor(detail)
            ) : (
              <VersionBody artifact={artifact} format={format} detail={detail} recipients={recipients} />
            )}
          </div>
        </>
      )}
    </section>
  );
}
