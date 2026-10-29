import path from 'node:path';

import { z } from 'zod/v4';

import { CLAUDE_CODE, type IAiSession } from '#/ai-session/acl/claude-code.ts';
import {
  ARTEFACT_SCHEMA,
  DETECTION_SCHEMA,
  type Candidat,
  type Detection,
  type DomainValue,
  type ModuleRun,
  type Offre,
  type Recipients,
  type Version,
} from '#/domain/index.ts';
import { BROUILLON_FILE_NAME, composeEditPrompt } from '#/edit/prompt.ts';
import { LETTRE_MODULE } from '#/modules/lettre/index.ts';
import { createPepSource } from '#/modules/source-pep/index.ts';
import { composeProfilPrompt } from '#/profil/prompt.ts';
import { assertLettreModifiable } from '#/statut/index.ts';
import { openWorkspace } from '#/workspace/index.ts';

import { createJobRunner, findInputs, parseModule } from './run-job.ts';

export type Actions = Awaited<ReturnType<typeof createActions>>;

const CANDIDAT_INPUT_SCHEMA = z.object({ candidatId: z.string() });
const MODULE_INPUT_SCHEMA = z.object({ module: z.string(), reference: z.string() });
const REFERENCE_INPUT_SCHEMA = z.object({ reference: z.string() });
const ARTEFACT_INPUT_SCHEMA = z.object({ reference: z.string(), artefact: ARTEFACT_SCHEMA });
const VERSION_INPUT_SCHEMA = ARTEFACT_INPUT_SCHEMA.extend({ number: z.coerce.number().int() });

const STATUS_INPUT_SCHEMA = z.object({ reference: z.string(), status: z.enum(['postulee', 'archivee']) });

