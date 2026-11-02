// PROTOTYPE · Posting page agent. One Artifact (Research, Letter, Portrait, Interview Brief, or a
// Custom one): its toolbar, then its text in one of three modes. The toolbar (DECISIONS.md « Artifacts »):
// the Version Select with its Draft/Validated state, a banner that makes validating a Draft obvious,
// « Générer / Regénérer » opening the generation panel (never a run directly), « Ajouter la mienne »,
// the modes Lire | Modifier | Comparer à l'Original, focus mode (Sidebar collapsed), and the line
// « Produite à partir de : … ». Reading is the variant's layout (reader.tsx); the Letter reads as a page.
import {
  BookOpenIcon,
  CheckIcon,
  Columns2Icon,
  FileUpIcon,
  LoaderIcon,
  LockIcon,
  Maximize2Icon,
  Minimize2Icon,
  MoreHorizontalIcon,
  PencilLineIcon,
  SparklesIcon,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import { Badge } from '#/web/prototype/components/ui/badge.tsx';
import { Button } from '#/web/prototype/components/ui/button.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/web/prototype/components/ui/dropdown-menu.tsx';
import { Progress } from '#/web/prototype/components/ui/progress.tsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/web/prototype/components/ui/select.tsx';
import { useSidebar } from '#/web/prototype/components/ui/sidebar.tsx';
import { ToggleGroup, ToggleGroupItem } from '#/web/prototype/components/ui/toggle-group.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '#/web/prototype/components/ui/tooltip.tsx';
import { cn } from '#/web/prototype/lib/utils.ts';

import { GenerationPanel } from '../generation-panel.tsx';
import {
  ARTIFACT_LABEL,
  chosenVersionOf,
  formatDate,
  VERSION_STATE_LABEL,
  type ArtifactType,
  type IArtifact,
  type IInterview,
  type IPosting,
  type IPostingDetail,
  type IVersion,
} from '../model.ts';
import { isLetterFrozen, LETTER_FROZEN_REASON, useActions, useRuns } from '../store.ts';
import { AddVersionDialog } from './add-version-dialog.tsx';
import { CompareView } from './compare.tsx';
import { ArtifactEditor } from './editor.tsx';
import { ArtifactContent, ArtifactReader, type ReadingVariant } from './reader.tsx';

type Mode = 'read' | 'edit' | 'compare';

// « la Recherche », « le Portrait »…
const ARTICLE_LABEL: Record<ArtifactType, string> = {
  research: 'la Recherche',
  letter: 'la Lettre de motivation',
  portrait: 'le Portrait',
  interview_brief: 'la Fiche d’entretien',
  custom: 'ce document',
};

const EMPTY_PITCH: Record<ArtifactType, string> = {
  research:
    'La Recherche établit, sources à l’appui, ce que les recruteurs attendent pour cette Offre et dans quel contexte.',
  letter:
    'La Lettre de motivation de cette Offre. Elle a besoin d’une Recherche validée ; sa Version retenue est celle qui part.',
  portrait:
    'Le Portrait établit ce que l’on sait publiquement du parcours et des positions des Interlocuteurs de cet Entretien.',
  interview_brief:
    'La Fiche d’entretien prépare cet Entretien en croisant l’Offre et ses Interlocuteurs : quoi leur dire, quoi réviser, comment s’entraîner.',
  custom: 'Un texte ou un fichier à toi, que les générations peuvent lire.',
};

// What an Artifact is before its first Version, for the panel
export function emptyArtifactOf(key: string, type: ArtifactType, interviewNumber: number | null): IArtifact {
  return {
    key,
    type,
    label: ARTIFACT_LABEL[type],
    interviewNumber,
    format: type === 'letter' ? 'markdown' : 'mdx',
    versions: [],
    chosenNumber: null,
    refusal: null,
    fixedPart: null,
    isFixedPartExample: false,
  };
}

export function VersionStateBadge({ version, className }: { version: IVersion; className?: string }) {
  if (version.state === 'draft') {
    return (
      <Badge variant="outline" className={cn('gap-1.5 border-primary/40 text-primary', className)}>
        <span className="size-1.5 rounded-full bg-primary" />
        Brouillon
      </Badge>
    );
  }
  return (
    <Badge variant={version.isChosen ? 'secondary' : 'outline'} className={className}>
      <CheckIcon />
      {version.isChosen ? 'Validée · retenue' : 'Validée'}
    </Badge>
  );
}

function FocusButton() {
  const { open, setOpen, isMobile } = useSidebar();
  if (isMobile) {
    return null;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={open ? 'ghost' : 'secondary'}
          size="icon-sm"
          aria-label={open ? 'Mode focus' : 'Quitter le mode focus'}
          onClick={() => setOpen(!open)}
        >
          {open ? <Maximize2Icon /> : <Minimize2Icon />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{open ? 'Mode focus : replier la barre latérale' : 'Quitter le mode focus'}</TooltipContent>
    </Tooltip>
  );
}

// A Letter reads every past Letter: past this many Inputs, the line folds instead of filling the screen
const INPUT_PREVIEW_COUNT = 8;

function ProducedFrom({ version }: { version: IVersion }) {
  const [isAllShown, setIsAllShown] = useState(false);
  if (version.origin === 'candidate') {
    return (
      <p className="text-xs text-muted-foreground">
        Apportée par toi le {formatDate(version.createdAt)} · pas d’Original à comparer
      </p>
    );
  }
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
      <SparklesIcon className="size-3.5" />
      <span>Produite le {formatDate(version.createdAt)} à partir de :</span>
      {version.inputs.length === 0 ? (
        <span className="italic">Inputs non conservés pour cette Version</span>
      ) : (
        <>
          {(isAllShown ? version.inputs : version.inputs.slice(0, INPUT_PREVIEW_COUNT)).map((input) => (
            <Badge
              key={input.key}
              variant="outline"
              className="h-5 px-1.5 text-[11px] font-normal text-muted-foreground"
            >
              {input.label}
            </Badge>
          ))}
          {version.inputs.length > INPUT_PREVIEW_COUNT ? (
            <button
              type="button"
              className="text-[11px] text-primary underline-offset-4 hover:underline"
              onClick={() => setIsAllShown(!isAllShown)}
            >
              {isAllShown ? 'Réduire' : `+ ${String(version.inputs.length - INPUT_PREVIEW_COUNT)} autres`}
            </button>
          ) : null}
        </>
      )}
    </p>
  );
}

// Disabled buttons fire no tooltip: the wrapper does
function WithReason({ reason, children }: { reason: string | null; children: ReactNode }) {
  if (reason === null) {
    return <>{children}</>;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0}>{children}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{reason}</TooltipContent>
    </Tooltip>
  );
}

