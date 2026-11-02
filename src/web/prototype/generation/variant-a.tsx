// PROTOTYPE · generation panel, variant A « Dialog »: a centered Dialog read top to bottom in a single
// scroll. Bet: one calm page, the explanation first, every Input previewed in place (it unfolds under
// its line), so nothing hides behind a click elsewhere.
import { BookOpenIcon, ChevronDownIcon, ClockIcon, FilePenLineIcon, GlobeIcon, SparklesIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { Button } from '#/web/prototype/components/ui/button.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/web/prototype/components/ui/dialog.tsx';
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
  SectionTitle,
} from './parts.tsx';
import {
  checkedPhrase,
  formatDocuments,
  formatWords,
  GROUP_HINT,
  GROUP_LABEL,
  itemsOf,
  type GenerationPanelState,
  type InputGroup,
  type IPanelInput,
} from './use-generation-panel.ts';

export function PanelDialog({
  panel,
  onClose,
  subtitle,
}: {
  panel: GenerationPanelState;
  onClose: () => void;
  subtitle: string;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const { explanation } = panel;
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
        className="flex max-h-[calc(100svh-9rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
        onInteractOutside={keepSwitcherClicks}
        onOpenAutoFocus={focusSelf}
      >
        <DialogHeader className="border-b px-6 pt-5 pb-4">
          <DialogTitle className="text-lg">{explanation.title}</DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>

        {panel.run === undefined ? (
          <>
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
              <WhatHappens panel={panel} />
              <Blockers panel={panel} />
              <section className="space-y-3">
                <SectionTitle aside={formatWords(panel.checkedWords)}>
                  Ce que Claude lira · {panel.checkedInputs.length}
                </SectionTitle>
                <PrefillNote panel={panel} />
                {(['posting', 'profile', 'annex'] as const).map((group) => (
                  <InputGroupList key={group} panel={panel} group={group} />
                ))}
                <AddInputButton onClick={() => setIsAdding(true)} />
              </section>
              <section className="space-y-3">
                <SectionTitle>Consignes</SectionTitle>
                <InstructionsEditor panel={panel} rows={8} />
                <FixedPartFold panel={panel} />
              </section>
            </div>
            <footer className="flex flex-col-reverse gap-2 border-t bg-muted/30 px-6 py-3 sm:flex-row sm:items-center">
              <p className="text-xs text-muted-foreground sm:mr-auto">
                {formatDocuments(panel.checkedInputs.length)} ·{' '}
                {panel.instructions.isCandidate || panel.instructions.isDirty
                  ? 'tes Consignes'
                  : 'Consignes par défaut'}{' '}
                · {explanation.duration}
              </p>
              <Button variant="outline" onClick={onClose}>
                Annuler
              </Button>
              <Button disabled={!panel.canLaunch} onClick={() => void panel.launch()}>
                <SparklesIcon data-icon="inline-start" />
                {panel.isLaunching ? 'Lancement…' : 'Lancer'}
              </Button>
            </footer>
          </>
        ) : (
          <div className="px-6 py-5">
            <RunProgress panel={panel} onClose={onClose} />
          </div>
        )}
        <AddInputDialog panel={panel} open={isAdding} onOpenChange={setIsAdding} />
      </DialogContent>
    </Dialog>
  );
}

// Lit / Fait / Écrit / Durée: the run in four plain lines
function WhatHappens({ panel }: { panel: GenerationPanelState }) {
  const { explanation } = panel;
  return (
    <section className="space-y-3">
      <SectionTitle>Ce qui va se passer</SectionTitle>
      <dl className="grid gap-x-4 gap-y-2.5 rounded-lg bg-muted/50 p-4 text-sm sm:grid-cols-[auto_1fr]">
        <Step icon={<BookOpenIcon />} term="Lit">
          {checkedPhrase(panel.checkedInputs.length)} ci-dessous, mot pour mot ({formatWords(panel.checkedWords)}).
        </Step>
        <Step icon={explanation.usesWeb ? <GlobeIcon /> : <SparklesIcon />} term="Fait">
          {explanation.does}
        </Step>
        <Step icon={<FilePenLineIcon />} term="Écrit">
          {explanation.writes}. {explanation.keeps}
        </Step>
        <Step icon={<ClockIcon />} term="Durée">
          {explanation.duration} environ. Tu peux fermer ce panneau : la génération continue.
        </Step>
      </dl>
    </section>
  );
}

function Step({ icon, term, children }: { icon: ReactNode; term: string; children: ReactNode }) {
  return (
    <>
      <dt className="flex items-center gap-2 font-medium [&_svg]:size-4 [&_svg]:text-muted-foreground">
        {icon}
        {term}
      </dt>
      <dd className="pl-6 text-muted-foreground sm:pl-0">{children}</dd>
    </>
  );
}

function InputGroupList({ panel, group }: { panel: GenerationPanelState; group: InputGroup }) {
  const inputList = panel.inputs.filter((input) => input.group === group);
  if (inputList.length === 0) {
    return null;
  }
  // The Annexes, often many and unchecked, fold into one line
  if (group === 'annex') {
    return (
      <div className="rounded-lg border">
        <InputBundle panel={panel} title={GROUP_LABEL.annex} hint={GROUP_HINT.annex} inputs={inputList}>
          <ul className="divide-y border-t">
            {inputList.map((input) => (
              <InputRow key={input.key} panel={panel} input={input} />
            ))}
          </ul>
        </InputBundle>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{GROUP_LABEL[group]}</p>
      <ul className="divide-y rounded-lg border">
        {itemsOf(inputList).map((item) =>
          item.kind === 'input' ? (
            <InputRow key={item.input.key} panel={panel} input={item.input} />
          ) : (
            <li key={item.key}>
              <InputBundle panel={panel} title={item.title} hint={item.hint} inputs={item.inputs}>
                <ul className="divide-y border-t bg-muted/20">
                  {item.inputs.map((input) => (
                    <InputRow key={input.key} panel={panel} input={input} />
                  ))}
                </ul>
              </InputBundle>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

function InputRow({ panel, input }: { panel: GenerationPanelState; input: IPanelInput }) {
  const [isOpen, setIsOpen] = useState(false);
  const Icon = KIND_ICON[input.kind];
  return (
    <li className={cn(!input.isChecked && 'bg-muted/20')}>
      <div className="flex items-center gap-3 px-3 py-2">
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
          size="xs"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((current) => !current)}
          data-preview-toggle={input.key}
        >
          Aperçu
          <ChevronDownIcon className={cn('transition-transform', isOpen && 'rotate-180')} data-icon="inline-end" />
        </Button>
      </div>
      {isOpen ? (
        <div className="max-h-72 overflow-y-auto border-t bg-muted/30 px-4 py-3">
          <InputContent input={input} />
        </div>
      ) : null}
    </li>
  );
}
