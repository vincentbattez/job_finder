import type { z } from 'zod/v4';

import { tFor } from '#/domain/catalogue/i18n.ts';
import { codedError } from '#/domain/coded-error.ts';
import {
  NOTIFICATION_CHANNEL_MODULE_SCHEMA,
  type DetectionOrigin,
  type ListedPosting,
  type Locale,
  type NotificationChannelModule,
  type ParameterChoice,
  type Parameters,
  type Posting,
} from '#/domain/index.ts';
import { declareParameters, labelOf, type ParameterShape, type ParametersOf } from '#/parameter/index.ts';

// The contract of the family of the Notification Channels: what each module of
// src/modules/notification-<nom>/ declares, and what the rest of the application knows of them (ADR-0010)

// A line of a section, such as a Posting, with what tells it apart and where to read it
export interface INotificationLine {
  text: string;
  detail: string | null;
  url: string | null;
}

// A titled part of a notification, which a Channel with room for a page shows in full, the e-mail
export interface INotificationSection {
  heading: string;
  lineList: INotificationLine[];
}

// What the Candidate reads: the title and the message fit a phone's notification
export interface INotification {
  title: string;
  message: string;
  sectionList?: INotificationSection[];
}

// A notification written once the locale of the Candidate it goes to is known
export type NotificationComposer = (locale: Locale) => INotification;

// What the Candidate typed, each Parameter perhaps missing
type TrialOf<TShape extends ParameterShape> = z.output<
  z.ZodObject<{ -readonly [TName in keyof TShape]: z.ZodOptional<TShape[TName]> }>
>;

type ChoiceLister<TShape extends ParameterShape> = (
  parameters: TrialOf<TShape>,
  locale: Locale,
) => Promise<ParameterChoice[]>;

// What a module of the family exports, through defineNotificationChannel. Testing the Channel and
// listing the choices of a Parameter try what the Candidate typed, so each Parameter may be missing.
// Each operation gets the locale of the Candidate, in which its failures speak.
interface INotificationChannelDefinition<TShape extends ParameterShape> {
  id: string;
  name: string;
  parameterSchema: z.ZodObject<TShape>;
  send: (parameters: ParametersOf<TShape>, notification: INotification, locale: Locale) => Promise<void>;
  check?: (parameters: TrialOf<TShape>, locale: Locale) => Promise<void>;
  listChoicesByParameter?: Partial<Record<keyof TShape, ChoiceLister<TShape>>>;
}

// A module as the actions use it, whatever its Parameters: each operation parses them with the
// module's own schema, since the database keeps them as JSON (ADR-0010)
export interface INotificationChannel {
  description: NotificationChannelModule;
  parseParameters(rawParameters: unknown, locale: Locale): Parameters;
  send(rawParameters: unknown, notification: INotification, locale: Locale): Promise<void>;
  check(rawParameters: unknown, locale: Locale): Promise<void>;
  listChoices(parameterName: string, rawParameters: unknown, locale: Locale): Promise<ParameterChoice[]>;
}

function tOf(locale: Locale) {
  return tFor(locale, 'notification');
}

export function defineNotificationChannel<TShape extends ParameterShape>(
  definition: INotificationChannelDefinition<TShape>,
): INotificationChannel {
  const { id, name, parameterSchema, send, check, listChoicesByParameter = {} } = definition;
  const parameters = declareParameters(name, parameterSchema, Object.keys(listChoicesByParameter));
  const description = NOTIFICATION_CHANNEL_MODULE_SCHEMA.parse({
    id,
    name,
    parameterList: parameters.parameterList,
    isTestable: check !== undefined,
  });
  const composeMessage = (locale: Locale) => (labelList: string[]) => {
    const labels = labelList.map((text) => tOf(locale)('quote', { text })).join(', ');
    return codedError('channel_parameters', { channelName: name, labels }, { locale });
  };

  return {
    description,
    parseParameters: (rawParameters, locale) => parameters.parseToSave(rawParameters, locale, composeMessage(locale)),
    send: (rawParameters, notification, locale) =>
      send(parameters.parse(rawParameters, locale, composeMessage(locale)), notification, locale),
    async check(rawParameters, locale) {
      if (check === undefined) {
        throw codedError('untestable_channel', { channelName: name }, { locale });
      }
      await check(parameters.parseTrial(rawParameters, locale, composeMessage(locale)), locale);
    },
    async listChoices(parameterName, rawParameters, locale) {
      const listChoices = Object.entries<ChoiceLister<TShape> | undefined>(listChoicesByParameter).find(
        ([key]) => key === parameterName,
      )?.[1];
      if (listChoices === undefined) {
        throw codedError(
          'no_choices',
          { parameterLabel: labelOf(description.parameterList, parameterName, locale), channelName: name },
          { locale },
        );
      }
      return listChoices(parameters.parseTrial(rawParameters, locale, composeMessage(locale)), locale);
    },
  };
}

// The jurisdiction of a Posting is its workplace, such as « Tribunal Judiciaire de Béthune »
function jurisdictionOf({ workplace }: Posting, locale: Locale): string {
  return workplace ?? tOf(locale)('missingJurisdiction');
}

// The Deadline line, the Source giving none for some Postings
function deadlineOf({ deadline }: Posting, locale: Locale): string {
  const t = tOf(locale);
  return deadline === null ? t('noDeadline') : t('deadline', { deadline });
}

