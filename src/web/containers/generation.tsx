import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetcher, useNavigate } from 'react-router';
import { toast } from 'sonner';

import { isPending } from '#/actions/state.ts';
import type { Generation, IArtifactVersions } from '#/web/components/artifact.ts';
import {
  AddInputButton,
  GenerateButton,
  GenerationPanel,
  RunFailure,
  type IRunView,
} from '#/web/components/generation-panel.tsx';
import type { IRefusal } from '#/web/failure.ts';

import { AddDocumentDialog } from './add-document.tsx';
import { useFeedback } from './use-feedback.ts';
import { useRevalidateWhile } from './use-revalidate-while.ts';

const RECAP_STEP = 2;

interface IGenerationOption {
  reference: string;
  // The Posting's title, which the panel names under its title
  title: string;
  interviewNumber: number | null;
  artifactVersions: IArtifactVersions;
}

// The run the panel launched, as the page reads it again: its job's state until its Version is written
function runViewOf(
  { state, versionList, failure, workerFailure }: IArtifactVersions,
  number: number,
): IRunView['state'] | null {
  const version = versionList.find((entry) => entry.version.number === number)?.version;
  if (version?.state === 'ready' || version?.state === 'failed') {
    return version.state;
  }
  if (state === 'failed' && failure !== null) {
    return 'failed';
  }
  return workerFailure === null && state === 'queued' ? 'queued' : 'in_progress';
}

