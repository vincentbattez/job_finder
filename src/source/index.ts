import type { z } from 'zod/v4';

import {
  PARAMETRES_SCHEMA,
  SOURCE_MODULE_SCHEMA,
  type FicheDePoste,
  type ListedOffre,
  type Parametres,
  type SourceModule,
  type Veille,
} from '#/domain/index.ts';
import { describeParametres, parseParametres, type ParametreShape, type ParametresOf } from '#/parametre/index.ts';

// The contract of the family of the Sources a Veille follows: what each module of
// src/modules/source-<nom>/ declares, and what the rest of the application knows of them (ADR-0010)

// The Offres of the Source that match the Veille, and those that came close: they reveal a new way
// of writing what the Veille looks for
interface ISearchResult {
  matchingList: ListedOffre[];
  nearMissList: ListedOffre[];
}

// An Offre's detail page, and whether the Offre is in the Zone of the Veille, which the Source alone
// knows how to tell
export interface ISourceReadResult {
  ficheDePoste: FicheDePoste;
  isInZone: boolean;
}

// What a module of the family declares to defineSource. Its operations read the site with the fetch
// the Source was created with, which the tests replace with recorded responses.
interface ISourceDefinition<TShape extends ParametreShape> {
  id: string;
  name: string;
  parametreSchema: z.ZodObject<TShape>;
  search: (parametres: ParametresOf<TShape>, httpFetch: typeof fetch | undefined) => Promise<ISearchResult>;
  readFicheDePoste: (
    reference: string,
    parametres: ParametresOf<TShape>,
    httpFetch: typeof fetch | undefined,
  ) => Promise<ISourceReadResult>;
}

// A module as the Détection uses it, whatever its Paramètres: each operation parses those of the
// Veille with the module's own schema, since the database keeps them as JSON (ADR-0010). The form of
// a Veille saves only the Paramètres its Source accepts.
export interface ISource {
  description: SourceModule;
  parseParametres(rawParametres: unknown): Parametres;
  search(veille: Veille): Promise<ISearchResult>;
  readFicheDePoste(reference: string, veille: Veille): Promise<ISourceReadResult>;
}

// What a module of the family exports: it creates the Source, bound to the fetch it reads the site with
export type SourceFactory = (httpFetch?: typeof fetch) => ISource;

export function defineSource<TShape extends ParametreShape>({
  id,
  name,
  parametreSchema,
  search,
  readFicheDePoste,
}: ISourceDefinition<TShape>): SourceFactory {
  const description = SOURCE_MODULE_SCHEMA.parse({
    id,
    name,
    parametreList: describeParametres(name, parametreSchema),
  });

  // The front writes the Veilles, in the Profil of their Candidat (ADR-0011)
  function parseParametresOf({ id: veilleId, parametres }: Veille): ParametresOf<TShape> {
    return parseParametres(
      parametreSchema,
      parametres,
      description.parametreList,
      (labelList) =>
        `La Veille ${veilleId} ne donne pas à la Source ${name} les Paramètres qu'elle attend : corriger ${labelList} dans le Profil de son Candidat.`,
    );
  }

  return (httpFetch) => ({
    description,
    parseParametres: (rawParametres) =>
      PARAMETRES_SCHEMA.parse(
        parseParametres(
          parametreSchema,
          rawParametres,
          description.parametreList,
          (labelList) => `La Source ${name} attend d'autres Paramètres : renseigner ${labelList}.`,
        ),
      ),
    search: (veille) => search(parseParametresOf(veille), httpFetch),
    readFicheDePoste: (reference, veille) => readFicheDePoste(reference, parseParametresOf(veille), httpFetch),
  });
}
