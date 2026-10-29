import path from 'node:path';
import { setTimeout } from 'node:timers/promises';

import { z } from 'zod/v4';

import { CLAUDE_CODE, type IAiSession } from '#/ai-session/acl/claude-code.ts';
import {
  ARTEFACT_SCHEMA,
  DETECTION_SCHEMA,
  LIEU_SCHEMA,
  MODULE_CONSIGNES_SCHEMA,
  OFFRE_FICHE_SCHEMA,
  PROFIL_FILE_SCHEMA,
  VISUALISATION_SCHEMA,
  type Artefact,
  type Candidat,
  type Detection,
  type DomainValue,
  type Job,
  type Lieu,
  type ModuleConsignes,
  type Offre,
  type OffreFiche,
  type ProfilFile,
  type Recipients,
  type Version,
  type Visualisation,
} from '#/domain/index.ts';
import { BROUILLON_FILE_NAME, composeEditPrompt } from '#/edit/prompt.ts';
import { createApiGeo } from '#/geo/acl/api-geo.ts';
import { readCity } from '#/geo/city.ts';
import { LETTRE_MODULE } from '#/modules/lettre/index.ts';
import {
  composeNouvelleOffreNotification,
  composeRecherchePreteNotification,
  composeRepublicationNotification,
  HOME_ASSISTANT,
  type INotification,
  type INotificationChannel,
} from '#/modules/notification/index.ts';
import { createImportSource } from '#/modules/source-import/index.ts';
import { createPepSource } from '#/modules/source-pep/index.ts';
import { VISUALISATION_MODULE } from '#/modules/visualisation/index.ts';
import { composeProfilPrompt } from '#/profil/prompt.ts';
import { findRepublishedOffre } from '#/republication/index.ts';
import { assertLettreModifiable } from '#/statut/index.ts';
import { messageOf } from '#/text/index.ts';
import { openWorkspace } from '#/workspace/index.ts';

import { createJobRunner, describeModule, findInputs, listDefaultConsignes, parseModule } from './run-job.ts';

export type Actions = Awaited<ReturnType<typeof createActions>>;

// The CLI, the front and the worker reach nothing but the actions (ADR-0003)
export { messageOf } from '#/text/index.ts';

const CANDIDAT_INPUT_SCHEMA = z.object({ candidatId: z.string() });
const IMPORT_INPUT_SCHEMA = z.object({ fileName: z.string(), markdown: z.string() });
const MODULE_INPUT_SCHEMA = z.object({ module: z.string(), reference: z.string() });
const REFERENCE_INPUT_SCHEMA = z.object({ reference: z.string() });
const PROFIL_FILE_INPUT_SCHEMA = z.object({ fileName: z.string(), markdown: z.string() });
const CONSIGNES_MODULE_INPUT_SCHEMA = z.object({ module: z.string() });
const CONSIGNES_INPUT_SCHEMA = CONSIGNES_MODULE_INPUT_SCHEMA.extend({ consignes: z.string() });
const ARTEFACT_INPUT_SCHEMA = z.object({ reference: z.string(), artefact: ARTEFACT_SCHEMA });
const VERSION_INPUT_SCHEMA = ARTEFACT_INPUT_SCHEMA.extend({ number: z.coerce.number().int() });
const DOCUMENT_INPUT_SCHEMA = ARTEFACT_INPUT_SCHEMA.extend({ fileName: z.string(), markdown: z.string() });
const JOB_INPUT_SCHEMA = z.object({ jobId: z.coerce.number().int() });
const VISUALISATION_INPUT_SCHEMA = REFERENCE_INPUT_SCHEMA.extend({ number: z.coerce.number().int() });

const STATUS_INPUT_SCHEMA = z.object({ reference: z.string(), status: z.enum(['postulee', 'archivee']) });

const ETAT_BY_VERSION_STATE = { running: 'en_cours', ready: 'pret', failed: 'en_echec' } as const;
const ETAT_BY_JOB_STATE = { queued: 'en_cours', running: 'en_cours', done: 'pret', failed: 'en_echec' } as const;

