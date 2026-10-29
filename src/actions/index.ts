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
  STATUT_SCHEMA,
  VISUALISATION_SCHEMA,
  type Artefact,
  type Candidat,
  type Detection,
  type DomainValue,
  type Job,
  type Lieu,
  type MarkdownFile,
  type ModuleConsignes,
  type Offre,
  type OffreFiche,
  type Recipients,
  type Version,
  type Visualisation,
} from '#/domain/index.ts';
import { composeEditPrompt } from '#/edit/prompt.ts';
import { createApiGeo } from '#/geo/acl/api-geo.ts';
import { readCity } from '#/geo/city.ts';
import { BROUILLON_FILE_NAME, LETTRE_MODULE } from '#/modules/lettre/index.ts';
import {
  composeNouvelleOffreNotification,
  composeRecherchePreteNotification,
  composeRepublicationNotification,
  composeRepublicationPostuleeNotification,
  HOME_ASSISTANT,
  type INotification,
  type INotificationChannel,
} from '#/modules/notification/index.ts';
import { createImportSource } from '#/modules/source-import/index.ts';
import { createPepSource } from '#/modules/source-pep/index.ts';
import { VISUALISATION_MODULE } from '#/modules/visualisation/index.ts';
import { composeProfilPrompt } from '#/profil/prompt.ts';
import { findRepublishedOffre } from '#/republication/index.ts';
import { assertStatutChange, hasBeenPostulee, listNextStatuts } from '#/statut/index.ts';
import { messageOf } from '#/text/index.ts';
import { openWorkspace } from '#/workspace/index.ts';

import {
  assertNotFrozen,
  createJobRunner,
  describeModule,
  findDefaultConsignes,
  findInputs,
  findVersionRetenue,
  parseArtefact,
  parseModule,
} from './run-job.ts';

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
const ARTEFACT_INPUT_SCHEMA = z.object({ reference: z.string(), artefact: z.string() });
const VERSION_INPUT_SCHEMA = ARTEFACT_INPUT_SCHEMA.extend({ number: z.coerce.number().int() });
const DOCUMENT_INPUT_SCHEMA = ARTEFACT_INPUT_SCHEMA.extend({ fileName: z.string(), markdown: z.string() });
const JOB_INPUT_SCHEMA = z.object({ jobId: z.coerce.number().int() });
const VISUALISATION_INPUT_SCHEMA = REFERENCE_INPUT_SCHEMA.extend({ number: z.coerce.number().int() });

const STATUT_INPUT_SCHEMA = z.object({ reference: z.string(), statut: STATUT_SCHEMA });

const ETAT_BY_VERSION_STATE = { running: 'en_cours', ready: 'pret', failed: 'en_echec' } as const;
const ETAT_BY_JOB_STATE = { queued: 'en_cours', running: 'en_cours', done: 'pret', failed: 'en_echec' } as const;

// What a Détection found for one Veille, and the notifications to send once every Veille is done
interface IFoundOffres {
  detection: Omit<z.input<typeof DETECTION_SCHEMA>, 'notificationFailureList'>;
  notificationList: { offre: Offre; notification: INotification }[];
}

// How often a followed job is read again: a module runs for minutes
const FOLLOW_INTERVAL_MS = 1000;

// Only the Version retenue is corrected by hand, in place: never a Visualisation, regenerated from
// the Fiche d'entretien, nor a Lettre frozen once sent
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
  assertNotFrozen(offre, artefact);
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