const MODE_LIST: { mode: Mode; label: string; icon: LucideIcon }[] = [
  { mode: 'read', label: 'Lire', icon: BookOpenIcon },
  { mode: 'edit', label: 'Modifier', icon: PencilLineIcon },
  { mode: 'compare', label: 'Comparer à l’Original', icon: Columns2Icon },
];

function RunProgress({ reference, artifactKey }: { reference: string; artifactKey: string }) {
  const run = useRuns(reference).find(
    (candidate) => candidate.artifactKey === artifactKey && candidate.status === 'running',
  );
  if (run === undefined) {
    return null;
  }
  return (
    <div className="rounded-xl border border-primary/25 bg-primary/[0.04] p-4">
      <div className="mb-2 flex items-center gap-2 text-sm">
        <LoaderIcon className="size-4 animate-spin text-primary" />
        <span className="font-medium">Génération en cours</span>
        <span className="text-muted-foreground">· {run.phase}</span>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">{Math.round(run.progress * 100)} %</span>
      </div>
      <Progress value={run.progress * 100} className="h-1.5" />
      <p className="mt-2 text-xs text-muted-foreground">
        La nouvelle Version arrivera en Brouillon ; la Version retenue ne change pas d’ici là.
      </p>
    </div>
  );
}

function LetterPage({ version, recipients }: { version: IVersion; recipients: IPostingDetail['recipients'] }) {
  return (
    <div className="mx-auto max-w-[72ch]">
      {recipients === null || recipients.to === null ? null : (
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-muted-foreground">
          <span>
            À : <span className="text-foreground">{recipients.to}</span>
          </span>
          {recipients.ccList.length === 0 ? null : <span>Cc : {recipients.ccList.join(', ')}</span>}
        </div>
      )}
      <div className="rounded-xl border bg-card px-6 py-8 shadow-xs sm:px-12 sm:py-12">
        <ArtifactContent source={version.text} format="markdown" className="prose-p:my-3 sm:prose-lg sm:prose-p:my-4" />
      </div>
    </div>
  );
}

export interface IArtifactViewProps {
  posting: IPosting;
  artifactKey: string;
  type: ArtifactType;
  artifact: IArtifact | undefined;
  interview?: IInterview | undefined;
  variant: ReadingVariant;
  recipients?: IPostingDetail['recipients'];
  // On the Posting page: focus mode collapses the Sidebar (the Revision has none)
  canFocus?: boolean;
  headerOffset?: number;
}

