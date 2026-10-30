import type { z } from 'zod/v4';

import {
  NOTIFICATION_CHANNEL_MODULE_SCHEMA,
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

// What the Candidate typed, each Parameter perhaps missing
type TrialOf<TShape extends ParameterShape> = z.output<
  z.ZodObject<{ -readonly [TName in keyof TShape]: z.ZodOptional<TShape[TName]> }>
>;

type ChoiceLister<TShape extends ParameterShape> = (parameters: TrialOf<TShape>) => Promise<ParameterChoice[]>;

// What a module of the family exports, through defineNotificationChannel. Testing the Channel and
// listing the choices of a Parameter try what the Candidate typed, so each Parameter may be missing.
interface INotificationChannelDefinition<TShape extends ParameterShape> {
  id: string;
  name: string;
  parameterSchema: z.ZodObject<TShape>;
  send: (parameters: ParametersOf<TShape>, notification: INotification) => Promise<void>;
  check?: (parameters: TrialOf<TShape>) => Promise<void>;
  listChoicesByParameter?: Partial<Record<keyof TShape, ChoiceLister<TShape>>>;
}

// A module as the actions use it, whatever its Parameters: each operation parses them with the
// module's own schema, since the database keeps them as JSON (ADR-0010)
export interface INotificationChannel {
  description: NotificationChannelModule;
  parseParameters(rawParameters: unknown): Parameters;
  send(rawParameters: unknown, notification: INotification): Promise<void>;
  check(rawParameters: unknown): Promise<void>;
  listChoices(parameterName: string, rawParameters: unknown): Promise<ParameterChoice[]>;
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
  const composeMessage = (labelList: string) =>
    `Le Canal de notification ${name} est incomplet : renseigner ${labelList} dans la section Notifications du Profil.`;

  return {
    description,
    parseParameters: (rawParameters) => parameters.parseToSave(rawParameters, composeMessage),
    send: (rawParameters, notification) => send(parameters.parse(rawParameters, composeMessage), notification),
    async check(rawParameters) {
      if (check === undefined) {
        throw new Error(`Le Canal de notification ${name} ne se teste pas : envoyer une notification de test.`);
      }
      await check(parameters.parseTrial(rawParameters, composeMessage));
    },
    async listChoices(parameterName, rawParameters) {
      const listChoices = Object.entries<ChoiceLister<TShape> | undefined>(listChoicesByParameter).find(
        ([key]) => key === parameterName,
      )?.[1];
      if (listChoices === undefined) {
        throw new Error(
          `Le Paramètre ${labelOf(description.parameterList, parameterName)} du Canal ${name} n'a pas de choix à lister.`,
        );
      }
      return listChoices(parameters.parseTrial(rawParameters, composeMessage));
    },
  };
}

// The Source gives the Deadline as a day, at midnight UTC
const DEADLINE_FORMAT = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC' });

// The jurisdiction of a Posting is its workplace, such as « Tribunal Judiciaire de Béthune »
function jurisdictionOf({ workplace }: Posting): string {
  return workplace ?? 'Juridiction non précisée';
}

function deadlineOf({ deadline }: Posting): string {
  return `Date limite : ${deadline === null ? 'non précisée' : DEADLINE_FORMAT.format(deadline)}`;
}

// One composer per notified event, whatever the Channel
export function composeNewPostingNotification(posting: Posting): INotification {
  return {
    title: 'Nouvelle Offre dans la Zone',
    message: [posting.title, jurisdictionOf(posting), deadlineOf(posting)].join('\n'),
  };
}

// A Repost in the Zone, whose Research starts from that of the Posting it publishes again
export function composeRepostNotification(posting: Posting, repostedPosting: Posting): INotification {
  return {
    title: 'Republication dans la Zone',
    message: [
      posting.title,
      jurisdictionOf(posting),
      `Republication de l'Offre ${repostedPosting.reference} : sa Recherche part de celle de cette Offre`,
      deadlineOf(posting),
    ].join('\n'),
  };
}

// The Candidate already applied to the Posting published again: they decide whether to apply again
export function composeRepostAppliedNotification(posting: Posting, repostedPosting: Posting): INotification {
  return {
    title: "Republication d'une Offre Postulée",
    message: [
      posting.title,
      jurisdictionOf(posting),
      `Republication de l'Offre ${repostedPosting.reference}, Postulée : aucune Recherche lancée`,
      deadlineOf(posting),
    ].join('\n'),
  };
}

// What the Candidate receives when they try their Notification Channel
export function composeTestNotification(candidateName: string): INotification {
  return { title: 'Notification de test', message: `Le Canal de notification de ${candidateName} fonctionne.` };
}

export function composeResearchPreteNotification(posting: Posting): INotification {
  return { title: 'Recherche prête', message: [posting.title, jurisdictionOf(posting)].join('\n') };
}
