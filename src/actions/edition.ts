import path from 'node:path';

import { z } from 'zod/v4';

import { ARTIFACT_SCHEMA, type Artifact, type Posting, type Version } from '#/domain/index.ts';
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
): asserts version is Version {
  const { reference } = posting;
  if (artifact === 'visualization') {
    throw new Error(
      `La Visualisation ne se modifie pas à la main : elle reprend la Fiche d'entretien retenue. Corrigez celle-ci, puis relancez la Visualisation de l'Offre ${reference}.`,
    );
  }
  assertNotFrozen(posting, artifact);
  if (version?.isChosen !== true) {
    throw new Error(
      `L'Offre ${reference} n'a pas de Version retenue de ${artifact} à modifier : « jf run ${artifact} ${reference} » en produit une.`,
    );
  }
}

// A file of the Chosen Version, except a Draft, kept as the AI wrote it so that the tool learns
// from the corrections
export function assertDocumentModifiable(
  posting: Posting,
  artifact: Artifact,
  version: Version | undefined,
  fileName: string,
): asserts version is Version {
  const { reference } = posting;
  assertArtifactModifiable(posting, artifact, version);
  if (fileName === DRAFT_FILE_NAME) {
    throw new Error(
      `Le Brouillon ne se modifie jamais : il garde ce que l'IA a écrit. Corrigez la Lettre de l'Offre ${reference}.`,
    );
  }
}

// Only a ready Version can become the Chosen Version, and a Letter frozen once sent stays chosen
export function assertChoosable(
  posting: Posting,
  artifact: Artifact,
  version: Version | undefined,
  number: number,
): asserts version is Version {
  const { reference } = posting;
  assertNotFrozen(posting, artifact);
  if (version === undefined) {
    throw new Error(
      `Version inconnue : ${artifact} v${String(number)} de l'Offre ${reference}. « jf versions ${reference} ${artifact} » liste ses Versions.`,
    );
  }
  if (version.state === 'ready') {
    return;
  }
  const state = version.state === 'failed' ? 'en échec' : 'en cours';
  throw new Error(
    `La Version ${artifact} v${String(number)} de l'Offre ${reference} est ${state} : seule une Version prête peut être retenue.`,
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

export function createEditionActions({ workspace, aiSession, findCandidate, findPosting }: ActionContext) {
  return {
    // The Chosen Versions jf edit offers, those it accepts
    async listChosenVersions(rawInput: unknown): Promise<Version[]> {
      const { reference } = REFERENCE_INPUT_SCHEMA.parse(rawInput);
      const posting = await findPosting(reference);
      const versionList = await Promise.all(
        ARTIFACT_SCHEMA.options.map((artifact) => workspace.listVersions(posting, artifact)),
      );
      return versionList.flat().filter((version) =>
        isAccepted(() => {
          assertArtifactModifiable(posting, version.artifact, version);
        }),
      );
    },

    // The Draft stays read-only, so that the tool learns from the Candidate's corrections
    async openArtifact(rawInput: unknown): Promise<void> {
      const { reference, ...input } = ARTIFACT_INPUT_SCHEMA.parse(rawInput);
      const artifact = parseArtifact(input.artifact);
      const posting = await findPosting(reference);
      const version = await findChosenVersion(workspace, posting, artifact);
      assertArtifactModifiable(posting, artifact, version);
      const candidate = await findCandidate({ candidateId: posting.candidateId });
      const postingDirectory = workspace.postingDirectoryOf(posting);
      const versionPath = path.relative(postingDirectory, workspace.versionDirectoryOf(posting, version));
      aiSession.openInteractive({
        prompt: composeEditPrompt({ candidate, posting, artifact, versionPath }),
        directory: postingDirectory,
        readOnlyPathList: [path.join(postingDirectory, '**', DRAFT_FILE_NAME)],
      });
    },

    async saveDocument(rawInput: unknown): Promise<void> {
      const { reference, fileName, markdown, ...input } = DOCUMENT_INPUT_SCHEMA.parse(rawInput);
      const artifact = parseArtifact(input.artifact);
      const posting = await findPosting(reference);
      const version = await findChosenVersion(workspace, posting, artifact);
      assertDocumentModifiable(posting, artifact, version, fileName);
      // The front sends the name back: nothing else than a file of the Version may be written
      if (workspace.readVersionDocuments(posting, version).every((document) => document.fileName !== fileName)) {
        throw new Error(
          `« ${fileName} » n'est pas un fichier de la Version retenue de ${artifact} de l'Offre ${reference}.`,
        );
      }
      workspace.writeVersionDocument(posting, version, fileName, markdown);
    },

    async chooseVersion(rawInput: unknown): Promise<void> {
      const { reference, number, ...input } = VERSION_INPUT_SCHEMA.parse(rawInput);
      const artifact = parseArtifact(input.artifact);
      const posting = await findPosting(reference);
      const versionList = await workspace.listVersions(posting, artifact);
      const version = versionList.find((entry) => entry.number === number);
      assertChoosable(posting, artifact, version, number);
      await workspace.chooseVersion(posting, version);
    },
  };
}
