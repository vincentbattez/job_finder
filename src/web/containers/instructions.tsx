import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetcher } from 'react-router';

import type { Actions } from '#/actions/index.ts';
import { InstructionsEditor } from '#/web/components/instructions-editor.tsx';
import { SettingsSection } from '#/web/components/settings-section.tsx';
import type { IRefusal } from '#/web/failure.ts';

import { useFeedback } from './use-feedback.ts';
import { useSettled } from './use-settled.ts';

export type ModuleInstructions = Awaited<ReturnType<Actions['readInstructions']>>;

// The Candidate's Instructions of one type of Artifact, edited in place: the edit stays unsaved until Save
// posts it, the Candidate's Instructions action, whose later runs of the type read them (spec #125). A hook,
// so that the generation panel keeps the edit across its steps and blocks Launch while it is unsaved.
export function useInstructions(instructions: ModuleInstructions | null) {
  type Intent = 'save-instructions' | 'restore-instructions';
  const { t } = useTranslation('settings');
  const [draft, setDraft] = useState<string | null>(null);
  const fetcher = useFetcher<IRefusal>();
  const sentIntent = useRef<Intent | null>(null);
  useFeedback(fetcher, () =>
    sentIntent.current === 'restore-instructions' ? t('instructions.restored') : t('instructions.saved'),
  );
  // Once saved or restored, the editor shows the Instructions in effect again; a refusal keeps the edit
  useSettled(fetcher, (answer) => {
    if (typeof answer?.error !== 'string') {
      setDraft(null);
    }
  });

  const inEffect =
    instructions === null ? '' : (instructions.candidateInstructions ?? instructions.defaultInstructions);
  const isDirty = draft !== null && draft !== inEffect;

  function submit(intent: Intent, module: string, text = '') {
    sentIntent.current = intent;
    void fetcher.submit({ intent, module, instructions: text }, { method: 'post', action: '/settings' });
  }

  return {
    isDirty,
    discard: () => {
      setDraft(null);
    },
    editor:
      instructions === null ? null : (
        <InstructionsEditor
          artifact={instructions.module}
          text={draft ?? inEffect}
          hasCandidateInstructions={instructions.candidateInstructions !== null}
          isDirty={isDirty}
          isSaving={fetcher.state !== 'idle'}
          onChange={setDraft}
          onSave={() => {
            submit('save-instructions', instructions.module, draft ?? inEffect);
          }}
          onDiscard={() => {
            setDraft(null);
          }}
          onRestore={() => {
            submit('restore-instructions', instructions.module);
          }}
        />
      ),
  };
}

function ModuleInstructionsEditor({ instructions }: Readonly<{ instructions: ModuleInstructions }>) {
  const { t } = useTranslation('settings');
  const headingId = useId();
  const { editor } = useInstructions(instructions);
  return (
    <section aria-labelledby={headingId} className="space-y-2">
      <h3 id={headingId} className="max-w-none text-sm font-medium">
        {t(`artifactLabelByArtifact.${instructions.module}`, { ns: 'common' })}
      </h3>
      {editor}
    </section>
  );
}

// The Settings' Instructions: the Candidate's, for each type of Artifact, with the panel's editor
export function InstructionsSection({ instructionsList }: Readonly<{ instructionsList: ModuleInstructions[] }>) {
  const { t } = useTranslation('settings');
  return (
    <SettingsSection
      heading={t('instructions.heading')}
      description={t('instructions.description')}
      anchor="instructions"
    >
      {instructionsList.map((instructions) => (
        <ModuleInstructionsEditor key={instructions.module} instructions={instructions} />
      ))}
    </SettingsSection>
  );
}
