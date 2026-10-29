import { z } from 'zod/v4';

import { CLAUDE_CODE, type IAiSession } from '#/ai-session/acl/claude-code.ts';
import { LIEU_SCHEMA, type Candidat, type Lieu, type Offre } from '#/domain/index.ts';
import { createApiGeo } from '#/geo/acl/api-geo.ts';
import { HOME_ASSISTANT, type INotification, type INotificationChannel } from '#/modules/notification/index.ts';
import { createImportSource } from '#/modules/source-import/index.ts';
import { createPepSource } from '#/modules/source-pep/index.ts';
import { messageOf } from '#/text/index.ts';
import { openWorkspace } from '#/workspace/index.ts';

import { createJobRunner } from './run-job.ts';

const CANDIDAT_INPUT_SCHEMA = z.object({ candidatId: z.string() });

export const REFERENCE_INPUT_SCHEMA = z.object({ reference: z.string() });

export const ARTEFACT_INPUT_SCHEMA = z.object({ reference: z.string(), artefact: z.string() });

export interface IActionsOption {
  dataDirectory: string;
  aiSession?: IAiSession;
  fetch?: typeof globalThis.fetch;
  notificationChannel?: INotificationChannel;
}

// What the actions of every feature share: the data folder, the external boundaries, which the
// tests replace with fakes, and the lookups of a Candidat and an Offre
export async function openContext({
  dataDirectory,
  aiSession = CLAUDE_CODE,
  fetch,
  notificationChannel = HOME_ASSISTANT,
}: IActionsOption) {
  const workspace = await openWorkspace(dataDirectory);
  const apiGeo = createApiGeo(fetch);

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

  return {
    workspace,
    aiSession,
    pepSource: createPepSource(fetch),
    importSource: createImportSource(aiSession),
    runJob: createJobRunner(workspace, aiSession),
    findCandidat,
    findOffre,
    locate,
    notify,
  };
}

export type ActionContext = Awaited<ReturnType<typeof openContext>>;
