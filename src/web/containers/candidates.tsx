import { PencilIcon, UserPlusIcon } from 'lucide-react';
import { useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetcher } from 'react-router';

import type { Actions } from '#/actions/index.ts';
import { SettingsSection } from '#/web/components/settings-section.tsx';
import { Alert, AlertDescription } from '#/web/components/ui/alert.tsx';
import { Button } from '#/web/components/ui/button.tsx';
import { Input } from '#/web/components/ui/input.tsx';
import { Label } from '#/web/components/ui/label.tsx';
import { Separator } from '#/web/components/ui/separator.tsx';
import type { IRefusal } from '#/web/failure.ts';

import { useFeedback } from './use-feedback.ts';
import { useSettled } from './use-settled.ts';

type Candidate = Awaited<ReturnType<Actions['listCandidates']>>[number];

// A Candidate, renamed in place; their identifier, which names their folder, never changes
function CandidateRename({ candidate: { id, name } }: Readonly<{ candidate: Candidate }>) {
  const { t } = useTranslation('settings');
  const fieldId = useId();
  const fetcher = useFetcher<IRefusal>();
  useFeedback(fetcher, () => t('candidates.renamed'));
  return (
    <fetcher.Form
      method="post"
      action="/settings"
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 sm:grid-cols-[10rem_minmax(0,1fr)_auto]"
    >
      <input type="hidden" name="intent" value="rename" />
      <input type="hidden" name="candidateId" value={id} />
      <Label htmlFor={fieldId} className="col-span-2 truncate font-mono text-xs text-muted-foreground sm:col-span-1">
        <span className="sr-only">{t('candidates.nameOf', { candidateId: id })}</span>
        <span aria-hidden>{id}</span>
      </Label>
      {/* Remounted once renamed, so the field shows the name saved */}
      <Input key={name} id={fieldId} name="name" required defaultValue={name} />
      <Button
        type="submit"
        variant="outline"
        aria-label={t('candidates.renameOf', { candidateId: id })}
        isPending={fetcher.state !== 'idle'}
      >
        <PencilIcon />
        {t('candidates.rename')}
      </Button>
    </fetcher.Form>
  );
}

// A new Candidate: their name, and the identifier that names their folder and their jf commands
function CandidateCreation() {
  const { t } = useTranslation('settings');
  const nameId = useId();
  const identifierId = useId();
  const hintId = useId();
  const formReference = useRef<HTMLFormElement>(null);
  const fetcher = useFetcher<IRefusal>();
  useFeedback(fetcher, () => t('candidates.created'));
  // Once the Candidate is created, the form starts blank again; a refusal keeps what was typed
  useSettled(fetcher, (answer) => {
    if (typeof answer?.error !== 'string') {
      formReference.current?.reset();
    }
  });
  return (
    <fetcher.Form ref={formReference} method="post" action="/settings" className="grid gap-4">
      <input type="hidden" name="intent" value="create" />
      <h3 className="max-w-none text-sm font-semibold">{t('candidates.creationHeading')}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid content-start gap-2">
          <Label htmlFor={nameId}>{t('candidates.name')}</Label>
          <Input id={nameId} name="name" required placeholder={t('candidates.namePlaceholder')} />
        </div>
        <div className="grid content-start gap-2">
          <Label htmlFor={identifierId}>{t('candidates.id')}</Label>
          <Input
            id={identifierId}
            name="id"
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            placeholder={t('candidates.idPlaceholder')}
            aria-describedby={hintId}
            className="font-mono"
          />
          <p id={hintId} className="text-xs text-muted-foreground">
            {t('candidates.idHint')}
          </p>
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" isPending={fetcher.state !== 'idle'}>
          <UserPlusIcon />
          {t('candidates.create')}
        </Button>
      </div>
    </fetcher.Form>
  );
}

// The Candidates, for the operator: any visitor of the front creates or renames one; none is ever
// deleted (ADR-0011). The obsolete file the import left behind is pointed out until it is deleted.
export function Candidates({
  candidateList,
  obsoleteConfigPath,
}: Readonly<{ candidateList: Candidate[]; obsoleteConfigPath: string | null }>) {
  const { t } = useTranslation('settings');
  return (
    <SettingsSection heading={t('candidates.heading')} description={t('candidates.intro')} anchor="candidates">
      {obsoleteConfigPath !== null && (
        <Alert role="note">
          <AlertDescription>{t('candidates.obsoleteConfig', { path: obsoleteConfigPath })}</AlertDescription>
        </Alert>
      )}
      {candidateList.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('candidates.noCandidate')}</p>
      ) : (
        <div className="grid gap-3">
          {candidateList.map((candidate) => (
            <CandidateRename key={candidate.id} candidate={candidate} />
          ))}
        </div>
      )}
      <Separator />
      <CandidateCreation />
    </SettingsSection>
  );
}
