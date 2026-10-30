import path from 'node:path';

import { z } from 'zod/v4';

import { tFor } from '#/domain/catalogue/i18n.ts';
import { ARTIFACT_SCHEMA, type Artifact, type Locale, type Posting, type Version } from '#/domain/index.ts';
import { composeEditPrompt } from '#/edit/prompt.ts';
import { DRAFT_FILE_NAME } from '#/modules/letter/index.ts';

import { ARTIFACT_INPUT_SCHEMA, REFERENCE_INPUT_SCHEMA, type ActionContext } from './context.ts';
import { assertNotFrozen, findChosenVersion, parseArtifact } from './run-job.ts';

const VERSION_INPUT_SCHEMA = ARTIFACT_INPUT_SCHEMA.extend({ number: z.coerce.number().int() });
const DOCUMENT_INPUT_SCHEMA = ARTIFACT_INPUT_SCHEMA.extend({ fileName: z.string(), markdown: z.string() });

// Only the Chosen Version is corrected by hand, in place: never a Visualization, regenerated from
// the Interview Brief, nor a Letter frozen once sent
export function assertArtifactModifiable(
  posting: Posting,
  artifact: Artifact,
  version: Version | undefined,
  locale: Locale,
): asserts version is Version {
  const { reference } = posting;
  const t = tFor(locale, 'error');
  if (artifact === 'visualization') {
    throw new Error(t('visualizationNotEditable', { reference }));
  }
  assertNotFrozen(posting, artifact, locale);
  if (version?.isChosen !== true) {
    throw new Error(t('noChosenVersionToEdit', { reference, artifact }));
  }
}

// A file of the Chosen Version, except a Draft, kept as the AI wrote it so that the tool learns
// from the corrections
export function assertDocumentModifiable(
  posting: Posting,
  artifact: Artifact,
  version: Version | undefined,
  fileName: string,
  locale: Locale,
): asserts version is Version {
  assertArtifactModifiable(posting, artifact, version, locale);
  if (fileName === DRAFT_FILE_NAME) {
    throw new Error(tFor(locale, 'error')('draftNotEditable', { reference: posting.reference }));
  }
}

// Only a ready Version can become the Chosen Version, and a Letter frozen once sent stays chosen
export function assertChoosable(
  posting: Posting,
  artifact: Artifact,
  version: Version | undefined,
  number: number,
  locale: Locale,
): asserts version is Version {
  const { reference } = posting;
  const t = tFor(locale, 'error');
  assertNotFrozen(posting, artifact, locale);
  if (version === undefined) {
    throw new Error(t('unknownVersion', { reference, artifact, number }));
  }
  if (version.state === 'ready') {
    return;
  }
  throw new Error(t(version.state === 'failed' ? 'versionFailed' : 'versionRunning', { reference, artifact, number }));
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
  return {
    // The Chosen Versions jf edit offers, those it accepts
    async listChosenVersions(rawInput: unknown): Promise<Version[]> {
      const { reference } = REFERENCE_INPUT_SCHEMA.parse(rawInput);
      const posting = await findPosting(reference);
      const locale = await findLocale(posting.candidateId);
      const versionList = await Promise.all(
        ARTIFACT_SCHEMA.options.map((artifact) => workspace.listVersions(posting, artifact)),
      );
      return versionList.flat().filter((version) =>
        isAccepted(() => {
          assertArtifactModifiable(posting, version.artifact, version, locale);
        }),
      );
    },

    // The Draft stays read-only, so that the tool learns from the Candidate's corrections
    async openArtifact(rawInput: unknown): Promise<void> {
      const { reference, ...input } = ARTIFACT_INPUT_SCHEMA.parse(rawInput);
      const posting = await findPosting(reference);
      const candidate = await findCandidate({ candidateId: posting.candidateId });
      const artifact = parseArtifact(input.artifact, candidate.locale);
      const version = await findChosenVersion(workspace, posting, artifact);
      assertArtifactModifiable(posting, artifact, version, candidate.locale);
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
      const { reference, fileName, markdown, ...input } = DOCUMENT_INPUT_SCHEMA.parse(rawInput);
      const posting = await findPosting(reference);
      const locale = await findLocale(posting.candidateId);
      const artifact = parseArtifact(input.artifact, locale);
      const version = await findChosenVersion(workspace, posting, artifact);
      assertDocumentModifiable(posting, artifact, version, fileName, locale);
      // The front sends the name back: nothing else than a file of the Version may be written
      if (workspace.readVersionDocuments(posting, version).every((document) => document.fileName !== fileName)) {
        throw new Error(tFor(locale, 'error')('notAVersionFile', { fileName, artifact, reference }));
      }
      workspace.writeVersionDocument(posting, version, fileName, markdown);
    },

    async chooseVersion(rawInput: unknown): Promise<void> {
      const { reference, number, ...input } = VERSION_INPUT_SCHEMA.parse(rawInput);
      const posting = await findPosting(reference);
      const locale = await findLocale(posting.candidateId);
      const artifact = parseArtifact(input.artifact, locale);
      const versionList = await workspace.listVersions(posting, artifact);
      const version = versionList.find((entry) => entry.number === number);
      assertChoosable(posting, artifact, version, number, locale);
      await workspace.chooseVersion(posting, version);
    },
  };
}
