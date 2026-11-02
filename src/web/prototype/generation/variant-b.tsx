// PROTOTYPE · generation panel, variant B « Sheet + aperçu »: a wide Sheet from the right, the Inputs as
// a checklist on the left and a live preview pane on the right. Bet: by default the pane shows the whole
// Prompt as Claude will receive it (Fixed Part, then each checked Input, then the Instructions), and it
// changes as the Candidate checks or unchecks; clicking a line shows that one alone.
import {
  ArrowLeftIcon,
  BookOpenIcon,
  ChevronRightIcon,
  ClockIcon,
  FilePenLineIcon,
  GlobeIcon,
  LockIcon,
  ScrollTextIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { Badge } from '#/web/prototype/components/ui/badge.tsx';
import { Button } from '#/web/prototype/components/ui/button.tsx';
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
  FixedPartBody,
  FixedPartText,
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
  checkedPhrase,
  formatDocuments,
  formatWords,
  GROUP_HINT,
  GROUP_LABEL,
  itemsOf,
  type GenerationPanelState,
  type IPanelInput,
} from './use-generation-panel.ts';

// What the right pane shows: the whole Prompt, the Instructions, the Fixed Part or one Input
type Selection = 'prompt' | 'instructions' | 'fixed' | `input:${string}`;

export function PanelSheet({
  panel,
  onClose,
  subtitle,
}: {
  panel: GenerationPanelState;
  onClose: () => void;
  subtitle: string;
}) {
  const [selection, setSelection] = useState<Selection>('prompt');
  // Narrow screens show the list or the pane, not both
  const [isPaneOpen, setIsPaneOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  function select(next: Selection) {
    setSelection(next);
    setIsPaneOpen(true);
  }

  return (
    <Sheet
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
    >
      <SheetContent
        side="right"
        className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[min(1180px,94vw)]"
        onInteractOutside={keepSwitcherClicks}
        onOpenAutoFocus={focusSelf}
      >
        <SheetHeader className="border-b px-5 py-4 pr-12">
          <SheetTitle className="text-lg">{panel.explanation.title}</SheetTitle>
          <SheetDescription>{subtitle}</SheetDescription>
        </SheetHeader>
        {panel.run === undefined ? (
          <>
            <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(320px,400px)_1fr]">
              <aside className={cn('flex min-h-0 flex-col border-r', isPaneOpen && 'max-md:hidden')}>
                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
                  <Summary panel={panel} />
                  <Blockers panel={panel} />
                  <PrefillNote panel={panel} />
                  <ListButton
                    isSelected={selection === 'prompt'}
                    onClick={() => select('prompt')}
                    icon={<ScrollTextIcon />}
                    label="Tout ce que Claude recevra"
                    meta={`Prompt complet · ${formatWords(panel.checkedWords)} d’Inputs`}
                  />
                  {(['posting', 'profile', 'annex'] as const).map((group) => {
                    const inputList = panel.inputs.filter((input) => input.group === group);
                    const line = (input: IPanelInput) => (
                      <InputLine
                        key={input.key}
                        panel={panel}
                        input={input}
                        isSelected={selection === `input:${input.key}`}
                        onSelect={() => select(`input:${input.key}`)}
                      />
                    );
                    if (inputList.length === 0) {
                      return null;
                    }
                    if (group === 'annex') {
                      return (
                        <InputBundle
                          key={group}
                          panel={panel}
                          title={GROUP_LABEL.annex}
                          hint={GROUP_HINT.annex}
                          inputs={inputList}
                          className="-mx-1 rounded-md border"
                        >
                          <div className="space-y-0.5 border-t p-1">{inputList.map(line)}</div>
                        </InputBundle>
                      );
                    }
                    return (
                      <div key={group} className="space-y-1">
                        <p className="px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                          {GROUP_LABEL[group]}
                        </p>
                        {itemsOf(inputList).map((item) =>
                          item.kind === 'input' ? (
                            line(item.input)
                          ) : (
                            <InputBundle
                              key={item.key}
                              panel={panel}
                              title={item.title}
                              hint={item.hint}
                              inputs={item.inputs}
                              className="-mx-1 rounded-md border"
                            >
                              <div className="space-y-0.5 border-t p-1">{item.inputs.map(line)}</div>
                            </InputBundle>
                          ),
                        )}
                      </div>
                    );
                  })}
                  <AddInputButton onClick={() => setIsAdding(true)} />
                  <div className="space-y-1">
                    <p className="px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Comment écrire
                    </p>
                    <ListButton
                      isSelected={selection === 'instructions'}
                      onClick={() => select('instructions')}
                      icon={<SlidersHorizontalIcon />}
                      label="Consignes"
                      meta={
                        panel.instructions.isDirty
                          ? 'Modifiées, à enregistrer'
                          : panel.instructions.isCandidate
                            ? 'Les tiennes · modifiables'
                            : 'Par défaut · modifiables'
                      }
                    />
                    <ListButton
                      isSelected={selection === 'fixed'}
                      onClick={() => select('fixed')}
                      icon={<LockIcon />}
                      label="Partie fixe du Prompt"
                      meta="Non modifiable"
                    />
                  </div>
                </div>
              </aside>
              <section className={cn('flex min-h-0 flex-col bg-muted/20', !isPaneOpen && 'max-md:hidden')}>
                <Pane panel={panel} selection={selection} onBack={() => setIsPaneOpen(false)} onSelect={select} />
              </section>
            </div>
            <footer className="flex items-center gap-2 border-t bg-muted/30 px-5 py-3">
              <p className="mr-auto text-xs text-muted-foreground max-sm:hidden">
                {formatDocuments(panel.checkedInputs.length)} · {formatWords(panel.checkedWords)} ·{' '}
                {panel.instructions.isCandidate || panel.instructions.isDirty
                  ? 'tes Consignes'
                  : 'Consignes par défaut'}{' '}
                · {panel.explanation.duration}
              </p>
              <Button variant="outline" className="max-sm:flex-1" onClick={onClose}>
                Annuler
              </Button>
              <Button className="max-sm:flex-1" disabled={!panel.canLaunch} onClick={() => void panel.launch()}>
                <SparklesIcon data-icon="inline-start" />
                {panel.isLaunching ? 'Lancement…' : 'Lancer'}
              </Button>
            </footer>
          </>
        ) : (
          <div className="mx-auto w-full max-w-lg px-5 py-10">
            <RunProgress panel={panel} onClose={onClose} />
          </div>
        )}
        <AddInputDialog panel={panel} open={isAdding} onOpenChange={setIsAdding} />
      </SheetContent>
    </Sheet>
  );
}

