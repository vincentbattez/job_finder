import { z } from 'zod/v4';

import { CLAUDE_CODE, type IAiSession } from '#/ai-session/acl/claude-code.ts';
import { LIEU_SCHEMA, type Candidat, type Lieu, type Offre } from '#/domain/index.ts';
import { createApiGeo } from '#/geo/acl/api-geo.ts';
import { createPieceConversion } from '#/modules/conversion/index.ts';
import { createImportSource } from '#/modules/source-import/index.ts';
import type { ICanalNotification, INotification } from '#/notification/index.ts';
import type { ISource, SourceFactory } from '#/source/index.ts';
import { messageOf } from '#/text/index.ts';
import { openWorkspace } from '#/workspace/index.ts';

import { CANAL_NOTIFICATION_LIST, SOURCE_LIST } from './modules.ts';
import { createJobRunner } from './run-job.ts';

const CANDIDAT_INPUT_SCHEMA = z.object({ candidatId: z.string() });

export const REFERENCE_INPUT_SCHEMA = z.object({ reference: z.string() });

export const ARTEFACT_INPUT_SCHEMA = z.object({ reference: z.string(), artefact: z.string() });

export interface IActionsOption {
  dataDirectory: string;
  aiSession?: IAiSession;
  fetch?: typeof globalThis.fetch;
  // The modules a Candidat chooses their Canal de notification from: the registry, or a fake one
  canalNotificationList?: readonly ICanalNotification[];
  // The Sources a Veille follows, created with fetch: the registry, or a fake one
  sourceFactoryList?: readonly SourceFactory[];
}

// What the actions of every feature share: the data folder, the external boundaries, which the
// tests replace with fakes, and the lookups of a Candidat and an Offre
export async function openContext({
  dataDirectory,
  aiSession = CLAUDE_CODE,
  fetch,
  canalNotificationList = CANAL_NOTIFICATION_LIST,
  sourceFactoryList = SOURCE_LIST,
}: IActionsOption) {
  const workspace = await openWorkspace(dataDirectory);
  const apiGeo = createApiGeo(fetch);
  const sourceList = sourceFactoryList.map((createSource) => createSource(fetch));

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

  // A module of the family by its identifier, as saved or as the Candidat picked it (ADR-0010)
  function findCanalNotificationModule(moduleId: string): ICanalNotification {
    const module = canalNotificationList.find(({ description: { id } }) => id === moduleId);
    if (module === undefined) {
      throw new Error(
        `Canal de notification inconnu : ${moduleId}. En choisir un autre dans la section Notifications du Profil.`,
      );
    }
    return module;
  }

  // A Source by its identifier, as the Candidat picked it, or as the Veille named saved it (ADR-0010)
  function findSource(sourceId: string, veilleId?: string): ISource {
    const source = sourceList.find(({ description: { id } }) => id === sourceId);
    if (source === undefined) {
      const knownList = sourceList.map(({ description: { id } }) => id).join(', ');
      const ofVeille = veilleId === undefined ? '' : ` pour la Veille ${veilleId}`;
      throw new Error(
        `Source inconnue${ofVeille} : ${sourceId}. En choisir une parmi ${knownList} dans les Veilles du Profil.`,
      );
    }
    return source;
  }

  // Through the Canal the Candidat saved, with its saved Paramètres
  async function sendNotification(candidatId: string, notification: INotification): Promise<void> {
    const { candidatName, module, parametres } = await workspace.findCanalNotification(candidatId);
    if (module === null) {
      throw new Error(
        `Aucun Canal de notification pour ${candidatName} : en choisir un dans la section Notifications de son Profil.`,
      );
    }
    await findCanalNotificationModule(module).send(parametres, notification);
  }

  // A notification not sent undoes and skips nothing: it comes back as the failure to report
  async function notify(offre: Offre, notification: INotification): Promise<string | undefined> {
    try {
      await sendNotification(offre.candidatId, notification);
      return undefined;
    } catch (error) {
      const reason = messageOf(error);
      return `Notification « ${notification.title} » de l'Offre ${offre.reference} non envoyée : ${reason}`;
    }
  }

  return {
    workspace,
    aiSession,
    sourceList,
    findSource,
    importSource: createImportSource(aiSession),
    pieceConversion: createPieceConversion(aiSession),
    runJob: createJobRunner(workspace, aiSession),
    canalNotificationList,
    findCanalNotificationModule,
    sendNotification,
    findCandidat,
    findOffre,
    locate,
    notify,
  };
}

export type ActionContext = Awaited<ReturnType<typeof openContext>>;
