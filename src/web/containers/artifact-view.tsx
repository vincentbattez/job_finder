import { CheckIcon, FilePlusIcon, SaveIcon, XIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetcher } from 'react-router';

import type { Artifact } from '#/actions/index.ts';
import { ArtifactEditor } from '#/web/components/artifact-editor.tsx';
import { ArtifactView as ArtifactViewView, type ArtifactMode } from '#/web/components/artifact-view.tsx';
import type { IArtifactVersions, IVersionDetail } from '#/web/components/artifact.ts';
import { BringDialog, type Brought } from '#/web/components/bring-dialog.tsx';
import type { IRecipients } from '#/web/components/recipients.tsx';
import { Button } from '#/web/components/ui/button.tsx';
import type { IRefusal } from '#/web/failure.ts';

import { useGeneration } from './generation.tsx';
import { InterviewField } from './interview-field.tsx';
import { useFeedback } from './use-feedback.ts';
import { useRevalidateWhile } from './use-revalidate-while.ts';
import { useSettled } from './use-settled.ts';

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
  const fetcher = useFetcher<IRefusal>();
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

// Corrects a Version in place, Draft or Validated, its Original kept as the AI wrote it (ADR-0019): MDXEditor
// for an MDX Artifact, the Letter as plain Markdown
function VersionEditor({
  reference,
  interviewNumber,
  artifact,
  fileName,
  format,
  detail,
  onDone,
}: Readonly<
  IArtifactName & { fileName: string; format: 'mdx' | 'markdown'; detail: IVersionDetail; onDone: () => void }
>) {
  const { t } = useTranslation('posting');
  const fetcher = useFetcher<IRefusal>();
  const { number } = detail.version;
  const text = detail.text ?? '';
  const [draft, setDraft] = useState(text);
  useFeedback(fetcher, () => t('artifactView.saved', { number }));
  useSettled(fetcher, (answer) => {
    if (typeof answer?.error !== 'string') {
      onDone();
    }
  });
  return (
    <ArtifactEditor
      text={text}
      original={detail.original}
      format={format}
      number={number}
      onChange={setDraft}
      actions={
        <>
          <Button type="button" variant="ghost" size="sm" onClick={onDone}>
            <XIcon aria-hidden />
            {t('artifactView.cancel')}
          </Button>
          <fetcher.Form method="post" action={`/postings/${reference}/${artifact}/document`} preventScrollReset>
            <input type="hidden" name="number" value={number} />
            <input type="hidden" name="fileName" value={fileName} />
            <input type="hidden" name="markdown" value={draft} />
            <InterviewField interviewNumber={interviewNumber} />
            <Button type="submit" size="sm" disabled={draft === text} isPending={fetcher.state !== 'idle'}>
              <SaveIcon aria-hidden />
              {t('artifactView.save')}
            </Button>
          </fetcher.Form>
        </>
      }
    />
  );
}

// Bringing my own Version: its button and its dialog; a text lands at once, a PDF once the worker converted it,
// which the page follows meanwhile. A frozen Letter takes none (ADR-0019).
function useBring({
  reference,
  interviewNumber,
  artifact,
  isFrozen,
  isRunning,
}: Readonly<Omit<IArtifactName, 'artifact'> & { artifact: Artifact; isFrozen: boolean; isRunning: boolean }>) {
  const { t } = useTranslation('posting');
  const fetcher = useFetcher<IRefusal & { brought?: 'text' | 'pdf' }>();
  const [isOpen, setIsOpen] = useState(false);
  useFeedback(fetcher, () =>
    fetcher.data?.brought === 'pdf' ? t('artifactView.bringDialog.pdfQueued') : t('artifactView.bringDialog.added'),
  );
  useRevalidateWhile(fetcher.data?.brought === 'pdf' && isRunning);
  // The dialog closes once its Version is on its way; a refusal keeps it open with what was brought
  const answer = fetcher.data;
  useEffect(() => {
    if (fetcher.state === 'idle' && answer?.brought !== undefined) {
      setIsOpen(false);
    }
  }, [fetcher.state, answer]);
  if (isFrozen) {
    return null;
  }
  function bring(brought: Brought): void {
    const formData = new FormData();
    if (brought.kind === 'pdf') {
      formData.set('pdf', brought.file);
    } else {
      formData.set('markdown', brought.markdown);
    }
    if (interviewNumber !== null) {
      formData.set('interview', String(interviewNumber));
    }
    void fetcher.submit(formData, {
      method: 'post',
      action: `/postings/${reference}/${artifact}/bring`,
      encType: 'multipart/form-data',
      preventScrollReset: true,
    });
  }
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          setIsOpen(true);
        }}
      >
        <FilePlusIcon aria-hidden />
        {t('artifactView.bring')}
      </Button>
      <BringDialog
        artifactLabel={t(`artifactLabelByArtifact.${artifact}`, { ns: 'common' })}
        isOpen={isOpen}
        isPending={fetcher.state !== 'idle'}
        onOpenChange={setIsOpen}
        onBring={bring}
      />
    </>
  );
}

// The Artifact view of a tab: the Version read is the latest until the Candidate picks another one, and a
// new Version, generated or brought, shows itself; its Container posts the validation and the correction
export function ArtifactView({
  reference,
  title,
  interviewNumber = null,
  recipients = null,
  ...artifactVersions
}: Readonly<
  IArtifactVersions & {
    reference: string;
    title: string;
    interviewNumber?: number | null;
    recipients?: IRecipients | null;
  }
>) {
  const { artifact, versionList, fileName, format, isFrozen, state } = artifactVersions;
  const generation = useGeneration({ reference, title, interviewNumber, artifactVersions });
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
  const bring = useBring({ ...name, artifact, isFrozen, isRunning: state === 'queued' || state === 'in_progress' });
  return (
    <>
      {generation.panel}
      <ArtifactViewView
        {...artifactVersions}
        recipients={recipients}
        selectedNumber={current.number}
        mode={current.mode}
        onSelect={(number) => {
          setChoice({ number, mode: 'read', latestNumber });
        }}
        onModeChange={(mode) => {
          setChoice({ number: current.number, mode, latestNumber });
        }}
        launch={generation.launch}
        bring={bring}
        failure={generation.failure}
        validateButton={renderValidateButton}
        editor={(detail) => (
          <VersionEditor
            {...name}
            fileName={fileName}
            format={format}
            detail={detail}
            onDone={() => {
              setChoice({ number: detail.version.number, mode: 'read', latestNumber });
            }}
          />
        )}
      />
    </>
  );
}