// How often a followed job is read again: a module runs for minutes
const FOLLOW_INTERVAL_MS = 1000;

// What the Candidat corrects by hand, in the front or with jf edit: the Version retenue, in place
// (spec « Versions »). Never a Visualisation, regenerated from the Fiche d'entretien, nor the
// Lettre of a Postulée Offre, the one sent.
function assertArtefactModifiable(
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
  if (artefact === 'lettre') {
    assertLettreModifiable(offre);
  }
  if (version?.isRetenue !== true) {
    throw new Error(
      `L'Offre ${reference} n'a pas de Version retenue de ${artefact} à modifier : « jf run ${artefact} ${reference} » en produit une.`,
    );
  }
}

// A file of the Version retenue, except a Brouillon, kept as the AI wrote it so that the tool learns
// from the corrections
function assertDocumentModifiable(
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

// Only a ready Version can become the Version retenue, and the Lettre of a Postulée Offre stays
// the one sent (spec « Versions »)
function assertRetenable(
  offre: Offre,
  artefact: Artefact,
  version: Version | undefined,
  number: number,
): asserts version is Version {
  const { reference } = offre;
  if (artefact === 'lettre') {
    assertLettreModifiable(offre);
  }
  if (version === undefined) {
    throw new Error(`Version inconnue : ${artefact} v${String(number)} de l'Offre ${reference}.`);
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
function isAccepted(check: () => void): boolean {
  try {
    check();
    return true;
  } catch {
    return false;
  }
}

// The single entry point of every feature: the CLI and the front only call these actions,
// so no business rule lives in either of them (ADR-0003). `satisfies` holds them to the
// anti-corruption layer (ADR-0005): the input is whatever a user typed, so each action takes it
// as unknown and parses it with Zod, and the output is nothing or domain values, so no raw data
// reaches the CLI or the front. The tests pass a fake aiSession, a fake fetch for the HTTP of the
// Sources and of API Géo, and a fake notificationChannel, since Claude, the sites and the phones are
// external boundaries.
export async function createActions({
  dataDirectory,
  aiSession = CLAUDE_CODE,
  fetch,
  notificationChannel = HOME_ASSISTANT,
}: {
  dataDirectory: string;
  aiSession?: IAiSession;
  fetch?: typeof globalThis.fetch;
  notificationChannel?: INotificationChannel;
}) {
  const workspace = await openWorkspace(dataDirectory);
  const pepSource = createPepSource(fetch);
  const apiGeo = createApiGeo(fetch);
  const importSource = createImportSource(aiSession);
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

  // API Géo turns a ville into its commune, with région and coordinates (spec « Coordonnées »). A
  // ville it does not know stays as read, without coordinates.
  async function locate(city: string | null): Promise<Lieu> {
    const lieu = city === null ? null : await apiGeo.findLieu(city);
    return lieu ?? LIEU_SCHEMA.parse({ city, region: null, latitude: null, longitude: null });
  }

  // The job of an imported Offre: Claude reads the fields of its Fiche de poste, which fill the Offre,
  // located like a detected one, then its Recherche is queued. Throws when the extraction fails, which
  // fails the job and leaves the Offre as it was.
  async function runExtraction(job: Job): Promise<{ job: Job }> {
    const { offre } = job;
    const { title, fiche, city, session } = await importSource.extract(
      workspace.offreDirectoryOf(offre),
      workspace.readFicheDePoste(offre),
    );
    // A Fiche de poste without a title keeps the name of its file: nothing is invented
    const lieu = await locate(city);
    const filledOffre = await workspace.fillOffre(offre, { title: title ?? offre.title, fiche, lieu });
    // Imported by the Candidat, it gets its Recherche whatever the Zone
    await workspace.createJob(filledOffre, 'recherche');
    return { job: await workspace.finishJobWithoutVersion(job, { log: session.log, sessionId: session.sessionId }) };
  }

  // Sends a notification to the Candidat of the Offre, on their channel (spec « Notification »). A
  // notification that cannot be sent undoes and skips nothing: it comes back as the failure to report.
  async function notify(offre: Offre, notification: INotification): Promise<string | undefined> {
    try {
      await notificationChannel.send(workspace.notificationTargetOf(offre.candidatId), notification);
      return undefined;
    } catch (error) {
      const reason = messageOf(error);
      return `Notification « ${notification.title} » de l'Offre ${offre.reference} non envoyée : ${reason}`;
    }
  }

  // What a new Offre in the Zone starts: its Recherche, and the notification to send once the
  // Détection is over (ADR-0003). The Republication of an Offre Postulée starts nothing: the
  // Candidat decides whether to apply again (spec « Republication »).
  async function startNewOffre(offre: Offre, republicationOf: Offre | undefined): Promise<INotification> {
    if (republicationOf?.status === 'postulee') {
      return composeRepublicationNotification(offre, republicationOf);
    }
    await workspace.createJob(offre, 'recherche');
    return composeNouvelleOffreNotification(offre);
  }

  // Those of the Lettre retenue, none before the Offre has one
  async function findRecipients(offre: Offre): Promise<Recipients | null> {
    const versionList = await workspace.listVersions(offre, 'lettre');
    const version = versionList.find(({ isRetenue }) => isRetenue);
    return version === undefined ? null : LETTRE_MODULE.readRecipients(workspace.versionDirectoryOf(offre, version));
  }

  // A Version as the fiche shows it: its files, and what the Candidat may do with them
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
    listCandidats(): Promise<Candidat[]> {
      return workspace.listCandidats();
    },

    // Reads the Source of each Veille and records the Offres never seen before, with their Fiche
    // de poste. An Offre is known by its reference, never by its publication date, which the site
    // changes (ADR-0001). The first launch imports the Offres already online.
    async detect(): Promise<Detection[]> {
      // The Offres saved before they had a ville, or whose ville API Géo did not know, are
      // located again
      const unlocatedOffreList = await workspace.listUnlocatedOffres();
      for (const offre of unlocatedOffreList) {
        await workspace.setLieu(offre, await locate(offre.city ?? readCity(offre.workplace)));
      }
      const veilleList = await workspace.listVeilles();
      const detectionList: Detection[] = [];
      const notificationList: { offre: Offre; notification: INotification }[] = [];
      for (const veille of veilleList) {
        const { candidatId, source } = veille;
        const knownReferenceList = await workspace.listReferences(candidatId, source);
        // A first launch cut off goes on at the next Détection, still triggering nothing
        const isFirstLaunch = veille.detectedAt === null;
        const { matchingList, nearMissList } = await pepSource.search(veille.criteria);
        const offreList = await workspace.listOffres(candidatId);
        const newOffreList: Offre[] = [];
        // Oldest first, as published: a Republication found by the same Détection as the Offre it
        // publishes again, as on the first launch, is saved after it
        const oldestFirstList = matchingList.toSorted((left, right) => left.reference.localeCompare(right.reference));
        for (const listedOffre of oldestFirstList) {
          if (knownReferenceList.includes(listedOffre.reference)) {
            continue;
          }
          const { fiche, isInZone } = await pepSource.readFiche(listedOffre.reference, veille.zone);
          const republicationOf = findRepublishedOffre({ ...listedOffre, ...fiche }, offreList);
          const lieu = await locate(readCity(fiche.workplace));
          const offre = await workspace.saveOffre({
            candidatId,
            source,
            listedOffre,
            fiche,
            isInZone,
            republicationOf,
            lieu,
          });
          offreList.push(offre);
          newOffreList.push(offre);
          // The Offres already online at the first launch start nothing (ADR-0003)
          if (isInZone && !isFirstLaunch) {
            notificationList.push({ offre, notification: await startNewOffre(offre, republicationOf) });
          }
        }
        await workspace.setDetected(veille);
        detectionList.push(
          DETECTION_SCHEMA.parse({
            veilleId: veille.id,
            candidatId,
            isFirstLaunch,
            newOffreList,
            nearMissList,
          }),
        );
      }
      // Notified last, once every Offre is saved and its Recherche queued; a failure then fails the
      // Détection, visibly in lpm, after every notification was tried
      const failureList: string[] = [];
      for (const { offre, notification } of notificationList) {
        const failure = await notify(offre, notification);
        if (failure !== undefined) {
          failureList.push(failure);
        }
      }
      if (failureList.length > 0) {
        throw new Error(failureList.join('\n'));
      }
      return detectionList;
    },

    // A Fiche de poste in Markdown that the Candidat found elsewhere becomes one of their Offres at
    // once, named after its file, and the job of its extraction is queued: the worker has Claude
    // read its fields (spec « Sources et Détection », ADR-0003). Importing the same file again gives
    // back that job, without another Offre nor another job.
    async importFicheDePoste(rawInput: unknown): Promise<Job> {
      const candidat = await findCandidat(rawInput);
      const { fileName, markdown } = IMPORT_INPUT_SCHEMA.parse(rawInput);
      const { listedOffre, fiche } = importSource.list(fileName, markdown);
      const offreList = await workspace.listOffres(candidat.id);
      const importedOffre = offreList.find(({ reference }) => reference === listedOffre.reference);
      if (importedOffre !== undefined) {
        const jobList = await workspace.listJobs(importedOffre);
        const extractionJob = jobList.findLast(({ module }) => module === 'extraction');
        if (extractionJob !== undefined) {
          return extractionJob;
        }
      }
      const offre = await workspace.saveOffre({
        candidatId: candidat.id,
        source: 'import',
        listedOffre,
        fiche,
        lieu: await locate(null),
        // No Veille detected it, so no Zone holds it; chosen by the Candidat, it gets its Recherche
        // once extracted, whatever the Zone (ADR-0003)
        isInZone: false,
        republicationOf: undefined,
      });
      return workspace.createJob(offre, 'extraction');
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

    async listProfilFiles(rawInput: unknown): Promise<ProfilFile[]> {
      const candidat = await findCandidat(rawInput);
      return z.array(PROFIL_FILE_SCHEMA).parse(workspace.readProfilFiles(candidat.id));
    },

    async saveProfilFile(rawInput: unknown): Promise<void> {
      const candidat = await findCandidat(rawInput);
      const { fileName, markdown } = PROFIL_FILE_INPUT_SCHEMA.parse(rawInput);
      // The name comes from the front: only a file the Profil already has is written, so no name
      // can lead out of the Profil folder
      if (workspace.readProfilFiles(candidat.id).every((profilFile) => profilFile.fileName !== fileName)) {
        throw new Error(
          `Le Profil de ${candidat.name} n'a pas de fichier « ${fileName} ». « jf profil ${candidat.id} » complète le Profil.`,
        );
      }
      workspace.saveProfilFile(candidat.id, fileName, markdown);
    },

    // The Consignes of each module, the default ones and those the Candidat replaced them with
    async listConsignes(rawInput: unknown): Promise<ModuleConsignes[]> {
      const candidat = await findCandidat(rawInput);
      return listDefaultConsignes().map(({ module, defaultConsignes }) =>
        MODULE_CONSIGNES_SCHEMA.parse({
          module,
          defaultConsignes,
          candidatConsignes: workspace.readConsignes(candidat.id, module),
        }),
      );
    },

    // The Candidat's Consignes replace the default ones of the module, for its next Versions. The
    // fixed part of its prompt stays, so they cannot lift its rules (ADR-0003).
    async saveConsignes(rawInput: unknown): Promise<void> {
      const candidat = await findCandidat(rawInput);
      const { module, consignes } = CONSIGNES_INPUT_SCHEMA.parse(rawInput);
      workspace.saveConsignes(candidat.id, parseModule(module), consignes);
    },

    // The module goes back to its default Consignes
    async deleteConsignes(rawInput: unknown): Promise<void> {
      const candidat = await findCandidat(rawInput);
      const { module } = CONSIGNES_MODULE_INPUT_SCHEMA.parse(rawInput);
      workspace.deleteConsignes(candidat.id, parseModule(module));
    },

    // What jf edit offers to edit: the Version retenue of each Artefact of an Offre that it accepts
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

    // jf edit: a Claude Code session where the Candidat corrects the Version retenue in place,
    // without creating a new Version nor ever touching a Brouillon (spec « Versions »)
    async openArtefact(rawInput: unknown): Promise<void> {
      const { reference, artefact } = ARTEFACT_INPUT_SCHEMA.parse(rawInput);
      const offre = await findOffre(reference);
      const versionList = await workspace.listVersions(offre, artefact);
      const version = versionList.find(({ isRetenue }) => isRetenue);
      assertArtefactModifiable(offre, artefact, version);
      const candidat = await findCandidat({ candidatId: offre.candidatId });
      const offreDirectory = workspace.offreDirectoryOf(offre);
      const versionPath = path.relative(offreDirectory, workspace.versionDirectoryOf(offre, version));
      aiSession.openInteractive({
        prompt: composeEditPrompt({ candidat, offre, artefact, versionPath }),
        directory: offreDirectory,
        readOnlyPathList: [path.join(offreDirectory, '**', BROUILLON_FILE_NAME)],
      });
    },

    // Launches a module on an Offre: it only queues its job. The worker runs it, so restarting
    // the front never stops a Claude session (ADR-0003).
    async runModule(rawInput: unknown): Promise<Job> {
      const { module, reference } = MODULE_INPUT_SCHEMA.parse(rawInput);
      // The extraction of an imported Offre runs again after a failure
      if (module === 'extraction') {
        const offre = await findOffre(reference);
        if (offre.source !== 'import') {
          throw new Error(
            `L'Offre ${reference} n'a pas été importée : ses champs viennent de sa Source, sans extraction.`,
          );
        }
        return workspace.createJob(offre, 'extraction');
      }
      const artefact = parseModule(module);
      const offre = await findOffre(reference);
      await findInputs(workspace, offre, artefact);
      return workspace.createJob(offre, artefact);
    },

    // Waits until the worker has run the job, and returns it with the Version it produced
    async followJob(rawInput: unknown): Promise<Job> {
      const { jobId } = JOB_INPUT_SCHEMA.parse(rawInput);
      for (;;) {
        const job = await workspace.findJob(jobId);
        if (job === null) {
          throw new Error(`Job inconnu : ${String(jobId)}.`);
        }
        if (job.state === 'done' || job.state === 'failed') {
          return job;
        }
        await setTimeout(FOLLOW_INTERVAL_MS);
      }
    },

    // At the worker's start, a job still running was cut off by the worker's stop: it fails, with
    // its Version, which frees the queue. Launching the module again makes a new Version.
    async failInterruptedJobs(): Promise<Job[]> {
      return workspace.failRunningJobs(
        "Interrompu : le worker s'est arrêté pendant ce job. Relancer le module en crée une nouvelle Version.",
      );
    },

    // The worker's turn: runs the queued jobs one at a time, oldest first, until the queue is empty.
    // Each job of an AI module creates a new Version of its Artefact.
    async runQueuedJobs(): Promise<Job[]> {
      const jobList: Job[] = [];
      for (let job = await workspace.claimNextJob(); job !== null; job = await workspace.claimNextJob()) {
        try {
          const { module } = job;
          const { job: finishedJob } =
            module === 'extraction' ? await runExtraction(job) : await runJob({ ...job, module });
          jobList.push(finishedJob);
          if (finishedJob.module === 'recherche' && finishedJob.state === 'done') {
            const failure = await notify(finishedJob.offre, composeRecherchePreteNotification(finishedJob.offre));
            // Logged, in lpm logs worker: lpm never restarts a stopped worker, and the job is done
            if (failure !== undefined) {
              process.stderr.write(`${failure}\n`);
            }
          }
        } catch (error) {
          // An error fails this job only, the one running, and the worker goes on with the queue
          jobList.push(...(await workspace.failRunningJobs(messageOf(error))));
        }
      }
      return jobList;
    },

    async readOffre(rawInput: unknown): Promise<OffreFiche> {
      const { reference } = REFERENCE_INPUT_SCHEMA.parse(rawInput);
      const offre = await findOffre(reference);
      const jobList = await workspace.listJobs(offre);
      const extractionJob = jobList.findLast(({ module }) => module === 'extraction');
      const artefactList = await Promise.all(
        ARTEFACT_SCHEMA.options.map(async (artefact) => {
          const versionList = await workspace.listVersions(offre, artefact);
          // A queued job has no Version yet, while the worker runs another one (ADR-0003): it is
          // already en cours
          const isQueued = jobList.some(({ module, state }) => module === artefact && state === 'queued');
          const state = isQueued ? 'running' : versionList.at(-1)?.state;
          return {
            artefact,
            etat: state === undefined ? 'absent' : ETAT_BY_VERSION_STATE[state],
            module: await describeModule(workspace, offre, artefact),
            isEditable: isAccepted(() => {
              assertArtefactModifiable(
                offre,
                artefact,
                versionList.find(({ isRetenue }) => isRetenue),
              );
            }),
            versionList: versionList.map((version) => readFicheVersion(offre, version)),
          };
        }),
      );
      return OFFRE_FICHE_SCHEMA.parse({
        offre,
        ficheDePoste: workspace.readFicheDePoste(offre),
        artefactList,
        recipients: await findRecipients(offre),
        extraction:
          extractionJob === undefined ? null : { etat: ETAT_BY_JOB_STATE[extractionJob.state], log: extractionJob.log },
      });
    },

    async listVersions(rawInput: unknown): Promise<Version[]> {
      const { reference, artefact } = ARTEFACT_INPUT_SCHEMA.parse(rawInput);
      return workspace.listVersions(await findOffre(reference), artefact);
    },

    // The page of a Visualisation Version, for the front to show
    async readVisualisation(rawInput: unknown): Promise<Visualisation> {
      const { reference, number } = VISUALISATION_INPUT_SCHEMA.parse(rawInput);
      const offre = await findOffre(reference);
      const versionList = await workspace.listVersions(offre, 'visualisation');
      const version = versionList.find((candidate) => candidate.number === number);
      if (version === undefined) {
        throw new Error(`Version inconnue : visualisation v${String(number)} de l'Offre ${reference}.`);
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

    // To whom the Lettre retenue recommends sending the application, and why
    async readRecipients(rawInput: unknown): Promise<Recipients> {
      const { reference } = REFERENCE_INPUT_SCHEMA.parse(rawInput);
      const recipients = await findRecipients(await findOffre(reference));
      if (recipients === null) {
        throw new Error(`L'Offre ${reference} n'a pas de Lettre retenue. La produire : jf run lettre ${reference}.`);
      }
      return recipients;
    },

    // The front's editor: the Candidat corrects a file of the Version retenue in place (spec « Versions »)
    async saveDocument(rawInput: unknown): Promise<void> {
      const { reference, artefact, fileName, markdown } = DOCUMENT_INPUT_SCHEMA.parse(rawInput);
      const offre = await findOffre(reference);
      const versionList = await workspace.listVersions(offre, artefact);
      const version = versionList.find(({ isRetenue }) => isRetenue);
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
      const { reference, artefact, number } = VERSION_INPUT_SCHEMA.parse(rawInput);
      const offre = await findOffre(reference);
      const versionList = await workspace.listVersions(offre, artefact);
      const version = versionList.find((candidate) => candidate.number === number);
      assertRetenable(offre, artefact, version, number);
      await workspace.retainVersion(offre, version);
    },
  } satisfies Record<string, (rawInput: unknown) => Promise<void> | Promise<DomainValue | DomainValue[]>>;
}
