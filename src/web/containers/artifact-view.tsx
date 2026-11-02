import { CheckIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetcher } from 'react-router';

import { ArtifactPrompt } from '#/web/components/artifact-prompt.tsx';
import { ArtifactView as ArtifactViewView, type ArtifactMode } from '#/web/components/artifact-view.tsx';
import type { IArtifactVersions, IVersionDetail } from '#/web/components/artifact.ts';
import { Button } from '#/web/components/ui/button.tsx';
import { Textarea } from '#/web/components/ui/textarea.tsx';
import type { IRefusal } from '#/web/failure.ts';

import { InterviewField } from './interview-field.tsx';
import { ModuleLaunch } from './module-launch.tsx';
import { useFeedback } from './use-feedback.ts';

interface IArtifactName {
  reference: string;
  interviewNumber: number | null;
  artifact: string;
}

// Validates a Draft, which becomes the Chosen Version (ADR-0019), or chooses an older Validated one again.
// The fetcher lives with the Artifact, not with its button: the banner that holds the button goes with the
// validation, while its toast must still tell it.
export function useValidation({ reference, interviewNumber, artifact }: IArtifactName) {
  const { t } = useTranslation('posting');
  const fetcher = useFetcher<IRefusal | null>();
  const submitted = useRef({ number: 0 });
  useFeedback(fetcher, () => t('artifactView.validated', { number: submitted.current.number }));
  const isPending = fetcher.state !== 'idle';
  return function renderValidateButton(number: number, kind: 'validate' | 'chooseAgain') {
    return (
      <fetcher.Form
        method="post"
        action={`/postings/${reference}/${artifact}/validate`}
        preventScrollReset
        onSubmit={() => {
          submitted.current.number = number;
        }}
      >
        <input type="hidden" name="number" value={number} />
        <InterviewField interviewNumber={interviewNumber} />
        {kind === 'validate' ? (
          <Button type="submit" className="shrink-0" isPending={isPending}>
            <CheckIcon />
            {t('artifactView.validate', { number })}
          </Button>
        ) : (
          <Button type="submit" variant="link" size="sm" className="h-auto p-0" isPending={isPending}>
            {t('artifactView.chooseAgain')}
          </Button>
        )}
      </fetcher.Form>
    );
  };
}

// Corrects a Version in place, Draft or Validated, its Original kept as the AI wrote it (ADR-0019); the
// MDX editor of the toolbar ticket replaces this plain text field
function VersionEditor({
  reference,
  interviewNumber,
  artifact,
  fileName,
  detail,
  onDone,
}: Readonly<IArtifactName & { fileName: string; detail: IVersionDetail; onDone: () => void }>) {
  const { t } = useTranslation('posting');
  const fetcher = useFetcher<IRefusal | null>();
  const { number } = detail.version;
  useFeedback(fetcher, () => t('artifactView.saved', { number }));
  const submission = useRef({ isSent: false });
  useEffect(() => {
    if (fetcher.state !== 'idle') {
      submission.current.isSent = true;
      return;
    }
    if (submission.current.isSent && fetcher.data == null) {
      onDone();
    }
    submission.current.isSent = false;
  }, [fetcher.state, fetcher.data, onDone]);
  return (
    <fetcher.Form
      method="post"
      action={`/postings/${reference}/${artifact}/document`}
      preventScrollReset
      className="mx-auto max-w-[72ch] space-y-3"
    >
      <input type="hidden" name="number" value={number} />
      <input type="hidden" name="fileName" value={fileName} />
      <InterviewField interviewNumber={interviewNumber} />
      <Textarea
        name="markdown"
        aria-label={t('artifactView.textLabel', { number })}
        defaultValue={detail.text ?? ''}
        className="min-h-96 font-mono text-sm"
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          {t('artifactView.cancel')}
        </Button>
        <Button type="submit" isPending={fetcher.state !== 'idle'}>
          {t('artifactView.save')}
        </Button>
      </div>
    </fetcher.Form>
  );
}

// The Artifact view of a tab: the Version read is the latest until the Candidate picks another one, and a
// new Version, generated or brought, shows itself; its Container posts the validation and the correction
export function ArtifactView({
  reference,
  interviewNumber = null,
  ...artifactVersions
}: Readonly<IArtifactVersions & { reference: string; interviewNumber?: number | null }>) {
  const { artifact, versionList, fileName, module } = artifactVersions;
  const latestNumber = versionList.at(-1)?.version.number ?? null;
  // A choice holds only while the latest Version is the one it was made beside
  const [choice, setChoice] = useState<{ number: number; mode: ArtifactMode; latestNumber: number | null }>({
    number: latestNumber ?? 0,
    mode: 'read',
    latestNumber,
  });
  const current = choice.latestNumber === latestNumber ? choice : { number: latestNumber ?? 0, mode: 'read' as const };
  const name = { reference, interviewNumber, artifact };
  const renderValidateButton = useValidation(name);
  return (
    <ArtifactViewView
      {...artifactVersions}
      selectedNumber={current.number}
      mode={current.mode}
      onSelect={(number) => {
        setChoice({ number, mode: 'read', latestNumber });
      }}
      onModeChange={(mode) => {
        setChoice({ number: current.number, mode, latestNumber });
      }}
      launch={
        <div className="space-y-2">
          <ModuleLaunch
            reference={reference}
            interviewNumber={interviewNumber}
            artifact={artifact}
            state={artifactVersions.state}
            failure={artifactVersions.failure}
            notificationFailure={artifactVersions.notificationFailure}
            module={module}
            workerFailure={artifactVersions.workerFailure}
          />
          {module.prompt !== null && (
            <ArtifactPrompt prompt={module.prompt} isUnderInterview={interviewNumber !== null} />
          )}
        </div>
      }
      validateButton={renderValidateButton}
      editor={(detail) => (
        <VersionEditor
          {...name}
          fileName={fileName}
          detail={detail}
          onDone={() => {
            setChoice({ number: detail.version.number, mode: 'read', latestNumber });
          }}
        />
      )}
    />
  );
}