// The generation of an Artifact (spec #125, « Inputs and the generation panel »): Generate opens the
// panel, which reads the Inputs as it opens and the Prompt of the checked ones at the recap; Launch
// queues the job (ADR-0003), which the panel follows, and a toast tells its Draft ready even once the
// panel is closed. A hook, so that its state outlives the button moving from the empty state to the toolbar.
export function useGeneration({ reference, title, interviewNumber, artifactVersions }: IGenerationOption) {
  const { t } = useTranslation('posting');
  const navigate = useNavigate();
  const { artifact, state, versionList, module, isFrozen } = artifactVersions;
  const artifactLabel = t(`artifactLabelByArtifact.${artifact}`, { ns: 'common' });
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [checkOverride, setCheckOverride] = useState<Record<string, boolean>>({});
  const [launchedNumber, setLaunchedNumber] = useState<number | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const inputFetcher = useFetcher<Generation>();
  const promptFetcher = useFetcher<Generation>();
  const runFetcher = useFetcher<IRefusal>();
  // Until the Inputs of this opening are read; read again afterwards, as a document added or any
  // submission revalidates the fetcher, the Inputs stay shown
  const [isReadingInputs, setIsReadingInputs] = useState(false);
  useEffect(() => {
    if (isReadingInputs && inputFetcher.state === 'idle') {
      setIsReadingInputs(false);
    }
  }, [isReadingInputs, inputFetcher.state]);
  useFeedback(runFetcher, () => t('generation.launched', { context: artifact, artifactLabel }));

  const isRegeneration = versionList.length > 0;
  const isLaunched = launchedNumber !== null && runFetcher.state === 'idle' && runFetcher.data?.error === null;
  const runState = isLaunched ? runViewOf(artifactVersions, launchedNumber) : null;
  // Until the launched Version is written: a read between the job's start and its Version's may tell the
  // previous Version's state, which alone would stop the polling
  useRevalidateWhile(isPending(state) || runState === 'queued' || runState === 'in_progress');
  const failureMessage =
    artifactVersions.failure?.log ??
    artifactVersions.workerFailure?.message ??
    artifactVersions.notificationFailure?.message ??
    null;

  function urlOf(readKeyList: string[] = []): string {
    const search = new URLSearchParams([
      ...(interviewNumber === null ? [] : [['interview', String(interviewNumber)]]),
      ...readKeyList.map((key) => ['input', key]),
    ]);
    return `/postings/${reference}/${artifact}/generation?${search.toString()}`;
  }

  // Exactly what the session receives, in Markdown (ADR-0021)
  async function copyPrompt(prompt: string) {
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success(t('generation.promptCopied'));
    } catch {
      toast.error(t('generation.copyFailed'));
    }
  }

  // The Draft, in its tab: the Artifact view shows the latest Version
  function viewDraft() {
    setIsOpen(false);
    void navigate(
      interviewNumber === null
        ? `/postings/${reference}?tab=${artifact}`
        : `/postings/${reference}?tab=interviews&interview=${String(interviewNumber)}&doc=${artifact}`,
      { preventScrollReset: true },
    );
  }

  // Told once, panel open or closed: the Draft ready, with the way to it, or the failure
  const toldState = useRef<string | null>(null);
  useEffect(() => {
    if (launchedNumber === null || (runState !== 'ready' && runState !== 'failed')) {
      return;
    }
    const told = `${String(launchedNumber)}:${runState}`;
    if (toldState.current === told) {
      return;
    }
    toldState.current = told;
    if (runState === 'failed') {
      toast.error(t('generation.draftFailed', { artifactLabel }));
      return;
    }
    toast.success(t('generation.draftReady', { artifactLabel, number: launchedNumber }), {
      action: { label: t('generation.viewDraft'), onClick: viewDraft },
    });
  });

  const launch = isFrozen ? null : (
    <GenerateButton
      isRegeneration={isRegeneration}
      refusal={module.refusal}
      onOpen={() => {
        setIsOpen(true);
        setStep(0);
        setCheckOverride({});
        setLaunchedNumber(null);
        setIsReadingInputs(true);
        void inputFetcher.load(urlOf());
      }}
    />
  );

  const panel = isOpen && (
    <GenerationPanel
      reference={reference}
      artifact={artifact}
      subtitle={
        interviewNumber === null ? title : t('generation.subtitleOfInterview', { title, number: interviewNumber })
      }
      isRegeneration={isRegeneration}
      generation={isReadingInputs ? null : (inputFetcher.data ?? null)}
      checkOverride={checkOverride}
      step={step}
      prompt={promptFetcher.state === 'idle' ? (promptFetcher.data?.prompt?.prompt ?? null) : null}
      isLaunching={runFetcher.state !== 'idle'}
      run={
        runState === null || launchedNumber === null
          ? null
          : { state: runState, number: launchedNumber, failure: failureMessage }
      }
      addInput={
        <>
          <AddInputButton
            onClick={() => {
              setIsAddOpen(true);
            }}
          />
          <AddDocumentDialog
            reference={reference}
            interviewNumber={interviewNumber}
            isAnnexAllowed={inputFetcher.data?.isReadingProfile === true}
            isFromPanel
            isOpen={isAddOpen}
            onOpenChange={setIsAddOpen}
            onAdded={(key) => {
              // Checked at once in the panel that added it (spec #125)
              setCheckOverride((current) => ({ ...current, [key]: true }));
              void inputFetcher.load(urlOf());
            }}
          />
        </>
      }
      onCheck={(keyList, isChecked) => {
        setCheckOverride((current) => ({
          ...current,
          ...Object.fromEntries(keyList.map((key) => [key, isChecked])),
        }));
      }}
      onStep={(next, readKeyList) => {
        setStep(next);
        // The recap copies the Prompt of exactly what is checked
        if (next === RECAP_STEP) {
          void promptFetcher.load(urlOf(readKeyList));
        }
      }}
      onCopy={(prompt) => {
        void copyPrompt(prompt);
      }}
      onLaunch={(readKeyList) => {
        setLaunchedNumber(inputFetcher.data?.nextNumber ?? null);
        void runFetcher.submit(
          [
            ['reference', reference],
            ['module', artifact],
            ...(interviewNumber === null ? [] : [['interview', String(interviewNumber)]]),
            ...readKeyList.map((key) => ['input', key]),
          ],
          { method: 'post', action: '/run', preventScrollReset: true },
        );
      }}
      onClose={() => {
        setIsOpen(false);
      }}
      onViewDraft={viewDraft}
    />
  );

  return { launch, panel, failure: <RunFailure message={failureMessage} /> };
}
