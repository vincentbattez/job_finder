import { useTranslation } from 'react-i18next';

import type { Artifact } from '#/actions/index.ts';
import { Badge } from '#/web/components/ui/badge.tsx';
import { Button } from '#/web/components/ui/button.tsx';
import { Textarea } from '#/web/components/ui/textarea.tsx';

export interface IInstructionsEditor {
  artifact: Artifact;
  // What the editor holds: the Instructions in effect, or the Candidate's unsaved edit of them
  text: string;
  // Whether the Instructions in effect are the Candidate's own rather than the default ones
  hasCandidateInstructions: boolean;
  isDirty: boolean;
  isSaving: boolean;
  onChange: (text: string) => void;
  onSave: () => void;
  onDiscard: () => void;
  onRestore: () => void;
}

// The one Instructions editor, of the generation panel and of the Settings (spec #125): edited in place,
// changed only by an explicit Save, which makes them the Candidate's for every later run of the type;
// the Fixed Part stays out of reach (ADR-0003)
export function InstructionsEditor({
  artifact,
  text,
  hasCandidateInstructions,
  isDirty,
  isSaving,
  onChange,
  onSave,
  onDiscard,
  onRestore,
}: Readonly<IInstructionsEditor>) {
  const { t } = useTranslation('settings');
  const artifactLabel = t(`artifactLabelByArtifact.${artifact}`, { ns: 'common' });
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={hasCandidateInstructions ? 'default' : 'secondary'}>
          {hasCandidateInstructions ? t('instructions.candidateBadge') : t('instructions.defaultOrigin')}
        </Badge>
        {isDirty && <span className="text-xs text-pending-foreground">{t('instructions.unsaved')}</span>}
      </div>
      <Textarea
        value={text}
        rows={12}
        aria-label={t('instructions.editorLabel', { artifactLabel })}
        className="field-sizing-fixed resize-y text-[13px] leading-relaxed md:text-[13px]"
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
      {isDirty ? (
        <div className="space-y-2 rounded-md border border-pending/40 bg-pending/10 p-3 text-xs">
          <p className="max-w-none">{t('instructions.unsavedHint', { artifactLabel })}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="xs" isPending={isSaving} onClick={onSave}>
              {t('instructions.save')}
            </Button>
            <Button size="xs" variant="ghost" disabled={isSaving} onClick={onDiscard}>
              {t('instructions.discard')}
            </Button>
          </div>
        </div>
      ) : (
        <p className="flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
          {hasCandidateInstructions
            ? t('instructions.candidateHint', { artifactLabel })
            : t('instructions.defaultHint', { artifactLabel })}
          {hasCandidateInstructions && (
            <Button size="xs" variant="link" className="h-auto px-0" isPending={isSaving} onClick={onRestore}>
              {t('instructions.restore')}
            </Button>
          )}
        </p>
      )}
    </div>
  );
}
