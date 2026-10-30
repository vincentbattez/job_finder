import path from 'node:path';

import { z } from 'zod/v4';

import {
  ARTEFACT_SCHEMA,
  OFFRE_FICHE_SCHEMA,
  VISUALISATION_SCHEMA,
  type Candidate,
  type Offre,
  type OffreFiche,
  type Recipients,
  type Version,
  type Visualisation,
} from '#/domain/index.ts';
import { LETTRE_MODULE } from '#/modules/lettre/index.ts';
import { VISUALISATION_MODULE } from '#/modules/visualisation/index.ts';
import { listNextStatuts } from '#/statut/index.ts';

import { ARTEFACT_INPUT_SCHEMA, REFERENCE_INPUT_SCHEMA, type ActionContext } from './context.ts';
import { assertArtefactModifiable, assertDocumentModifiable, assertRetenable, isAccepted } from './edition.ts';
import { describeModule, findVersionRetenue, parseArtefact } from './run-job.ts';

const VISUALISATION_INPUT_SCHEMA = REFERENCE_INPUT_SCHEMA.extend({ number: z.coerce.number().int() });

const ETAT_BY_VERSION_STATE = { running: 'en_cours', ready: 'pret', failed: 'en_echec' } as const;
const ETAT_BY_JOB_STATE = { queued: 'en_cours', running: 'en_cours', done: 'pret', failed: 'en_echec' } as const;

export function createOffreActions({ workspace, findCandidate, findOffre }: ActionContext) {
  async function findRecipients(offre: Offre): Promise<Recipients | null> {
    const version = await findVersionRetenue(workspace, offre, 'lettre');
    return version === undefined ? null : LETTRE_MODULE.readRecipients(workspace.versionDirectoryOf(offre, version));
  }

  function readFicheVersion(offre: Offre, version: Version) {
    const { artefact, number, isRetenue } = version;
    return {
      version,
      isRetenable:
        !isRetenue &&
        isAccepted(() => {
          assertRetenable(offre, artefact, version, number);
        }),
      documentList: workspace.readVersionDocuments(offre, version).map((document) => ({
        ...document,
        isModifiable: isAccepted(() => {
          assertDocumentModifiable(offre, artefact, version, document.fileName);
        }),
      })),
    };
  }

  return {
    listCandidates(): Promise<Candidate[]> {
      return workspace.listCandidates();
    },

    async listOffres(rawInput: unknown): Promise<Offre[]> {
      const candidate = await findCandidate(rawInput);
      return workspace.listOffres(candidate.id);
    },

    async readOffre(rawInput: unknown): Promise<OffreFiche> {
      const { reference } = REFERENCE_INPUT_SCHEMA.parse(rawInput);
      const offre = await findOffre(reference);
      const jobList = await workspace.listJobs(offre);
      const extractionJob = jobList.findLast(({ module }) => module === 'extraction');
      const artefactList = await Promise.all(
        ARTEFACT_SCHEMA.options.map(async (artefact) => {
          const versionList = await workspace.listVersions(offre, artefact);
          const versionRetenue = await findVersionRetenue(workspace, offre, artefact);
          // A queued job has no Version yet, while the worker runs another one (ADR-0003), and a
          // claimed job has none until the worker starts it: both are already en cours
          const isPending = jobList.some(
            ({ module, state }) => module === artefact && (state === 'queued' || state === 'running'),
          );
          const state = isPending ? 'running' : versionList.at(-1)?.state;
          return {
            artefact,
            etat: state === undefined ? 'absent' : ETAT_BY_VERSION_STATE[state],
            module: await describeModule(workspace, offre, artefact),
            isEditable: isAccepted(() => {
              assertArtefactModifiable(offre, artefact, versionRetenue);
            }),
            versionList: versionList.map((version) => readFicheVersion(offre, version)),
          };
        }),
      );
      return OFFRE_FICHE_SCHEMA.parse({
        offre,
        nextStatutList: listNextStatuts(offre),
        ficheDePoste: workspace.readFicheDePoste(offre),
        artefactList,
        recipients: await findRecipients(offre),
        extraction:
          extractionJob === undefined ? null : { etat: ETAT_BY_JOB_STATE[extractionJob.state], log: extractionJob.log },
      });
    },

    async listVersions(rawInput: unknown): Promise<Version[]> {
      const { reference, artefact } = ARTEFACT_INPUT_SCHEMA.parse(rawInput);
      return workspace.listVersions(await findOffre(reference), parseArtefact(artefact));
    },

    async readVisualisation(rawInput: unknown): Promise<Visualisation> {
      const { reference, number } = VISUALISATION_INPUT_SCHEMA.parse(rawInput);
      const offre = await findOffre(reference);
      const versionList = await workspace.listVersions(offre, 'visualisation');
      const version = versionList.find((entry) => entry.number === number);
      if (version === undefined) {
        throw new Error(
          `Version inconnue : visualisation v${String(number)} de l'Offre ${reference}. « jf versions ${reference} visualisation » liste ses Versions.`,
        );
      }
      const html = workspace.readTextFile(
        path.join(workspace.versionDirectoryOf(offre, version), VISUALISATION_MODULE.fileName),
      );
      if (html === null) {
        throw new Error(
          `La Visualisation v${String(number)} de l'Offre ${reference} n'a pas de page : relancez la Visualisation.`,
        );
      }
      return VISUALISATION_SCHEMA.parse({ html });
    },

    async readRecipients(rawInput: unknown): Promise<Recipients> {
      const { reference } = REFERENCE_INPUT_SCHEMA.parse(rawInput);
      const recipients = await findRecipients(await findOffre(reference));
      if (recipients === null) {
        throw new Error(`L'Offre ${reference} n'a pas de Lettre retenue. La produire : jf run lettre ${reference}.`);
      }
      return recipients;
    },
  };
}
