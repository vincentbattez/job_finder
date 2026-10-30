import type { z } from 'zod/v4';

import {
  SOURCE_MODULE_SCHEMA,
  type FicheDePoste,
  type ListedOffre,
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
interface IReadResult {
  ficheDePoste: FicheDePoste;
  isInZone: boolean;
}

// What a module of the family exports, through defineSource. The tests replace fetch with recorded
// responses.
interface ISourceDefinition<TShape extends ParametreShape> {
  id: string;
  name: string;
  parametreSchema: z.ZodObject<TShape>;
  search: (parametres: ParametresOf<TShape>, httpFetch: typeof fetch | undefined) => Promise<ISearchResult>;
  readFicheDePoste: (
    reference: string,
    parametres: ParametresOf<TShape>,
    httpFetch: typeof fetch | undefined,
  ) => Promise<IReadResult>;
}

// A module as the Détection uses it, whatever its Paramètres: each operation parses those of the
// Veille with the module's own schema, since the database keeps them as JSON (ADR-0010)
export interface ISource {
  description: SourceModule;
  search(veille: Veille, httpFetch?: typeof fetch): Promise<ISearchResult>;
  readFicheDePoste(reference: string, veille: Veille, httpFetch?: typeof fetch): Promise<IReadResult>;
}

export function defineSource<TShape extends ParametreShape>({
  id,
  name,
  parametreSchema,
  search,
  readFicheDePoste,
}: ISourceDefinition<TShape>): ISource {
  const description = SOURCE_MODULE_SCHEMA.parse({
    id,
    name,
    parametreList: describeParametres(name, parametreSchema),
  });

  // The config writes the Veilles until the front does (#57)
  function parseParametresOf({ id: veilleId, parametres }: Veille): ParametresOf<TShape> {
    return parseParametres(
      parametreSchema,
      parametres,
      description.parametreList,
      (labelList) =>
        `La Veille ${veilleId} ne donne pas à la Source ${name} les Paramètres qu'elle attend : corriger ${labelList} dans data/config.json.`,
    );
  }

  return {
    description,
    search: (veille, httpFetch) => search(parseParametresOf(veille), httpFetch),
    readFicheDePoste: (reference, veille, httpFetch) =>
      readFicheDePoste(reference, parseParametresOf(veille), httpFetch),
  };
}