// The run in three short lines, above the list
function Summary({ panel }: { panel: GenerationPanelState }) {
  const { explanation } = panel;
  const lineClass = 'flex gap-2.5 [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground';
  return (
    <div className="space-y-2 text-sm">
      <p className={lineClass}>
        <BookOpenIcon />
        <span>
          Claude lit <strong className="font-medium">{checkedPhrase(panel.checkedInputs.length)}</strong>, mot pour mot.
        </span>
      </p>
      <p className={lineClass}>
        {explanation.usesWeb ? <GlobeIcon /> : <SparklesIcon />}
        <span className="text-muted-foreground">{explanation.does}</span>
      </p>
      <p className={lineClass}>
        <FilePenLineIcon />
        <span className="text-muted-foreground">
          Il écrit {explanation.writes}. {explanation.keeps}
        </span>
      </p>
      <p className={lineClass}>
        <ClockIcon />
        <span className="text-muted-foreground">{explanation.duration} environ ; tu peux fermer pendant ce temps.</span>
      </p>
    </div>
  );
}

function ListButton({
  isSelected,
  onClick,
  icon,
  label,
  meta,
}: {
  isSelected: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  meta: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={isSelected}
      className={cn(
        'flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground',
        isSelected && 'bg-accent text-accent-foreground ring-1 ring-border',
      )}
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">{meta}</span>
      </span>
      <ChevronRightIcon className="opacity-50" />
    </button>
  );
}

function InputLine({
  panel,
  input,
  isSelected,
  onSelect,
}: {
  panel: GenerationPanelState;
  input: IPanelInput;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const Icon = KIND_ICON[input.kind];
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md pl-2 transition-colors hover:bg-muted',
        isSelected && 'bg-accent ring-1 ring-border',
      )}
    >
      <InputCheckbox input={input} panel={panel} />
      <button
        type="button"
        onClick={onSelect}
        aria-current={isSelected}
        data-preview-toggle={input.key}
        className="flex min-w-0 flex-1 items-center gap-2.5 py-2 pr-2 text-left"
      >
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className={cn('block truncate text-sm', !input.isChecked && 'text-muted-foreground')}>
            {input.label}
          </span>
          <span className="block text-xs text-muted-foreground">
            <InputMeta input={input} />
          </span>
        </span>
        <ChevronRightIcon className="size-4 shrink-0 opacity-50" />
      </button>
    </div>
  );
}