// A Posting of the Detection Summary; a Repost tells the Posting it publishes again, and whether it was Applied
export interface ISummarizedPosting {
  posting: Posting;
  repost: { repostedReference: string; isApplied: boolean } | null;
}

// What the Detection Summary shows of a Near Miss
type NearMiss = Pick<ListedPosting, 'reference' | 'title' | 'url'>;

// A Watch of the Candidate the Detection covered, with the Source it queries
export interface ISummarizedWatch {
  label: string;
  sourceName: string;
  postingCount: number;
  nearMissList: NearMiss[];
}

export interface IDetectionSummary {
  startedAt: Date;
  origin: DetectionOrigin;
  postingList: ISummarizedPosting[];
  watchList: ISummarizedWatch[];
}

const DETAIL_SEPARATOR = ' · ';

// A phone shows a few lines of a notification: past these Postings, the message counts the others
const PHONE_POSTING_COUNT = 5;

function postingLineOf({ posting, repost }: ISummarizedPosting, locale: Locale): INotificationLine {
  const t = tOf(locale);
  const repostLineList =
    repost === null ? [] : [t(repost.isApplied ? 'repostAppliedLine' : 'repostLine', { ...repost })];
  return {
    text: posting.title,
    detail: [
      jurisdictionOf(posting, locale),
      deadlineOf(posting, locale),
      t('reference', { reference: posting.reference }),
      ...repostLineList,
    ].join(DETAIL_SEPARATOR),
    url: posting.url,
  };
}

// The Near Misses of every Watch, once each: two Watches of a Source list the same titles
function nearMissesOf(watchList: ISummarizedWatch[]): NearMiss[] {
  const nearMissList = watchList.flatMap((watch) => watch.nearMissList);
  return nearMissList.filter(
    ({ reference }, index) => nearMissList.findIndex((nearMiss) => nearMiss.reference === reference) === index,
  );
}

// The one notification of a Detection for a Candidate: on the phone, its Postings and when it ran; in
// full, also its Watches and its Near Misses
export function composeDetectionSummary({
  startedAt,
  origin,
  postingList,
  watchList,
}: IDetectionSummary): NotificationComposer {
  return (locale) => {
    const t = tOf(locale);
    const nearMissList = nearMissesOf(watchList);
    const nearMissCountList = nearMissList.length === 0 ? [] : [t('nearMissCount', { count: nearMissList.length })];
    const sectionList: INotificationSection[] = [
      {
        heading: t('newPostingsHeading', { count: postingList.length }),
        lineList: postingList.map((summarizedPosting) => postingLineOf(summarizedPosting, locale)),
      },
      {
        heading: t('detectionHeading'),
        lineList: [{ text: t('startedAt', { startedAt }), detail: t(`originByOrigin.${origin}`), url: null }],
      },
      {
        heading: t('watchesHeading'),
        lineList: watchList.map(({ label, sourceName, postingCount, nearMissList: watchNearMissList }) => ({
          text: label,
          detail: [
            sourceName,
            t('newPostingCount', { count: postingCount }),
            t('nearMissCount', { count: watchNearMissList.length }),
          ].join(DETAIL_SEPARATOR),
          url: null,
        })),
      },
    ];
    return {
      title: t('newPostingCount', { count: postingList.length }),
      message: [
        ...postingList
          .slice(0, PHONE_POSTING_COUNT)
          .map(({ posting, repost }) =>
            [
              t('postingLine', { title: posting.title, jurisdiction: jurisdictionOf(posting, locale) }),
              ...(repost === null ? [] : [t(repost.isApplied ? 'repostAppliedTag' : 'repostTag')]),
            ].join(DETAIL_SEPARATOR),
          ),
        ...(postingList.length > PHONE_POSTING_COUNT
          ? [t('morePostings', { count: postingList.length - PHONE_POSTING_COUNT })]
          : []),
        [t('detectionLine', { startedAt }), ...nearMissCountList].join(DETAIL_SEPARATOR),
      ].join('\n'),
      sectionList:
        nearMissList.length === 0
          ? sectionList
          : [
              ...sectionList,
              {
                heading: t('nearMissesHeading'),
                lineList: nearMissList.map(({ reference, title, url }) => ({
                  text: title,
                  detail: t('reference', { reference }),
                  url,
                })),
              },
            ],
    };
  };
}

// What the Candidate receives when they try their Notification Channel
export function composeTestNotification(candidateName: string): NotificationComposer {
  return (locale) => {
    const t = tOf(locale);
    return { title: t('testTitle'), message: t('testMessage', { candidateName }) };
  };
}

// A Research queued automatically failed: the reason is its code's message, already in the
// Candidate's locale
export function composeResearchFailedNotification(posting: Posting, reason: string): NotificationComposer {
  return (locale) => ({
    title: tOf(locale)('researchFailedTitle'),
    message: [
      posting.title,
      jurisdictionOf(posting, locale),
      reason,
      tOf(locale)('researchFailedLine', { reference: posting.reference }),
    ].join('\n'),
  });
}

export function composeResearchReadyNotification(posting: Posting): NotificationComposer {
  return (locale) => ({
    title: tOf(locale)('researchReadyTitle'),
    message: [posting.title, jurisdictionOf(posting, locale)].join('\n'),
  });
}
