import type { z } from 'zod/v4';

import {
  CANAL_NOTIFICATION_MODULE_SCHEMA,
  PARAMETRES_SCHEMA,
  type CanalNotificationModule,
  type Offre,
  type ParametreChoice,
  type Parametres,
} from '#/domain/index.ts';
import {
  describeParametres,
  labelOf,
  parseParametres,
  type ParametreShape,
  type ParametresOf,
} from '#/parametre/index.ts';

// The contract of the family of the Canaux de notification: what each module of
// src/modules/notification-<nom>/ declares, and what the rest of the application knows of them (ADR-0010)

// What the Candidat reads on their phone
export interface INotification {
  title: string;
  message: string;
}

// What the Candidat typed, each Paramètre perhaps missing
type TrialOf<TShape extends ParametreShape> = z.output<
  z.ZodObject<{ -readonly [TName in keyof TShape]: z.ZodOptional<TShape[TName]> }>
>;

type ChoiceLister<TShape extends ParametreShape> = (parametres: TrialOf<TShape>) => Promise<ParametreChoice[]>;

// What a module of the family exports, through defineCanalNotification. Testing the Canal and
// listing the choices of a Paramètre try what the Candidat typed, so each Paramètre may be missing.
interface ICanalNotificationDefinition<TShape extends ParametreShape> {
  id: string;
  name: string;
  parametreSchema: z.ZodObject<TShape>;
  send: (parametres: ParametresOf<TShape>, notification: INotification) => Promise<void>;
  check?: (parametres: TrialOf<TShape>) => Promise<void>;
  listChoicesByParametre?: Partial<Record<keyof TShape, ChoiceLister<TShape>>>;
}

// A module as the actions use it, whatever its Paramètres: each operation parses them with the
// module's own schema, since the database keeps them as JSON (ADR-0010)
export interface ICanalNotification {
  description: CanalNotificationModule;
  parseParametres(rawParametres: unknown): Parametres;
  send(rawParametres: unknown, notification: INotification): Promise<void>;
  check(rawParametres: unknown): Promise<void>;
  listChoices(parametreName: string, rawParametres: unknown): Promise<ParametreChoice[]>;
}

export function defineCanalNotification<TShape extends ParametreShape>(
  definition: ICanalNotificationDefinition<TShape>,
): ICanalNotification {
  const { id, name, parametreSchema, send, check, listChoicesByParametre = {} } = definition;
  const description = CANAL_NOTIFICATION_MODULE_SCHEMA.parse({
    id,
    name,
    parametreList: describeParametres(name, parametreSchema, Object.keys(listChoicesByParametre)),
    isTestable: check !== undefined,
  });

  // The Paramètres missing or wrong, in the words of the form
  function parseWith<T extends z.ZodType>(schema: T, rawParametres: unknown): z.infer<T> {
    return parseParametres(
      schema,
      rawParametres,
      description.parametreList,
      (labelList) =>
        `Le Canal de notification ${name} est incomplet : renseigner ${labelList} dans la section Notifications du Profil.`,
    );
  }

  return {
    description,
    parseParametres: (rawParametres) => PARAMETRES_SCHEMA.parse(parseWith(parametreSchema, rawParametres)),
    send: (rawParametres, notification) => send(parseWith(parametreSchema, rawParametres), notification),
    async check(rawParametres) {
      if (check === undefined) {
        throw new Error(`Le Canal de notification ${name} ne se teste pas : envoyer une notification de test.`);
      }
      await check(parseWith(parametreSchema.partial(), rawParametres));
    },
    async listChoices(parametreName, rawParametres) {
      const listChoices = Object.entries<ChoiceLister<TShape> | undefined>(listChoicesByParametre).find(
        ([candidate]) => candidate === parametreName,
      )?.[1];
      if (listChoices === undefined) {
        throw new Error(
          `Le Paramètre ${labelOf(description.parametreList, parametreName)} du Canal ${name} n'a pas de choix à lister.`,
        );
      }
      return listChoices(parseWith(parametreSchema.partial(), rawParametres));
    },
  };
}

// The Source gives the Date limite as a day, at midnight UTC
const DATE_LIMITE_FORMAT = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC' });

// The juridiction of an Offre is its workplace, such as « Tribunal Judiciaire de Béthune »
function juridictionOf({ workplace }: Offre): string {
  return workplace ?? 'Juridiction non précisée';
}

function dateLimiteOf({ dateLimite }: Offre): string {
  return `Date limite : ${dateLimite === null ? 'non précisée' : DATE_LIMITE_FORMAT.format(dateLimite)}`;
}

// One composer per notified event, whatever the Canal
export function composeNouvelleOffreNotification(offre: Offre): INotification {
  return {
    title: 'Nouvelle Offre dans la Zone',
    message: [offre.title, juridictionOf(offre), dateLimiteOf(offre)].join('\n'),
  };
}

// A Republication in the Zone, whose Recherche starts from that of the Offre it publishes again
export function composeRepublicationNotification(offre: Offre, republishedOffre: Offre): INotification {
  return {
    title: 'Republication dans la Zone',
    message: [
      offre.title,
      juridictionOf(offre),
      `Republication de l'Offre ${republishedOffre.reference} : sa Recherche part de celle de cette Offre`,
      dateLimiteOf(offre),
    ].join('\n'),
  };
}

// The Candidat already applied to the Offre published again: they decide whether to apply again
export function composeRepublicationPostuleeNotification(offre: Offre, republishedOffre: Offre): INotification {
  return {
    title: "Republication d'une Offre Postulée",
    message: [
      offre.title,
      juridictionOf(offre),
      `Republication de l'Offre ${republishedOffre.reference}, Postulée : aucune Recherche lancée`,
      dateLimiteOf(offre),
    ].join('\n'),
  };
}

// What the Candidat receives when they try their Canal de notification
export function composeTestNotification(candidatName: string): INotification {
  return { title: 'Notification de test', message: `Le Canal de notification de ${candidatName} fonctionne.` };
}

export function composeRecherchePreteNotification(offre: Offre): INotification {
  return { title: 'Recherche prête', message: [offre.title, juridictionOf(offre)].join('\n') };
}
