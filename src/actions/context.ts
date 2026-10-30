import { z } from 'zod/v4';

import { CLAUDE_CODE, type IAiSession } from '#/ai-session/acl/claude-code.ts';
import { LOCATION_SCHEMA, type Candidate, type Location, type Posting } from '#/domain/index.ts';
import { createApiGeo } from '#/geo/acl/api-geo.ts';
import { createUploadConversion } from '#/modules/conversion/index.ts';
import { createImportSource } from '#/modules/source-import/index.ts';
import type { INotification, INotificationChannel } from '#/notification/index.ts';
import type { ISource, SourceFactory } from '#/source/index.ts';
import { messageOf } from '#/text/index.ts';
import { openWorkspace } from '#/workspace/index.ts';

import { NOTIFICATION_CHANNEL_LIST, SOURCE_LIST } from './modules.ts';
import { createJobRunner } from './run-job.ts';

const CANDIDATE_INPUT_SCHEMA = z.object({ candidateId: z.string() });

export const REFERENCE_INPUT_SCHEMA = z.object({ reference: z.string() });

export const ARTIFACT_INPUT_SCHEMA = z.object({ reference: z.string(), artifact: z.string() });

// The Parameters the Candidate typed in the form of a module, before the module parses them (ADR-0010)
export const PARAMETERS_INPUT_SCHEMA = z.record(z.string(), z.json());

export interface IActionsOption {
  dataDirectory: string;
  aiSession?: IAiSession;
  fetch?: typeof globalThis.fetch;
  // The modules a Candidate chooses their Notification Channel from: the registry, or a fake one
  notificationChannelList?: readonly INotificationChannel[];
  // The Sources a Watch follows, created with fetch: the registry, or a fake one
  sourceFactoryList?: readonly SourceFactory[];
}

// What the actions of every feature share: the data folder, the external boundaries, which the
// tests replace with fakes, and the lookups of a Candidate and a Posting
export async function openContext({
  dataDirectory,
  aiSession = CLAUDE_CODE,
  fetch,
  notificationChannelList = NOTIFICATION_CHANNEL_LIST,
  sourceFactoryList = SOURCE_LIST,
}: IActionsOption) {
  const workspace = await openWorkspace(dataDirectory);
  const apiGeo = createApiGeo(fetch);
  const sourceList = sourceFactoryList.map((createSource) => createSource(fetch));

  async function findCandidate(rawInput: unknown): Promise<Candidate> {
    const { candidateId } = CANDIDATE_INPUT_SCHEMA.parse(rawInput);
    const candidateList = await workspace.listCandidates();
    const candidate = candidateList.find(({ id }) => id === candidateId);
    if (candidate === undefined) {
      throw new Error(`Candidat inconnu : ${candidateId}. « jf candidates » liste les Candidats.`);
    }
    return candidate;
  }

  async function findPosting(reference: string): Promise<Posting> {
    const [posting, ...otherPostingList] = await workspace.findPostings(reference);
    if (posting === undefined) {
      throw new Error(`Offre inconnue : ${reference}. « jf list <candidat> » liste les Offres.`);
    }
    // Two Candidates may follow the same Source: a reference alone then names several Postings
    if (otherPostingList.length > 0) {
      throw new Error(
        `Plusieurs Offres ont la référence ${reference}, chez des Candidats différents : leurs Veilles suivent la même Source, et l'outil ne sait pas encore choisir entre elles. Le signaler pour qu'il les distingue.`,
      );
    }
    return posting;
  }

  // A city API Géo does not know stays as read, without coordinates, to be located again later
  async function locate(city: string | null): Promise<Location> {
    const location = city === null ? null : await apiGeo.findLocation(city);
    return location ?? LOCATION_SCHEMA.parse({ city, region: null, latitude: null, longitude: null });
  }

  // A module of the family by its identifier, undefined when the registry does not have it (ADR-0010)
  function notificationChannelModuleOf(moduleId: string | null): INotificationChannel | undefined {
    return notificationChannelList.find(({ description: { id } }) => id === moduleId);
  }

  // The module of the Candidate's Notification Channel, as saved or as they picked it, null until chosen
  function findNotificationChannelModule(moduleId: string | null, candidateName: string): INotificationChannel {
    if (moduleId === null) {
      throw new Error(
        `Aucun Canal de notification pour ${candidateName} : en choisir un dans la section Notifications de son Profil.`,
      );
    }
    const module = notificationChannelModuleOf(moduleId);
    if (module === undefined) {
      throw new Error(
        `Canal de notification inconnu : ${moduleId}. En choisir un autre dans la section Notifications du Profil.`,
      );
    }
    return module;
  }

  // A Source by its identifier, as the Candidate picked it, or as the Watch named saved it (ADR-0010)
  function findSource(sourceId: string, watchId?: string): ISource {
    const source = sourceList.find(({ description: { id } }) => id === sourceId);
    if (source === undefined) {
      const knownList = sourceList.map(({ description: { id } }) => id).join(', ');
      const ofWatch = watchId === undefined ? '' : ` pour la Veille ${watchId}`;
      throw new Error(
        `Source inconnue${ofWatch} : ${sourceId}. En choisir une parmi ${knownList} dans les Veilles du Profil.`,
      );
    }
    return source;
  }

  // Through the Channel the Candidate saved, with its saved Parameters
  async function sendNotification(candidateId: string, notification: INotification): Promise<void> {
    const { candidateName, module, parameters } = await workspace.findNotificationChannel(candidateId);
    await findNotificationChannelModule(module, candidateName).send(parameters, notification);
  }

  // A notification not sent undoes and skips nothing: it comes back as the failure to report
  async function notify(posting: Posting, notification: INotification): Promise<string | undefined> {
    try {
      await sendNotification(posting.candidateId, notification);
      return undefined;
    } catch (error) {
      const reason = messageOf(error);
      return `Notification « ${notification.title} » de l'Offre ${posting.reference} non envoyée : ${reason}`;
    }
  }

  return {
    workspace,
    aiSession,
    sourceList,
    findSource,
    importSource: createImportSource(aiSession),
    uploadConversion: createUploadConversion(aiSession),
    runJob: createJobRunner(workspace, aiSession, findCandidate),
    notificationChannelList,
    notificationChannelModuleOf,
    findNotificationChannelModule,
    sendNotification,
    findCandidate,
    findPosting,
    locate,
    notify,
  };
}

export type ActionContext = Awaited<ReturnType<typeof openContext>>;
