import type { z } from 'zod/v4';

import { DETECTION_SCHEMA, type Detection, type Offre, type SourceModule, type Veille } from '#/domain/index.ts';
import { readCity } from '#/geo/city.ts';
import {
  composeNouvelleOffreNotification,
  composeRepublicationNotification,
  composeRepublicationPostuleeNotification,
  type INotification,
} from '#/notification/index.ts';
import { findRepublishedOffre } from '#/republication/index.ts';
import type { ISource } from '#/source/index.ts';
import { hasBeenPostulee } from '#/statut/index.ts';

import type { ActionContext } from './context.ts';

// What a Détection found for one Veille, and the notifications to send once every Veille is done
interface IFoundOffres {
  detection: Omit<z.input<typeof DETECTION_SCHEMA>, 'notificationFailureList'>;
  notificationList: { offre: Offre; notification: INotification }[];
}

// The Détection, in the actions rather than a module: it reads the Source modules, which no module
// may import (ADR-0003). It knows them only through their family (ADR-0010).
export function createDetectActions({ workspace, sourceList, httpFetch, locate, notify }: ActionContext) {
  function findSource({ id, source }: Veille): ISource {
    const found = sourceList.find(({ description }) => description.id === source);
    if (found === undefined) {
      const knownList = sourceList.map(({ description }) => description.id).join(', ');
      throw new Error(
        `La Veille ${id} suit une Source inconnue : ${source}. En choisir une parmi ${knownList} dans data/config.json.`,
      );
    }
    return found;
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

  return {
    // The form of a Veille asks for the Paramètres of the Source it follows
    listSources(): Promise<SourceModule[]> {
      return Promise.resolve(sourceList.map(({ description }) => description));
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
        const sourceModule = findSource(veille);
        const { matchingList, nearMissList } = await sourceModule.search(veille, httpFetch);
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
          const { ficheDePoste, isInZone } = await sourceModule.readFicheDePoste(
            listedOffre.reference,
            veille,
            httpFetch,
          );
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
  };
}
