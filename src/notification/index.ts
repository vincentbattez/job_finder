import type { z } from 'zod/v4';

import { catalogueOf } from '#/domain/catalogue/index.ts';
import {
  NOTIFICATION_CHANNEL_MODULE_SCHEMA,
  type Locale,
  type NotificationChannelModule,
  type ParameterChoice,
  type Parameters,
  type Posting,
} from '#/domain/index.ts';
import { declareParameters, labelOf, type ParameterShape, type ParametersOf } from '#/parameter/index.ts';

// The contract of the family of the Notification Channels: what each module of
// src/modules/notification-<nom>/ declares, and what the rest of the application knows of them (ADR-0010)

// What the Candidate reads on their phone
export interface INotification {
  title: string;
  message: string;
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

function copyOf(locale: Locale) {
  return catalogueOf({ locale }).notification;
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
  const composeMessage = (locale: Locale) => (labelList: string[]) => copyOf(locale).incompleteChannel(name, labelList);

  return {
    description,
    parseParameters: (rawParameters, locale) => parameters.parseToSave(rawParameters, composeMessage(locale)),
    send: (rawParameters, notification, locale) =>
      send(parameters.parse(rawParameters, composeMessage(locale)), notification, locale),
    async check(rawParameters, locale) {
      if (check === undefined) {
        throw new Error(copyOf(locale).untestableChannel(name));
      }
      await check(parameters.parseTrial(rawParameters, composeMessage(locale)), locale);
    },
    async listChoices(parameterName, rawParameters, locale) {
      const listChoices = Object.entries<ChoiceLister<TShape> | undefined>(listChoicesByParameter).find(
        ([key]) => key === parameterName,
      )?.[1];
      if (listChoices === undefined) {
        throw new Error(copyOf(locale).noChoices(labelOf(description.parameterList, parameterName), name));
      }
      return listChoices(parameters.parseTrial(rawParameters, composeMessage(locale)), locale);
    },
  };
}

// The jurisdiction of a Posting is its workplace, such as « Tribunal Judiciaire de Béthune »
function jurisdictionOf({ workplace }: Posting, locale: Locale): string {
  return workplace ?? catalogueOf({ locale }).notification.missingJurisdiction;
}

// One composer per notified event, whatever the Channel
export function composeNewPostingNotification(posting: Posting): NotificationComposer {
  return (locale) => {
    const copy = catalogueOf({ locale }).notification;
    return {
      title: copy.newPostingTitle,
      message: [posting.title, jurisdictionOf(posting, locale), copy.deadline(posting.deadline)].join('\n'),
    };
  };
}

// A Repost in the Zone, whose Research starts from that of the Posting it publishes again
export function composeRepostNotification(posting: Posting, repostedPosting: Posting): NotificationComposer {
  return (locale) => {
    const copy = catalogueOf({ locale }).notification;
    return {
      title: copy.repostTitle,
      message: [
        posting.title,
        jurisdictionOf(posting, locale),
        copy.repostLine(repostedPosting.reference),
        copy.deadline(posting.deadline),
      ].join('\n'),
    };
  };
}

// The Candidate already applied to the Posting published again: they decide whether to apply again
export function composeRepostAppliedNotification(posting: Posting, repostedPosting: Posting): NotificationComposer {
  return (locale) => {
    const copy = catalogueOf({ locale }).notification;
    return {
      title: copy.repostAppliedTitle,
      message: [
        posting.title,
        jurisdictionOf(posting, locale),
        copy.repostAppliedLine(repostedPosting.reference),
        copy.deadline(posting.deadline),
      ].join('\n'),
    };
  };
}

// What the Candidate receives when they try their Notification Channel
export function composeTestNotification(candidateName: string): NotificationComposer {
  return (locale) => {
    const copy = catalogueOf({ locale }).notification;
    return { title: copy.testTitle, message: copy.testMessage(candidateName) };
  };
}

export function composeResearchReadyNotification(posting: Posting): NotificationComposer {
  return (locale) => ({
    title: catalogueOf({ locale }).notification.researchReadyTitle,
    message: [posting.title, jurisdictionOf(posting, locale)].join('\n'),
  });
}
