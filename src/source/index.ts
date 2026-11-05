import type { z } from 'zod/v4';

import { tFor } from '#/domain/catalogue/i18n.ts';
import { codedError } from '#/domain/coded-error.ts';
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
// src/modules/source-<name>/ declares, and what the rest of the application knows of them (ADR-0010)

// The Postings of the Source that match the Watch, and those that came close: they reveal a new way
// of writing what the Watch looks for. The references of every Posting the Source still publishes,
// whatever their title, tell which stored Postings are Unpublished.
interface ISearchResult {
  matchingList: ListedPosting[];
  nearMissList: ListedPosting[];
  publishedReferenceList: string[];
}

// What a module of the family declares to defineSource. Its operations read the site with the fetch
// the Source was created with, which the tests replace with recorded responses, and tell a failure in
// the locale of the Watch's Candidate.
interface ISourceDefinition<TShape extends ParameterShape> {
  id: string;
  name: string;
  parameterSchema: z.ZodObject<TShape>;
  search: (
    parameters: ParametersOf<TShape>,
    httpFetch: typeof fetch | undefined,
    locale: Locale,
  ) => Promise<ISearchResult>;
  readJobDescription: (
    reference: string,
    parameters: ParametersOf<TShape>,
    httpFetch: typeof fetch | undefined,
    locale: Locale,
  ) => Promise<JobDescription>;
  // The Start Date a Job Description the Source stored gives, so a Posting saved before the Start
  // Date existed gets it too; null when it says nothing
  readStartDate: (markdown: string) => Date | null;
}

// A module as the Detection uses it, whatever its Parameters: each operation parses those of the
// Watch with the module's own schema, since the database keeps them as JSON (ADR-0010). The form of
// a Watch saves only the Parameters its Source accepts.
export interface ISource {
  description: SourceModule;
  parseParameters(rawParameters: unknown, locale: Locale): Parameters;
  search(watch: Watch, locale: Locale): Promise<ISearchResult>;
  readJobDescription(reference: string, watch: Watch, locale: Locale): Promise<JobDescription>;
  readStartDate(markdown: string): Date | null;
}

// What a module of the family exports: it creates the Source, bound to the fetch it reads the site with
export type SourceFactory = (httpFetch?: typeof fetch) => ISource;

// The labels of the Parameters to correct, each quoted, in the words of the locale
function quoteLabels(labelList: string[], locale: Locale): string {
  const t = tFor(locale, 'error');
  return labelList.map((text) => t('quote', { text })).join(', ');
}

export function defineSource<TShape extends ParameterShape>({
  id,
  name,
  parameterSchema,
  search,
  readJobDescription,
  readStartDate,
}: ISourceDefinition<TShape>): SourceFactory {
  const parameters = declareParameters(name, parameterSchema);
  const description = SOURCE_MODULE_SCHEMA.parse({ id, name, parameterList: parameters.parameterList });

  // The front writes the Watches, in the Profile of their Candidate (ADR-0011)
  function parseParametersOf(watch: Watch, locale: Locale): ParametersOf<TShape> {
    return parameters.parse(watch.parameters, locale, (labelList) =>
      codedError(
        'watch_parameters',
        { watchId: watch.id, sourceName: name, labels: quoteLabels(labelList, locale) },
        { locale },
      ),
    );
  }

  return (httpFetch) => ({
    description,
    parseParameters: (rawParameters, locale) =>
      parameters.parseToSave(rawParameters, locale, (labelList) =>
        codedError('source_parameters', { sourceName: name, labels: quoteLabels(labelList, locale) }, { locale }),
      ),
    search: (watch, locale) => search(parseParametersOf(watch, locale), httpFetch, locale),
    readJobDescription: (reference, watch, locale) =>
      readJobDescription(reference, parseParametersOf(watch, locale), httpFetch, locale),
    readStartDate,
  });
}
