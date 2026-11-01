import { z } from 'zod/v4';

import { CLAUDE_CODE, type IAiSession } from '#/ai-session/acl/claude-code.ts';
import { localeOf } from '#/domain/catalogue/i18n.ts';
import { codedError, type CodedError } from '#/domain/coded-error.ts';
import { LOCATION_SCHEMA, type Candidate, type Locale, type Location, type Posting } from '#/domain/index.ts';
import { createApiGeo } from '#/geo/acl/api-geo.ts';
import { createUploadConversion } from '#/modules/conversion/index.ts';
import { createImportSource } from '#/modules/source-import/index.ts';
import type { INotificationChannel, NotificationComposer } from '#/notification/index.ts';
import type { ISource, SourceFactory } from '#/source/index.ts';
import { messageOf } from '#/text/index.ts';
import { openWorkspace } from '#/workspace/index.ts';

import { NOTIFICATION_CHANNEL_LIST, SOURCE_LIST } from './modules.ts';
import { createJobRunner } from './run-job.ts';

const CANDIDATE_INPUT_SCHEMA = z.object({ candidateId: z.string() });

export const REFERENCE_INPUT_SCHEMA = z.object({ reference: z.string() });

// The Interview, by its number on the Posting, for an Artifact attached to one
export const ARTIFACT_INPUT_SCHEMA = z.object({
  reference: z.string(),
  artifact: z.string(),
  interview: z.coerce.number().int().optional(),
});

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
    const candidate = await workspace.findCandidate(candidateId);
    if (candidate === null) {
      throw codedError('unknown_candidate', { candidateId });
    }
    return candidate;
  }

  // The locale of the Candidate an action acts for, in which its messages speak (spec #65)
  async function findLocale(candidateId: string): Promise<Locale> {
    return localeOf(await workspace.findCandidate(candidateId));
  }

  // Before the Posting is found, no Candidate tells the locale: the default one
  async function findPosting(reference: string): Promise<Posting> {
    const [posting, ...otherPostingList] = await workspace.findPostings(reference);
    if (posting === undefined) {
      throw codedError('unknown_posting', { reference });
    }
    // Two Candidates may follow the same Source: a reference alone then names several Postings
    if (otherPostingList.length > 0) {
      throw codedError('ambiguous_posting', { reference });
    }
    return posting;
  }

  // A city API Géo does not know stays as read, without coordinates, to be located again later; a
  // failure of API Géo speaks the locale of the Candidate
  async function locate(city: string | null, locale: Locale): Promise<Location> {
    const location = city === null ? null : await apiGeo.findLocation(city, locale);
    return location ?? LOCATION_SCHEMA.parse({ city, region: null, latitude: null, longitude: null });
  }

  // A module of the family by its identifier, undefined when the registry does not have it (ADR-0010)
  function notificationChannelModuleOf(moduleId: string | null): INotificationChannel | undefined {
    return notificationChannelList.find(({ description: { id } }) => id === moduleId);
  }

  // The module of the Candidate's Notification Channel, as saved or as they picked it, null until chosen
  function findNotificationChannelModule(moduleId: string | null, candidate: Candidate): INotificationChannel {
    const { locale } = candidate;
    if (moduleId === null) {
      throw codedError('no_channel', { candidateName: candidate.name }, { locale });
    }
    const module = notificationChannelModuleOf(moduleId);
    if (module === undefined) {
      throw codedError('unknown_channel', { moduleId }, { locale });
    }
    return module;
  }

  // A Source by its identifier, as the Candidate picked it, or as the Watch named saved it (ADR-0010)
  function findSource(sourceId: string, locale: Locale, watchId?: string): ISource {
    const source = sourceList.find(({ description: { id } }) => id === sourceId);
    if (source === undefined) {
      const knownList = sourceList.map(({ description: { id } }) => id).join(', ');
      throw watchId === undefined
        ? codedError('unknown_source', { sourceId, knownList }, { locale })
        : codedError('unknown_source_of_watch', { sourceId, knownList, watchId }, { locale });
    }
    return source;
  }

  // Through the Channel the Candidate saved, with its saved Parameters, in the Candidate's locale
  async function sendNotification(candidateId: string, composeNotification: NotificationComposer): Promise<void> {
    const { candidate, module, parameters } = await workspace.findNotificationChannel(candidateId);
    const { locale } = candidate;
    await findNotificationChannelModule(module, candidate).send(parameters, composeNotification(locale), locale);
  }

  // A notification not sent undoes and skips nothing: it comes back as the failure to report
  async function trySending(
    candidateId: string,
    composeNotification: NotificationComposer,
    failureOf: (title: string, reason: string, locale: Locale, cause: unknown) => CodedError,
  ): Promise<CodedError | undefined> {
    try {
      await sendNotification(candidateId, composeNotification);
      return undefined;
    } catch (error) {
      const locale = await findLocale(candidateId);
      return failureOf(composeNotification(locale).title, messageOf(error), locale, error);
    }
  }

  function notify(posting: Posting, composeNotification: NotificationComposer): Promise<CodedError | undefined> {
    return trySending(posting.candidateId, composeNotification, (title, reason, locale, cause) =>
      codedError('notification_not_sent', { title, reference: posting.reference, reason }, { locale, cause }),
    );
  }

  // The Detection Summary, which tells several Postings of the Candidate at once
  function notifyCandidate(
    candidateId: string,
    composeNotification: NotificationComposer,
  ): Promise<CodedError | undefined> {
    return trySending(candidateId, composeNotification, (title, reason, locale, cause) =>
      codedError('summary_not_sent', { title, reason }, { locale, cause }),
    );
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
    findLocale,
    findPosting,
    locate,
    notify,
    notifyCandidate,
  };
}

export type ActionContext = Awaited<ReturnType<typeof openContext>>;
