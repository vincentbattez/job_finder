import type { z } from 'zod/v4';

import {
  DETECTION_SCHEMA,
  type Detection,
  type ListedOffre,
  type Offre,
  type SourceModule,
  type Watch,
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

// What a Detection found for one Watch, and the notifications to send once every Watch is done
interface IFoundOffres {
  detection: Omit<z.input<typeof DETECTION_SCHEMA>, 'notificationFailureList'>;
  notificationList: INotifiedOffre[];
}

// What the Detection of one Watch knows while it reads the Offres of its Source
interface IWatchRun {
  watch: Watch;
  // A first launch cut off goes on at the next Detection, still triggering nothing
  isFirstLaunch: boolean;
  // Every Offre of its Candidate, those this Detection saves included: a Republication is found there
  offreList: Offre[];
}

// The Detection, in the actions rather than a module: it reads the Source modules, which no module
// may import (ADR-0003). It knows them only through their family (ADR-0010).
export function createDetectActions({ workspace, sourceList, findSource, locate, notify }: ActionContext) {
  // In the Zone, an Offre gets its Recherche (ADR-0003)
  async function startInZone(offre: Offre, republicationOf: Offre | undefined): Promise<INotification> {
    await workspace.createJob(offre, 'recherche');
    return republicationOf === undefined
      ? composeNouvelleOffreNotification(offre)
      : composeRepublicationNotification(offre, republicationOf);
  }

  // The Offres already online at the first launch start nothing (ADR-0003). The Republication of an
  // Offre once Postulée gets no Recherche whatever the Zone: the Candidate, who applied already, decides.
  async function saveNewOffre(
    { watch: { candidateId, source }, isFirstLaunch, offreList }: IWatchRun,
    listedOffre: ListedOffre,
    { ficheDePoste, isInZone }: ISourceReadResult,
  ): Promise<{ offre: Offre; notification: INotification | undefined }> {
    const republicationOf = findRepublishedOffre({ ...listedOffre, ...ficheDePoste }, offreList);
    const place = await locate(readCity(ficheDePoste.workplace));
    const offre = await workspace.saveOffre({
      candidateId,
      source,
      listedOffre,
      ficheDePoste,
      isInZone,
      republicationOf,
      place,
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

  // An Offre another Watch of the Candidate stored out of its Zone, found in the Zone of this one: it
  // starts what it would have started in the Zone, unless it was online at the first launch of this
  // Watch. A Republication of an Offre once Postulée was told when it was stored.
  async function enterZone({ isFirstLaunch, offreList }: IWatchRun, offre: Offre) {
    const inZoneOffre = await workspace.setInZone(offre);
    const republicationOf = offreList.find(({ reference }) => reference === offre.republicationOf?.reference);
    if (isFirstLaunch || (republicationOf !== undefined && hasBeenPostulee(republicationOf))) {
      return;
    }
    return startInZone(inZoneOffre, republicationOf);
  }

  // An Offre is known by its reference, never by its publication date, which the site changes
  // (ADR-0001). Each Watch has its own Zone: an Offre stored out of the Zone of one is read again
  // by each other Watch that has not read it yet.
  async function detectWatch(watch: Watch): Promise<IFoundOffres> {
    const { candidateId, source } = watch;
    const outOfZoneOffreList = await workspace.listOutOfZoneOffresSince(watch);
    const sourceModule = findSource(source, watch.id);
    const { matchingList, nearMissList } = await sourceModule.search(watch);
    const run = {
      watch,
      isFirstLaunch: watch.detectedAt === null,
      offreList: await workspace.listOffres(candidateId),
    };
    const newOffreList: Offre[] = [];
    const notificationList: INotifiedOffre[] = [];
    // Oldest first, as published: a Republication found by the same Detection as the Offre it
    // publishes again, as on the first launch, is saved after it
    const oldestFirstList = matchingList.toSorted((left, right) => left.reference.localeCompare(right.reference));
    for (const listedOffre of oldestFirstList) {
      const isSame = (offre: Offre) => offre.source === source && offre.reference === listedOffre.reference;
      const outOfZoneOffre = outOfZoneOffreList.find((offre) => isSame(offre));
      if (outOfZoneOffre === undefined && run.offreList.some((offre) => isSame(offre))) {
        continue;
      }
      const readResult = await sourceModule.readFicheDePoste(listedOffre.reference, watch);
      if (outOfZoneOffre === undefined) {
        const { offre, notification } = await saveNewOffre(run, listedOffre, readResult);
        newOffreList.push(offre);
        notificationList.push(...(notification === undefined ? [] : [{ offre, notification }]));
      } else if (readResult.isInZone) {
        const notification = await enterZone(run, outOfZoneOffre);
        notificationList.push(...(notification === undefined ? [] : [{ offre: outOfZoneOffre, notification }]));
      }
    }
    await workspace.setDetected(watch);
    return {
      detection: { watchId: watch.id, candidateId, isFirstLaunch: run.isFirstLaunch, newOffreList, nearMissList },
      notificationList,
    };
  }

  return {
    // The form of a Watch asks for the Parameters of the Source it follows
    listSources(): Promise<SourceModule[]> {
      return Promise.resolve(sourceList.map(({ description }) => description));
    },

    async detect(): Promise<Detection[]> {
      // The Offres saved before they had a city, or whose city API Géo did not know
      const unlocatedOffreList = await workspace.listUnlocatedOffres();
      for (const offre of unlocatedOffreList) {
        await workspace.setPlace(offre, await locate(offre.city ?? readCity(offre.workplace)));
      }
      const watchList = await workspace.listWatches();
      const foundList: IFoundOffres[] = [];
      for (const watch of watchList) {
        foundList.push(await detectWatch(watch));
      }
      // Notified last, once every Offre is saved and its Recherche queued. A notification not sent
      // undoes nothing: it comes back with what the Detection found, which jf detect prints first.
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