// Only a ready Version can become the Version retenue, and a Lettre frozen once sent stays retenue
function assertRetenable(
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
function isAccepted(check: () => void): boolean {
  try {
    check();
    return true;
  } catch {
    return false;
  }
}

// The single entry point of every feature, so no business rule lives in the CLI or the front
// (ADR-0003); `satisfies` holds each action to unknown input and domain output (ADR-0005)
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
      throw new Error(
        `Plusieurs Offres ont la référence ${reference}, chez des Candidats différents : leurs Veilles suivent la même Source, et l'outil ne sait pas encore choisir entre elles. Le signaler pour qu'il les distingue.`,
      );
    }
    return offre;
  }

  // A ville API Géo does not know stays as read, without coordinates, to be located again later
  async function locate(city: string | null): Promise<Lieu> {
    const lieu = city === null ? null : await apiGeo.findLieu(city);
    return lieu ?? LIEU_SCHEMA.parse({ city, region: null, latitude: null, longitude: null });
  }

  // The extraction job of an imported Offre (ADR-0003); a failure throws, which fails the job and
  // leaves the Offre as imported
  async function runExtraction(job: Job): Promise<{ job: Job }> {
    const { offre } = job;
    const { title, ficheDePoste, city, session } = await importSource.extract(
      workspace.offreDirectoryOf(offre),
      workspace.readFicheDePoste(offre),
    );
    // A Fiche de poste without a title keeps the name of its file: nothing is invented
    const lieu = await locate(city);
    const filledOffre = await workspace.fillOffre(offre, { title: title ?? offre.title, ficheDePoste, lieu });
    // Imported by the Candidat, it gets its Recherche whatever the Zone
    await workspace.createJob(filledOffre, 'recherche');
    return { job: await workspace.finishJobWithoutVersion(job, { log: session.log, sessionId: session.sessionId }) };
  }

  // A notification not sent undoes and skips nothing: it comes back as the failure to report
  async function notify(offre: Offre, notification: INotification): Promise<string | undefined> {
    try {
      await notificationChannel.send(workspace.notificationTargetOf(offre.candidatId), notification);
      return undefined;
    } catch (error) {
      const reason = messageOf(error);
      return `Notification « ${notification.title} » de l'Offre ${offre.reference} non envoyée : ${reason}`;
    }
  }

  // In the Zone, a new Offre gets its Recherche (ADR-0003). The Republication of an Offre once
  // Postulée gets none whatever the Zone: the Candidat, who applied already, decides.
  async function startNewOffre(offre: Offre, republicationOf: Offre | undefined): Promise<INotification | undefined> {
    if (republicationOf !== undefined && hasBeenPostulee(republicationOf)) {
      return composeRepublicationPostuleeNotification(offre, republicationOf);
    }
    if (!offre.isInZone) {
      return;
    }
    await workspace.createJob(offre, 'recherche');
    return republicationOf === undefined
      ? composeNouvelleOffreNotification(offre)
      : composeRepublicationNotification(offre, republicationOf);
  }

  function readModuleConsignes(candidatId: string, module: Artefact): ModuleConsignes {
    return MODULE_CONSIGNES_SCHEMA.parse({
      module,
      defaultConsignes: findDefaultConsignes(module),
      candidatConsignes: workspace.readConsignes(candidatId, module),
    });
  }

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
    listCandidats(): Promise<Candidat[]> {
      return workspace.listCandidats();
    },

    // An Offre is known by its reference, never by its publication date, which the site changes
    // (ADR-0001)
    async detect(): Promise<Detection[]> {
      // The Offres saved before they had a ville, or whose ville API Géo did not know
      const unlocatedOffreList = await workspace.listUnlocatedOffres();
      for (const offre of unlocatedOffreList) {
        await workspace.setLieu(offre, await locate(offre.city ?? readCity(offre.workplace)));
      }
      const veilleList = await workspace.listVeilles();
      const foundList: IFoundOffres[] = [];
      for (const veille of veilleList) {
        const { candidatId, source } = veille;
        const knownReferenceList = await workspace.listReferences(candidatId, source);
        // A first launch cut off goes on at the next Détection, still triggering nothing
        const isFirstLaunch = veille.detectedAt === null;
        const { matchingList, nearMissList } = await pepSource.search(veille.criteria);
        const offreList = await workspace.listOffres(candidatId);
        const newOffreList: Offre[] = [];
        const notificationList: { offre: Offre; notification: INotification }[] = [];
        // Oldest first, as published: a Republication found by the same Détection as the Offre it
        // publishes again, as on the first launch, is saved after it
        const oldestFirstList = matchingList.toSorted((left, right) => left.reference.localeCompare(right.reference));
        for (const listedOffre of oldestFirstList) {
          if (knownReferenceList.includes(listedOffre.reference)) {
            continue;
          }
          const { ficheDePoste, isInZone } = await pepSource.readFicheDePoste(listedOffre.reference, veille.zone);
          const republicationOf = findRepublishedOffre({ ...listedOffre, ...ficheDePoste }, offreList);
          const lieu = await locate(readCity(ficheDePoste.workplace));
          const offre = await workspace.saveOffre({
            candidatId,
            source,
            listedOffre,
            ficheDePoste,
            isInZone,
            republicationOf,
            lieu,
          });
          offreList.push(offre);
          newOffreList.push(offre);
          // The Offres already online at the first launch start nothing (ADR-0003)
          const notification = isFirstLaunch ? undefined : await startNewOffre(offre, republicationOf);
          if (notification !== undefined) {
            notificationList.push({ offre, notification });
          }
        }
        await workspace.setDetected(veille);
        foundList.push({
          detection: { veilleId: veille.id, candidatId, isFirstLaunch, newOffreList, nearMissList },
          notificationList,
        });
      }
      // Notified last, once every Offre is saved and its Recherche queued. A notification not sent
      // undoes nothing: it comes back with what the Détection found, which jf detect prints first.
      const detectionList: Detection[] = [];
      for (const { detection, notificationList } of foundList) {
        const failureList = await Promise.all(
          notificationList.map(({ offre, notification }) => notify(offre, notification)),
        );
        const notificationFailureList = failureList.filter((failure) => failure !== undefined);
        detectionList.push(DETECTION_SCHEMA.parse({ ...detection, notificationFailureList }));
      }
      return detectionList;
    },

    // The worker reads the fields of the Fiche de poste (ADR-0003); importing the same file again
    // gives back its job, without another Offre nor another job
    async importFicheDePoste(rawInput: unknown): Promise<Job> {
      const candidat = await findCandidat(rawInput);
      const { fileName, markdown } = IMPORT_INPUT_SCHEMA.parse(rawInput);
      const { listedOffre, ficheDePoste } = importSource.list(fileName, markdown);
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
        ficheDePoste,
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

    async changeStatut(rawInput: unknown): Promise<void> {
      const { reference, statut } = STATUT_INPUT_SCHEMA.parse(rawInput);
      const offre = await findOffre(reference);
      assertStatutChange(offre, statut);
      await workspace.setStatut(offre, statut);
    },

    async openProfil(rawInput: unknown): Promise<void> {
      const candidat = await findCandidat(rawInput);
      aiSession.openInteractive({
        prompt: composeProfilPrompt(candidat),
        directory: workspace.profilDirectoryOf(candidat.id),
      });
    },

    async listProfilFiles(rawInput: unknown): Promise<MarkdownFile[]> {
      const candidat = await findCandidat(rawInput);
      return workspace.readProfilFiles(candidat.id);
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

    async listConsignes(rawInput: unknown): Promise<ModuleConsignes[]> {
      const candidat = await findCandidat(rawInput);
      return ARTEFACT_SCHEMA.options.map((module) => readModuleConsignes(candidat.id, module));
    },

    // Named by its Artefact or its alias, as jf run names it
    async readConsignes(rawInput: unknown): Promise<ModuleConsignes> {
      const candidat = await findCandidat(rawInput);
      const { module } = CONSIGNES_MODULE_INPUT_SCHEMA.parse(rawInput);
      return readModuleConsignes(candidat.id, parseModule(module));
    },

    // The fixed part of the prompt stays, so the Candidat's Consignes cannot lift its rules (ADR-0003)
    async saveConsignes(rawInput: unknown): Promise<void> {
      const candidat = await findCandidat(rawInput);
      const { module, consignes } = CONSIGNES_INPUT_SCHEMA.parse(rawInput);
      workspace.saveConsignes(candidat.id, parseModule(module), consignes);
    },

    async deleteConsignes(rawInput: unknown): Promise<void> {
      const candidat = await findCandidat(rawInput);
      const { module } = CONSIGNES_MODULE_INPUT_SCHEMA.parse(rawInput);
      workspace.deleteConsignes(candidat.id, parseModule(module));
    },

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

    // The Brouillon stays read-only, so that the tool learns from the Candidat's corrections
    async openArtefact(rawInput: unknown): Promise<void> {
      const { reference, ...input } = ARTEFACT_INPUT_SCHEMA.parse(rawInput);
      const artefact = parseArtefact(input.artefact);
      const offre = await findOffre(reference);
      const version = await findVersionRetenue(workspace, offre, artefact);
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

    // Only queues the job: the worker runs it, so restarting the front never stops a session
    // (ADR-0003)
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

    async followJob(rawInput: unknown): Promise<Job> {
      const { jobId } = JOB_INPUT_SCHEMA.parse(rawInput);
      for (;;) {
        const job = await workspace.findJob(jobId);
        if (job === null) {
          throw new Error(
            `Job inconnu : ${String(jobId)}. Son numéro est celui que « jf run » ou « jf import » a affiché.`,
          );
        }
        if (job.state === 'done' || job.state === 'failed') {
          return job;
        }
        await setTimeout(FOLLOW_INTERVAL_MS);
      }
    },

    // At the worker's start, a running job was cut off by its stop: failing it frees the queue
    async failInterruptedJobs(): Promise<Job[]> {
      return workspace.failRunningJobs(
        "Interrompu : le worker s'est arrêté pendant ce job. Relancer le module en crée une nouvelle Version.",
      );
    },

    // One job at a time, a single Claude session (ADR-0003)
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
          const versionRetenue = await findVersionRetenue(workspace, offre, artefact);
          // A queued job has no Version yet, while the worker runs another one (ADR-0003)
          const isQueued = jobList.some(({ module, state }) => module === artefact && state === 'queued');
          const state = isQueued ? 'running' : versionList.at(-1)?.state;
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
      const version = versionList.find((candidate) => candidate.number === number);
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
      const version = versionList.find((candidate) => candidate.number === number);
      assertRetenable(offre, artefact, version, number);
      await workspace.retenirVersion(offre, version);
    },
  } satisfies Record<string, (rawInput: unknown) => Promise<void> | Promise<DomainValue | DomainValue[]>>;
}