function PaneHeader({
  title,
  meta,
  onBack,
  aside,
}: {
  title: string;
  meta: ReactNode;
  onBack: () => void;
  aside?: ReactNode;
}) {
  return (
    <header className="flex items-start gap-2 border-b bg-background px-5 py-3">
      <Button
        variant="ghost"
        size="icon-sm"
        className="-ml-2 md:hidden"
        onClick={onBack}
        aria-label="Retour à la liste"
      >
        <ArrowLeftIcon />
      </Button>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{meta}</p>
      </div>
      {aside}
    </header>
  );
}

function Pane({
  panel,
  selection,
  onBack,
  onSelect,
}: {
  panel: GenerationPanelState;
  selection: Selection;
  onBack: () => void;
  onSelect: (selection: Selection) => void;
}) {
  if (selection === 'instructions') {
    return (
      <>
        <PaneHeader
          title="Consignes"
          meta="Comment Claude doit écrire. Elles passent après la Partie fixe, qu’elles ne peuvent pas lever."
          onBack={onBack}
        />
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <InstructionsEditor panel={panel} rows={18} />
        </div>
      </>
    );
  }
  if (selection === 'fixed') {
    return (
      <>
        <PaneHeader title="Partie fixe du Prompt" meta="Lecture seule" onBack={onBack} />
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-4">
          <FixedPartBody panel={panel} />
        </div>
      </>
    );
  }
  if (selection.startsWith('input:')) {
    const input = panel.inputs.find(({ key }) => `input:${key}` === selection);
    if (input !== undefined) {
      return (
        <>
          <PaneHeader
            title={input.label}
            meta={
              <>
                Texte exact lu par Claude · <InputMeta input={input} />
                {input.reason === null ? null : ` · ${input.reason}`}
              </>
            }
            onBack={onBack}
            aside={<Badge variant={input.isChecked ? 'default' : 'outline'}>{input.isChecked ? 'Lu' : 'Non lu'}</Badge>}
          />
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <InputContent input={input} className="max-w-[72ch]" />
          </div>
        </>
      );
    }
  }
  return (
    <>
      <PaneHeader
        title="Tout ce que Claude recevra"
        meta="Le Prompt dans l’ordre : Partie fixe, Inputs cochés, puis Consignes. Il suit tes coches en direct."
        onBack={onBack}
      />
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-4">
        <PromptBlock
          number={1}
          title="Partie fixe"
          text={panel.artifact.fixedPart ?? ''}
          onOpen={() => onSelect('fixed')}
        >
          <FixedPartText artifact={panel.artifact} />
        </PromptBlock>
        <div className="space-y-3">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            2 · Inputs · {formatDocuments(panel.checkedInputs.length)} · {formatWords(panel.checkedWords)}
          </p>
          {panel.checkedInputs.map((input) => (
            <PromptBlock
              key={input.key}
              title={input.label}
              text={input.content}
              onOpen={() => onSelect(`input:${input.key}`)}
            >
              <InputContent input={input} />
            </PromptBlock>
          ))}
        </div>
        <PromptBlock
          number={3}
          title="Consignes"
          text={panel.instructions.text}
          onOpen={() => onSelect('instructions')}
        >
          <InputContent input={{ content: panel.instructions.text }} />
        </PromptBlock>
      </div>
    </>
  );
}

// Roughly what fits in max-h-48 at the pane's width
const CLAMP_CHARACTERS = 600;

// One part of the Prompt, clamped; « Tout lire » opens it alone in the pane
function PromptBlock({
  number,
  title,
  text,
  onOpen,
  children,
}: {
  number?: number;
  title: string;
  // Its text, to fade only what is cut
  text: string;
  onOpen: () => void;
  children: ReactNode;
}) {
  return (
    <article className="rounded-lg border bg-background">
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <p
          className={cn(
            'flex-1 truncate text-sm font-medium',
            number !== undefined && 'text-xs tracking-wide uppercase text-muted-foreground',
          )}
        >
          {number === undefined ? title : `${String(number)} · ${title}`}
        </p>
        <Button variant="ghost" size="xs" onClick={onOpen}>
          Tout lire
        </Button>
      </header>
      <div className="relative max-h-48 overflow-hidden px-3 py-2">
        {children}
        {text.length > CLAMP_CHARACTERS ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-background to-transparent" />
        ) : null}
      </div>
    </article>
  );
}
