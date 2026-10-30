import type { z } from 'zod/v4';

import { catalogueOf } from '#/domain/catalogue/index.ts';
import {
  SOURCE_MODULE_SCHEMA,
  type JobDescription,
  type ListedPosting,
  type Locale,
  type Parameters,
  type SourceModule,
  type Watch,
} from '#/domain/index.ts';
import { declareParameters, type ParameterShape, type ParametersOf } from '#/parameter/index.ts';

// The contract of the family of the Sources a Watch follows: what each module of
// src/modules/source-<nom>/ declares, and what the rest of the application knows of them (ADR-0010)

// The Postings of the Source that match the Watch, and those that came close: they reveal a new way
// of writing what the Watch looks for
interface ISearchResult {
  matchingList: ListedPosting[];
  nearMissList: ListedPosting[];
}

// A Posting's detail page, and whether the Posting is in the Zone of the Watch, which the Source alone
// knows how to tell
export interface ISourceReadResult {
  jobDescription: JobDescription;
  isInZone: boolean;
}

// What a module of the family declares to defineSource. Its operations read the site with the fetch
// the Source was created with, which the tests replace with recorded responses.
interface ISourceDefinition<TShape extends ParameterShape> {
  id: string;
  name: string;
  parameterSchema: z.ZodObject<TShape>;
  search: (parameters: ParametersOf<TShape>, httpFetch: typeof fetch | undefined) => Promise<ISearchResult>;
  readJobDescription: (
    reference: string,
    parameters: ParametersOf<TShape>,
    httpFetch: typeof fetch | undefined,
  ) => Promise<ISourceReadResult>;
}

// A module as the Detection uses it, whatever its Parameters: each operation parses those of the
// Watch with the module's own schema, since the database keeps them as JSON (ADR-0010). The form of
// a Watch saves only the Parameters its Source accepts.
export interface ISource {
  description: SourceModule;
  parseParameters(rawParameters: unknown, locale: Locale): Parameters;
  search(watch: Watch, locale: Locale): Promise<ISearchResult>;
  readJobDescription(reference: string, watch: Watch, locale: Locale): Promise<ISourceReadResult>;
}

// What a module of the family exports: it creates the Source, bound to the fetch it reads the site with
export type SourceFactory = (httpFetch?: typeof fetch) => ISource;

export function defineSource<TShape extends ParameterShape>({
  id,
  name,
  parameterSchema,
  search,
  readJobDescription,
}: ISourceDefinition<TShape>): SourceFactory {
  const parameters = declareParameters(name, parameterSchema);
  const description = SOURCE_MODULE_SCHEMA.parse({ id, name, parameterList: parameters.parameterList });

  // The front writes the Watches, in the Profile of their Candidate (ADR-0011)
  function parseParametersOf(watch: Watch, locale: Locale): ParametersOf<TShape> {
    return parameters.parse(watch.parameters, (labelList) =>
      catalogueOf({ locale }).error.watchParameters(watch.id, name, labelList),
    );
  }

  return (httpFetch) => ({
    description,
    parseParameters: (rawParameters, locale) =>
      parameters.parseToSave(rawParameters, (labelList) =>
        catalogueOf({ locale }).error.sourceParameters(name, labelList),
      ),
    search: (watch, locale) => search(parseParametersOf(watch, locale), httpFetch),
    readJobDescription: (reference, watch, locale) =>
      readJobDescription(reference, parseParametersOf(watch, locale), httpFetch),
  });
}