// The single entry point of every feature: the CLI and the front only call these actions,
// so no business rule lives in either of them (ADR-0003). `satisfies` holds them to the
// anti-corruption layer (ADR-0005): the input is whatever a user typed, so each action takes it
// as unknown and parses it with Zod, and the output is nothing or domain values, so no raw data
// reaches the CLI or the front. The tests pass a fake aiSession and a fake fetch for the HTTP of
// the Sources, since Claude and the sites are external boundaries.
export async function createActions({
  dataDirectory,
  aiSession = CLAUDE_CODE,
  fetch,
}: {
  dataDirectory: string;
  aiSession?: IAiSession;
  fetch?: typeof globalThis.fetch;
}) {
  const workspace = await openWorkspace(dataDirectory);
  const pepSource = createPepSource(fetch);
  const runJob = createJobRunner(workspace, aiSession);

  async function findCandidat(rawInput: unknown): Promise<Candidat> {
    const { candidatId } = CANDIDAT_INPUT_SCHEMA.parse(rawInput);
    const candidatList = await workspace.listCandidats();
    const candidat = candidatList.find(({ id }) => id === candidatId);
    if (candidat === undefined) {
      throw new Error(`Candidat inconnu : ${candidatId}. « jf candidats » liste les Candidats.`);
    }
    return candidat;
  }

  async function findOffre(reference: string): Promise<Offre> {
    const [offre, ...otherOffreList] = await workspace.findOffres(reference);
    if (offre === undefined) {
      throw new Error(`Offre inconnue : ${reference}. « jf list <candidat> » liste les Offres.`);
    }
    // Two Candidats may follow the same Source: a reference alone then names several Offres
    if (otherOffreList.length > 0) {
      throw new Error(`Plusieurs Offres ont la référence ${reference}, chez des Candidats différents.`);
    }
    return offre;
  }

  return {
    listCandidats(): Promise<Candidat[]> {
      return workspace.listCandidats();
    },

    // Reads the Source of each Veille and records the Offres never seen before, with their Fiche
    // de poste. An Offre is known by its reference, never by its publication date, which the site
    // changes (ADR-0001). The first launch imports the Offres already online.
    async detect(): Promise<Detection[]> {
      const veilleList = await workspace.listVeilles();
      const detectionList: Detection[] = [];
      for (const veille of veilleList) {
        const { candidatId, source } = veille;
        const knownReferenceList = await workspace.listReferences(candidatId, source);
        const { matchingList, nearMissList } = await pepSource.search(veille.criteria);
        const newOffreList: Offre[] = [];
        for (const listedOffre of matchingList) {
          if (knownReferenceList.includes(listedOffre.reference)) {
            continue;
          }
          const { fiche, isInZone } = await pepSource.readFiche(listedOffre.reference, veille.zone);
          newOffreList.push(await workspace.saveOffre({ candidatId, source, listedOffre, fiche, isInZone }));
        }
        detectionList.push(
          DETECTION_SCHEMA.parse({
            veilleId: veille.id,
            candidatId,
            isFirstLaunch: knownReferenceList.length === 0,
            newOffreList,
            nearMissList,
          }),
        );
      }
      return detectionList;
    },

    async listOffres(rawInput: unknown): Promise<Offre[]> {
      const candidat = await findCandidat(rawInput);
      return workspace.listOffres(candidat.id);
    },

    async changeStatus(rawInput: unknown): Promise<void> {
      const { reference, status } = STATUS_INPUT_SCHEMA.parse(rawInput);
      const offre = await findOffre(reference);
      // Leaving Postulée would unfreeze the Lettre retenue, the one that was sent (spec « Versions »)
      if (status !== 'postulee' && offre.status === 'postulee') {
        throw new Error(`L'Offre ${reference} est Postulée et le reste : sa Lettre retenue est celle envoyée.`);
      }
      await workspace.setStatus(reference, status);
    },

    async openProfil(rawInput: unknown): Promise<void> {
      const candidat = await findCandidat(rawInput);
      aiSession.openInteractive({
        prompt: composeProfilPrompt(candidat),
        directory: workspace.profilDirectoryOf(candidat.id),
      });
    },

    // What jf edit offers to edit: the Version retenue of each Artefact of an Offre
    async listVersionsRetenues(rawInput: unknown): Promise<Version[]> {
      const { reference } = REFERENCE_INPUT_SCHEMA.parse(rawInput);
      const offre = await findOffre(reference);
      const versionList = await Promise.all(
        ARTEFACT_SCHEMA.options.map((artefact) => workspace.listVersions(offre, artefact)),
      );
      return versionList.flat().filter(({ isRetenue }) => isRetenue);
    },

    // jf edit: a Claude Code session where the Candidat corrects the Version retenue in place,
    // without creating a new Version nor ever touching a Brouillon (spec « Versions »)
    async openArtefact(rawInput: unknown): Promise<void> {
      const { reference, artefact } = ARTEFACT_INPUT_SCHEMA.parse(rawInput);
      const offre = await findOffre(reference);
      if (artefact === 'lettre') {
        assertLettreModifiable(offre);
      }
      const versionList = await workspace.listVersions(offre, artefact);
      const version = versionList.find(({ isRetenue }) => isRetenue);
      if (version === undefined) {
        throw new Error(
          `L'Offre ${reference} n'a pas de Version retenue de ${artefact} à modifier : « jf run ${artefact} ${reference} » en produit une.`,
        );
      }
      const candidat = await findCandidat({ candidatId: offre.candidatId });
      const offreDirectory = workspace.offreDirectoryOf(offre);
      const versionPath = path.relative(offreDirectory, workspace.versionDirectoryOf(offre, version));
      aiSession.openInteractive({
        prompt: composeEditPrompt({ candidat, offre, artefact, versionPath }),
        directory: offreDirectory,
        readOnlyPathList: [path.join(offreDirectory, '**', BROUILLON_FILE_NAME)],
      });
    },

    // Runs a module on an Offre, which creates a new Version of its Artefact. In L1 the job runs
    // right away, through the same function the worker will call (ADR-0003).
    async runModule(rawInput: unknown): Promise<ModuleRun> {
      const { module, reference } = MODULE_INPUT_SCHEMA.parse(rawInput);
      const artefact = parseModule(module);
      const offre = await findOffre(reference);
      await findInputs(workspace, offre, artefact);
      return runJob(await workspace.createJob(offre, artefact));
    },

    async listVersions(rawInput: unknown): Promise<Version[]> {
      const { reference, artefact } = ARTEFACT_INPUT_SCHEMA.parse(rawInput);
      return workspace.listVersions(await findOffre(reference), artefact);
    },

    // To whom the Lettre retenue recommends sending the application, and why
    async readRecipients(rawInput: unknown): Promise<Recipients> {
      const { reference } = REFERENCE_INPUT_SCHEMA.parse(rawInput);
      const offre = await findOffre(reference);
      const versionList = await workspace.listVersions(offre, 'lettre');
      const version = versionList.find(({ isRetenue }) => isRetenue);
      if (version === undefined) {
        throw new Error(`L'Offre ${reference} n'a pas de Lettre retenue. La produire : jf run lettre ${reference}.`);
      }
      return LETTRE_MODULE.readRecipients(workspace.versionDirectoryOf(offre, version));
    },

    async retenirVersion(rawInput: unknown): Promise<void> {
      const { reference, artefact, number } = VERSION_INPUT_SCHEMA.parse(rawInput);
      const offre = await findOffre(reference);
      if (artefact === 'lettre') {
        assertLettreModifiable(offre);
      }
      const versionList = await workspace.listVersions(offre, artefact);
      const version = versionList.find((candidate) => candidate.number === number);
      if (version === undefined) {
        throw new Error(`Version inconnue : ${artefact} v${String(number)} de l'Offre ${reference}.`);
      }
      if (version.state !== 'ready') {
        const state = version.state === 'failed' ? 'en échec' : 'en cours';
        throw new Error(
          `La Version ${artefact} v${String(number)} de l'Offre ${reference} est ${state} : seule une Version prête peut être retenue.`,
        );
      }
      await workspace.retainVersion(offre, version);
    },
  } satisfies Record<string, (rawInput: unknown) => Promise<void> | Promise<DomainValue | DomainValue[]>>;
}