export function ArtifactView({
  posting,
  artifactKey,
  type,
  artifact,
  interview,
  variant,
  recipients = null,
  canFocus = false,
  headerOffset,
}: IArtifactViewProps) {
  const actions = useActions();
  const versionList = artifact?.versions ?? [];
  const latest = versionList.at(-1);
  const [selectedNumber, setSelectedNumber] = useState<number | null>(latest?.number ?? null);
  const [requestedMode, setMode] = useState<Mode>('read');
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  // A new Version (generated or brought) shows itself
  const latestNumber = latest?.number ?? null;
  useEffect(() => {
    setSelectedNumber(latestNumber);
    setMode('read');
  }, [latestNumber]);

  const version = versionList.find(({ number }) => number === selectedNumber) ?? latest;
  const chosen = artifact === undefined ? undefined : chosenVersionOf(artifact);
  const refusal = artifact?.refusal ?? null;
  // A frozen Letter is read-only: no correction, no Version of the Candidate, no validation
  const frozenReason = isLetterFrozen(type, posting) ? LETTER_FROZEN_REASON : null;
  const isFrozen = frozenReason !== null;
  const mode: Mode = isFrozen && requestedMode === 'edit' ? 'read' : requestedMode;
  const articleLabel = ARTICLE_LABEL[type];
  const resolved = artifact ?? emptyArtifactOf(artifactKey, type, interview?.number ?? null);
  const format = resolved.format;

  async function validate(number: number) {
    setIsValidating(true);
    await actions.validateVersion(posting.reference, artifactKey, number);
    setIsValidating(false);
  }

  const generateButton = (
    <WithReason reason={refusal}>
      <Button
        variant={version === undefined ? 'default' : 'outline'}
        size="sm"
        disabled={refusal !== null}
        onClick={() => setIsPanelOpen(true)}
      >
        <SparklesIcon />
        {version === undefined ? 'Générer' : 'Regénérer'}
      </Button>
    </WithReason>
  );

  const dialogs = (
    <>
      <AddVersionDialog
        label={articleLabel}
        isOpen={isAddOpen}
        onOpenChange={setIsAddOpen}
        onAdd={(text) => actions.addVersion(posting.reference, artifactKey, { text, origin: 'candidate' })}
      />
      {isPanelOpen ? (
        <GenerationPanel
          artifact={resolved}
          posting={posting}
          interview={interview}
          onClose={() => setIsPanelOpen(false)}
        />
      ) : null}
    </>
  );

  // The dialogs keep their place whichever body shows: the panel of a first Version must survive the
  // switch from the empty state to the reader, or its run and « Voir le Brouillon » vanish
  return (
    <>
      {bodyOf()}
      {dialogs}
    </>
  );

  function bodyOf() {
    if (version === undefined) {
      return (
        <div className="space-y-4">
          <RunProgress reference={posting.reference} artifactKey={artifactKey} />
          <div className="flex flex-col items-center rounded-2xl border border-dashed px-6 py-14 text-center">
            <div className="mb-4 grid size-11 place-items-center rounded-full bg-muted">
              <SparklesIcon className="size-5 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold">Pas encore de {ARTIFACT_LABEL[type]}</h3>
            <p className="mt-1.5 max-w-md text-sm text-balance text-muted-foreground">{EMPTY_PITCH[type]}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {generateButton}
              <WithReason reason={frozenReason}>
                <Button variant="outline" size="sm" disabled={isFrozen} onClick={() => setIsAddOpen(true)}>
                  <FileUpIcon />
                  Ajouter la mienne
                </Button>
              </WithReason>
            </div>
            {refusal === null ? null : <p className="mt-3 max-w-md text-xs text-muted-foreground">{refusal}</p>}
          </div>
        </div>
      );
    }

    const hasOriginal = version.original !== null;
    const isDraft = version.state === 'draft';

    return (
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="@container space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={String(version.number)}
              onValueChange={(value) => {
                setSelectedNumber(Number(value));
                setMode('read');
              }}
            >
              <SelectTrigger size="sm" className="min-w-44 font-medium" aria-label="Version">
                <SelectValue>
                  Version {version.number} · {VERSION_STATE_LABEL[version.state]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="start">
                {versionList.toReversed().map((other) => (
                  <SelectItem key={other.number} value={String(other.number)}>
                    <span className="font-medium">Version {other.number}</span>
                    <span className="text-muted-foreground">
                      · {VERSION_STATE_LABEL[other.state]}
                      {other.isChosen ? ' · retenue' : ''} · {other.origin === 'ai' ? 'IA' : 'toi'} ·{' '}
                      {formatDate(other.createdAt)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <VersionStateBadge version={version} />
            <div className="ml-auto flex items-center gap-1.5">
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                spacing={0}
                value={mode}
                onValueChange={(value) => {
                  if (value !== '') {
                    setMode(value as Mode);
                  }
                }}
                className="hidden @xl:flex"
              >
                {MODE_LIST.map(({ mode: itemMode, label, icon: Icon }) => {
                  const isNoOriginal = itemMode === 'compare' && !hasOriginal;
                  const isFrozenEdit = itemMode === 'edit' && isFrozen;
                  return (
                    <ToggleGroupItem
                      key={itemMode}
                      value={itemMode}
                      disabled={isNoOriginal || isFrozenEdit}
                      aria-label={label}
                      title={
                        isNoOriginal
                          ? 'Version apportée par toi : pas d’Original'
                          : isFrozenEdit
                            ? (frozenReason ?? label)
                            : label
                      }
                      className="gap-1.5 px-2.5"
                    >
                      <Icon />
                      <span className={cn(itemMode === 'compare' && 'hidden @5xl:inline')}>
                        {itemMode === 'compare' ? 'Comparer à l’Original' : label}
                      </span>
                    </ToggleGroupItem>
                  );
                })}
              </ToggleGroup>
              <WithReason reason={frozenReason}>
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden @4xl:inline-flex"
                  disabled={isFrozen}
                  onClick={() => setIsAddOpen(true)}
                >
                  <FileUpIcon />
                  Ajouter la mienne
                </Button>
              </WithReason>
              {generateButton}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" className="@4xl:hidden" aria-label="Plus d’actions">
                    <MoreHorizontalIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {MODE_LIST.map(({ mode: itemMode, label, icon: Icon }) => (
                    <DropdownMenuItem
                      key={itemMode}
                      disabled={(itemMode === 'compare' && !hasOriginal) || (itemMode === 'edit' && isFrozen)}
                      onSelect={() => setMode(itemMode)}
                      className="md:hidden"
                    >
                      <Icon />
                      {label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator className="md:hidden" />
                  <DropdownMenuItem disabled={isFrozen} onSelect={() => setIsAddOpen(true)}>
                    <FileUpIcon />
                    Ajouter la mienne
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {canFocus ? <FocusButton /> : null}
            </div>
          </div>
          <ProducedFrom version={version} />
        </div>

        {frozenReason === null ? null : (
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            <LockIcon className="size-4 shrink-0" />
            {frozenReason}
          </div>
        )}

        <RunProgress reference={posting.reference} artifactKey={artifactKey} />

        {isDraft ? (
          <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/[0.05] p-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Version {version.number} en Brouillon : relis-la, puis valide-la</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {type === 'letter'
                  ? 'Seule la Version retenue part chez l’employeur.'
                  : 'Tant qu’elle n’est pas validée, aucun autre Artifact ne la lit.'}{' '}
                {chosen === undefined
                  ? 'Aucune Version n’est retenue pour l’instant.'
                  : `En attendant, la Version ${String(chosen.number)} reste la Version retenue.`}
              </p>
            </div>
            <WithReason reason={frozenReason}>
              <Button
                className="shrink-0"
                disabled={isValidating || isFrozen}
                onClick={() => void validate(version.number)}
              >
                <CheckIcon />
                {isValidating ? 'Validation…' : `Valider la Version ${String(version.number)}`}
              </Button>
            </WithReason>
          </div>
        ) : null}
        {!isDraft && !version.isChosen && chosen !== undefined ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            Ancienne Version. La Version retenue est la {chosen.number}.
            <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setSelectedNumber(chosen.number)}>
              La voir
            </Button>
          </div>
        ) : null}

        {/* Body */}
        <div className="pt-2">
          {mode === 'edit' ? (
            <ArtifactEditor
              key={`${artifactKey}:${String(version.number)}`}
              text={version.text}
              original={version.original}
              format={format}
              onCancel={() => setMode('read')}
              onSave={async (text) => {
                await actions.editVersion(posting.reference, artifactKey, version.number, text);
                setMode('read');
              }}
            />
          ) : mode === 'compare' && version.original !== null ? (
            <CompareView
              original={version.original}
              text={version.text}
              format={format}
              versionNumber={version.number}
            />
          ) : type === 'letter' ? (
            <LetterPage version={version} recipients={recipients} />
          ) : (
            <ArtifactReader
              key={`${artifactKey}:${String(version.number)}`}
              variant={variant}
              source={version.text}
              format={format}
              memoryKey={`${posting.reference}:${artifactKey}:${String(version.number)}`}
              headerOffset={headerOffset}
            />
          )}
        </div>
      </div>
    );
  }
}
