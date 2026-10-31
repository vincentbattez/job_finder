import path from 'node:path';

import { z } from 'zod/v4';

import { codedError } from '#/domain/coded-error.ts';
import type { Artifact, Locale, Version } from '#/domain/index.ts';
import { composeEditPrompt } from '#/edit/prompt.ts';
import { DRAFT_FILE_NAME } from '#/modules/letter/index.ts';

import { ARTIFACT_INPUT_SCHEMA, REFERENCE_INPUT_SCHEMA, type ActionContext } from './context.ts';
import {
  assertNotFrozen,
  commandOf,
  findChosenVersion,
  findTarget,
  listTargetArtifacts,
  parseArtifact,
  type ITarget,
} from './run-job.ts';

const VERSION_INPUT_SCHEMA = ARTIFACT_INPUT_SCHEMA.extend({ number: z.coerce.number().int() });
const DOCUMENT_INPUT_SCHEMA = ARTIFACT_INPUT_SCHEMA.extend({ fileName: z.string(), markdown: z.string() });

// Only the Chosen Version is corrected by hand, in place: never a Visualization, regenerated from
// the Interview Brief, nor a Letter frozen once sent
export function assertArtifactModifiable(
  { posting, interview }: ITarget,
  artifact: Artifact,
  version: Version | undefined,
  locale: Locale,
): asserts version is Version {
  const { reference } = posting;
  if (artifact === 'visualization') {
    throw codedError('visualization_not_editable', { reference }, { locale });
  }
  assertNotFrozen(posting, artifact, locale);
  if (version?.isChosen === true) {
    return;
  }
  const command = commandOf(['run', artifact, reference], interview);
  throw codedError('no_chosen_version_to_edit', { reference, artifact, command }, { locale });
}

// A file of the Chosen Version, except a Draft, kept as the AI wrote it so that the tool learns
// from the corrections
export function assertDocumentModifiable(
  target: ITarget,
  artifact: Artifact,
  version: Version | undefined,
  fileName: string,
  locale: Locale,
): asserts version is Version {
  assertArtifactModifiable(target, artifact, version, locale);
  if (fileName === DRAFT_FILE_NAME) {
    throw codedError('draft_not_editable', { reference: target.posting.reference }, { locale });
  }
}

// Only a ready Version can become the Chosen Version, and a Letter frozen once sent stays chosen
export function assertChoosable(
  { posting, interview }: ITarget,
  artifact: Artifact,
  version: Version | undefined,
  number: number,
  locale: Locale,
): asserts version is Version {
  const { reference } = posting;
  assertNotFrozen(posting, artifact, locale);
  if (version === undefined) {
    const command = commandOf(['versions', reference, artifact], interview);
    throw codedError('unknown_version', { reference, artifact, number, command }, { locale });
  }
  if (version.state === 'ready') {
    return;
  }
  throw codedError(
    version.state === 'failed' ? 'version_failed' : 'version_running',
    { reference, artifact, number },
    { locale },
  );
}

// The front shows a control only where its action accepts it: the same check, read as a flag
export function isAccepted(check: () => void): boolean {
  try {
    check();
    return true;
  } catch {
    return false;
  }
}

export function createEditionActions({ workspace, aiSession, findCandidate, findPosting, findLocale }: ActionContext) {
  // The Chosen Version of an Artifact of the target, when jf edit accepts it
  async function findEditableVersion(target: ITarget, artifact: Artifact, locale: Locale): Promise<Version[]> {
    const version = await findChosenVersion(workspace, target, artifact);
    const isEditable = isAccepted(() => {
      assertArtifactModifiable(target, artifact, version, locale);
    });
    return isEditable && version !== undefined ? [version] : [];
  }

  return {
    // The Chosen Versions jf edit offers, those it accepts: of the Posting, then of each Interview
    async listChosenVersions(rawInput: unknown): Promise<Version[]> {
      const { reference } = REFERENCE_INPUT_SCHEMA.parse(rawInput);
      const posting = await findPosting(reference);
      const locale = await findLocale(posting.candidateId);
      const interviewList = await workspace.listInterviews(posting);
      const targetList: ITarget[] = [
        { posting, interview: null },
        ...interviewList.map((interview) => ({ posting, interview })),
      ];
      const versionList = await Promise.all(
        targetList.flatMap((target) =>
          listTargetArtifacts(target).map((artifact) => findEditableVersion(target, artifact, locale)),
        ),
      );
      return versionList.flat();
    },

    // The Draft stays read-only, so that the tool learns from the Candidate's corrections
    async openArtifact(rawInput: unknown): Promise<void> {
      const { reference, interview, ...input } = ARTIFACT_INPUT_SCHEMA.parse(rawInput);
      const posting = await findPosting(reference);
      const candidate = await findCandidate({ candidateId: posting.candidateId });
      const artifact = parseArtifact(input.artifact, candidate.locale);
      const target = await findTarget(workspace, posting, artifact, interview, candidate.locale);
      const version = await findChosenVersion(workspace, target, artifact);
      assertArtifactModifiable(target, artifact, version, candidate.locale);
      const postingDirectory = workspace.postingDirectoryOf(posting);
      const versionPath = path.relative(postingDirectory, workspace.versionDirectoryOf(posting, version));
      aiSession.openInteractive({
        prompt: composeEditPrompt({ candidate, posting, artifact, versionPath }),
        directory: postingDirectory,
        readOnlyPathList: [path.join(postingDirectory, '**', DRAFT_FILE_NAME)],
        locale: candidate.locale,
      });
    },

    async saveDocument(rawInput: unknown): Promise<void> {
      const { reference, interview, fileName, markdown, ...input } = DOCUMENT_INPUT_SCHEMA.parse(rawInput);
      const posting = await findPosting(reference);
      const locale = await findLocale(posting.candidateId);
      const artifact = parseArtifact(input.artifact, locale);
      const target = await findTarget(workspace, posting, artifact, interview, locale);
      const version = await findChosenVersion(workspace, target, artifact);
      assertDocumentModifiable(target, artifact, version, fileName, locale);
      // The front sends the name back: nothing else than a file of the Version may be written
      if (workspace.readVersionDocuments(posting, version).every((document) => document.fileName !== fileName)) {
        throw codedError('not_a_version_file', { fileName, artifact, reference }, { locale });
      }
      workspace.writeVersionDocument(posting, version, fileName, markdown);
    },

    async chooseVersion(rawInput: unknown): Promise<void> {
      const { reference, interview, number, ...input } = VERSION_INPUT_SCHEMA.parse(rawInput);
      const posting = await findPosting(reference);
      const locale = await findLocale(posting.candidateId);
      const artifact = parseArtifact(input.artifact, locale);
      const target = await findTarget(workspace, posting, artifact, interview, locale);
      const versionList = await workspace.listVersions(posting, artifact, target.interview);
      const version = versionList.find((entry) => entry.number === number);
      assertChoosable(target, artifact, version, number, locale);
      await workspace.chooseVersion(version);
    },
  };
}
