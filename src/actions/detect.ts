import type { z } from 'zod/v4';

import {
  DETECTION_SCHEMA,
  type Detection,
  type ListedOffre,
  type Offre,
  type SourceModule,
  type Veille,
} from '#/domain/index.ts';
import { readCity } from '#/geo/city.ts';
import {
  composeNouvelleOffreNotification,
  composeRepublicationNotification,
  composeRepublicationPostuleeNotification,
  type INotification,
} from '#/notification/index.ts';
import { findRepublishedOffre } from '#/republication/index.ts';
import type { ISourceReadResult } from '#/source/index.ts';
import { hasBeenPostulee } from '#/statut/index.ts';

import type { ActionContext } from './context.ts';

interface INotifiedOffre {
  offre: Offre;
  notification: INotification;
}

// What a Détection found for one Veille, and the notifications to send once every Veille is done
interface IFoundOffres {
  detection: Omit<z.input<typeof DETECTION_SCHEMA>, 'notificationFailureList'>;
  notificationList: INotifiedOffre[];
}

// What the Détection of one Veille knows while it reads the Offres of its Source
interface IVeilleRun {
  veille: Veille;
  // A first launch cut off goes on at the next Détection, still triggering nothing
  isFirstLaunch: boolean;
  // Every Offre of its Candidat, those this Détection saves included: a Republication is found there
  offreList: Offre[];
}

// The Détection, in the actions rather than a module: it reads the Source modules, which no module
// may import (ADR-0003). It knows them only through their family (ADR-0010).
export function createDetectActions({ workspace, sourceList, findSource, httpFetch, locate, notify }: ActionContext) {
  // In the Zone, an Offre gets its Recherche (ADR-0003)
  async function startInZone(offre: Offre, republicationOf: Offre | undefined): Promise<INotification> {
    await workspace.createJob(offre, 'recherche');
    return republicationOf === undefined
      ? composeNouvelleOffreNotification(offre)
      : composeRepublicationNotification(offre, republicationOf);
  }

  // The Offres already online at the first launch start nothing (ADR-0003). The Republication of an
  // Offre once Postulée gets no Recherche whatever the Zone: the Candidat, who applied already, decides.
  async function saveNewOffre(
    { veille: { candidatId, source }, isFirstLaunch, offreList }: IVeilleRun,
    listedOffre: ListedOffre,
    { ficheDePoste, isInZone }: ISourceReadResult,
  ): Promise<{ offre: Offre; notification: INotification | undefined }> {
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
    if (isFirstLaunch) {
      return { offre, notification: undefined };
    }
    if (republicationOf !== undefined && hasBeenPostulee(republicationOf)) {
      return { offre, notification: composeRepublicationPostuleeNotification(offre, republicationOf) };
    }
    return { offre, notification: isInZone ? await startInZone(offre, republicationOf) : undefined };
  }

  // An Offre another Veille of the Candidat stored out of its Zone, found in the Zone of this one: it
  // starts what it would have started in the Zone, unless it was online at the first launch of this
  // Veille. A Republication of an Offre once Postulée was told when it was stored.
  async function enterZone({ isFirstLaunch, offreList }: IVeilleRun, offre: Offre) {
    const inZoneOffre = await workspace.setInZone(offre);
    const republicationOf = offreList.find(({ reference }) => reference === offre.republicationOf?.reference);
    if (isFirstLaunch || (republicationOf !== undefined && hasBeenPostulee(republicationOf))) {
      return;
    }
    return startInZone(inZoneOffre, republicationOf);
  }

  // An Offre is known by its reference, never by its publication date, which the site changes
  // (ADR-0001). Each Veille has its own Zone: an Offre stored out of the Zone of one is read again
  // by each other Veille that has not read it yet.
  async function detectVeille(veille: Veille): Promise<IFoundOffres> {
    const { candidatId, source } = veille;
    const outOfZoneOffreList = await workspace.listOutOfZoneOffresSince(veille);
    const sourceModule = findSource(source, veille.id);
    const { matchingList, nearMissList } = await sourceModule.search(veille, httpFetch);
    const run = {
      veille,
      isFirstLaunch: veille.detectedAt === null,
      offreList: await workspace.listOffres(candidatId),
    };
    const newOffreList: Offre[] = [];
    const notificationList: INotifiedOffre[] = [];
    // Oldest first, as published: a Republication found by the same Détection as the Offre it
    // publishes again, as on the first launch, is saved after it
    const oldestFirstList = matchingList.toSorted((left, right) => left.reference.localeCompare(right.reference));
    for (const listedOffre of oldestFirstList) {
      const isSame = (offre: Offre) => offre.source === source && offre.reference === listedOffre.reference;
      const outOfZoneOffre = outOfZoneOffreList.find((offre) => isSame(offre));
      if (outOfZoneOffre === undefined && run.offreList.some((offre) => isSame(offre))) {
        continue;
      }
      const readResult = await sourceModule.readFicheDePoste(listedOffre.reference, veille, httpFetch);
      if (outOfZoneOffre === undefined) {
        const { offre, notification } = await saveNewOffre(run, listedOffre, readResult);
        newOffreList.push(offre);
        notificationList.push(...(notification === undefined ? [] : [{ offre, notification }]));
      } else if (readResult.isInZone) {
        const notification = await enterZone(run, outOfZoneOffre);
        notificationList.push(...(notification === undefined ? [] : [{ offre: outOfZoneOffre, notification }]));
      }
    }
    await workspace.setDetected(veille);
    return {
      detection: { veilleId: veille.id, candidatId, isFirstLaunch: run.isFirstLaunch, newOffreList, nearMissList },
      notificationList,
    };
  }

  return {
    // The form of a Veille asks for the Paramètres of the Source it follows
    listSources(): Promise<SourceModule[]> {
      return Promise.resolve(sourceList.map(({ description }) => description));
    },

    async detect(): Promise<Detection[]> {
      // The Offres saved before they had a ville, or whose ville API Géo did not know
      const unlocatedOffreList = await workspace.listUnlocatedOffres();
      for (const offre of unlocatedOffreList) {
        await workspace.setLieu(offre, await locate(offre.city ?? readCity(offre.workplace)));
      }
      const veilleList = await workspace.listVeilles();
      const foundList: IFoundOffres[] = [];
      for (const veille of veilleList) {
        foundList.push(await detectVeille(veille));
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
  };
}
