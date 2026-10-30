import path from 'node:path';

import { z } from 'zod/v4';

import { ARTEFACT_SCHEMA, type Artefact, type Offre, type Version } from '#/domain/index.ts';
import { composeEditPrompt } from '#/edit/prompt.ts';
import { BROUILLON_FILE_NAME } from '#/modules/lettre/index.ts';

import { ARTEFACT_INPUT_SCHEMA, REFERENCE_INPUT_SCHEMA, type ActionContext } from './context.ts';
import { assertNotFrozen, findVersionRetenue, parseArtefact } from './run-job.ts';

const VERSION_INPUT_SCHEMA = ARTEFACT_INPUT_SCHEMA.extend({ number: z.coerce.number().int() });
const DOCUMENT_INPUT_SCHEMA = ARTEFACT_INPUT_SCHEMA.extend({ fileName: z.string(), markdown: z.string() });

// Only the Version retenue is corrected by hand, in place: never a Visualisation, regenerated from
// the Fiche d'entretien, nor a Lettre frozen once sent
export function assertArtefactModifiable(
  offre: Offre,
  artefact: Artefact,
  version: Version | undefined,
): asserts version is Version {
  const { reference } = offre;
  if (artefact === 'visualisation') {
    throw new Error(
      `La Visualisation ne se modifie pas à la main : elle reprend la Fiche d'entretien retenue. Corrigez celle-ci, puis relancez la Visualisation de l'Offre ${reference}.`,
    );
  }
  assertNotFrozen(offre, artefact);
  if (version?.isRetenue !== true) {
    throw new Error(
      `L'Offre ${reference} n'a pas de Version retenue de ${artefact} à modifier : « jf run ${artefact} ${reference} » en produit une.`,
    );
  }
}

// A file of the Version retenue, except a Brouillon, kept as the AI wrote it so that the tool learns
// from the corrections
export function assertDocumentModifiable(
  offre: Offre,
  artefact: Artefact,
  version: Version | undefined,
  fileName: string,
): asserts version is Version {
  const { reference } = offre;
  assertArtefactModifiable(offre, artefact, version);
  if (fileName === BROUILLON_FILE_NAME) {
    throw new Error(
      `Le Brouillon ne se modifie jamais : il garde ce que l'IA a écrit. Corrigez la Lettre de l'Offre ${reference}.`,
    );
  }
}

// Only a ready Version can become the Version retenue, and a Lettre frozen once sent stays retenue
export function assertRetenable(
  offre: Offre,
  artefact: Artefact,
  version: Version | undefined,
  number: number,
): asserts version is Version {
  const { reference } = offre;
  assertNotFrozen(offre, artefact);
  if (version === undefined) {
    throw new Error(
      `Version inconnue : ${artefact} v${String(number)} de l'Offre ${reference}. « jf versions ${reference} ${artefact} » liste ses Versions.`,
    );
  }
  if (version.state === 'ready') {
    return;
  }
  const state = version.state === 'failed' ? 'en échec' : 'en cours';
  throw new Error(
    `La Version ${artefact} v${String(number)} de l'Offre ${reference} est ${state} : seule une Version prête peut être retenue.`,
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

export function createEditionActions({ workspace, aiSession, findCandidate, findOffre }: ActionContext) {
  return {
    // The Versions retenues jf edit offers, those it accepts
    async listVersionsRetenues(rawInput: unknown): Promise<Version[]> {
      const { reference } = REFERENCE_INPUT_SCHEMA.parse(rawInput);
      const offre = await findOffre(reference);
      const versionList = await Promise.all(
        ARTEFACT_SCHEMA.options.map((artefact) => workspace.listVersions(offre, artefact)),
      );
      return versionList.flat().filter((version) =>
        isAccepted(() => {
          assertArtefactModifiable(offre, version.artefact, version);
        }),
      );
    },

    // The Brouillon stays read-only, so that the tool learns from the Candidate's corrections
    async openArtefact(rawInput: unknown): Promise<void> {
      const { reference, ...input } = ARTEFACT_INPUT_SCHEMA.parse(rawInput);
      const artefact = parseArtefact(input.artefact);
      const offre = await findOffre(reference);
      const version = await findVersionRetenue(workspace, offre, artefact);
      assertArtefactModifiable(offre, artefact, version);
      const candidate = await findCandidate({ candidateId: offre.candidateId });
      const offreDirectory = workspace.offreDirectoryOf(offre);
      const versionPath = path.relative(offreDirectory, workspace.versionDirectoryOf(offre, version));
      aiSession.openInteractive({
        prompt: composeEditPrompt({ candidate, offre, artefact, versionPath }),
        directory: offreDirectory,
        readOnlyPathList: [path.join(offreDirectory, '**', BROUILLON_FILE_NAME)],
      });
    },

    async saveDocument(rawInput: unknown): Promise<void> {
      const { reference, fileName, markdown, ...input } = DOCUMENT_INPUT_SCHEMA.parse(rawInput);
      const artefact = parseArtefact(input.artefact);
      const offre = await findOffre(reference);
      const version = await findVersionRetenue(workspace, offre, artefact);
      assertDocumentModifiable(offre, artefact, version, fileName);
      // The front sends the name back: nothing else than a file of the Version may be written
      if (workspace.readVersionDocuments(offre, version).every((document) => document.fileName !== fileName)) {
        throw new Error(
          `« ${fileName} » n'est pas un fichier de la Version retenue de ${artefact} de l'Offre ${reference}.`,
        );
      }
      workspace.writeVersionDocument(offre, version, fileName, markdown);
    },

    async retenirVersion(rawInput: unknown): Promise<void> {
      const { reference, number, ...input } = VERSION_INPUT_SCHEMA.parse(rawInput);
      const artefact = parseArtefact(input.artefact);
      const offre = await findOffre(reference);
      const versionList = await workspace.listVersions(offre, artefact);
      const version = versionList.find((entry) => entry.number === number);
      assertRetenable(offre, artefact, version, number);
      await workspace.retenirVersion(offre, version);
    },
  };
}
