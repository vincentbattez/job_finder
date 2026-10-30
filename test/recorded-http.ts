import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { z } from 'zod/v4';

const FIXTURE_DIRECTORY = path.join(import.meta.dirname, 'fixtures', 'pep');

// API Géo's answer to each city the recorded Offres name, by URL
const API_GEO_FILE = readFileSync(path.join(import.meta.dirname, 'fixtures', 'api-geo', 'communes.json'), 'utf8');
const apiGeoBodyByUrl = z.record(z.string(), z.unknown()).parse(JSON.parse(API_GEO_FILE));
const API_GEO_BODY_BY_URL = new Map(Object.entries(apiGeoBodyByUrl));

export const DSJ_FEED_URL =
  'https://place-ep-recrute.talent-soft.com/handlers/offerRss.ashx?LCID=1036&Rss_Entity=1123&top=1000';

const DETAIL_PAGE_URL_PATTERN = /^https:\/\/place-ep-recrute\.talent-soft\.com\/offre-de-emploi\/emploi_(\d+)\.aspx$/;

interface IRecordedResponse {
  body: Uint8Array<ArrayBuffer> | string;
  status?: number;
}

// As bytes: some pages hold invalid UTF-8
export function readRecordedFile(fileName: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(readFileSync(path.join(FIXTURE_DIRECTORY, fileName)));
}

// The recorded feed without some of its Offres, as it was before they were published
export function feedWithout(referenceList: string[]): string {
  return new TextDecoder()
    .decode(readRecordedFile('flux-dsj.xml'))
    .replaceAll(/<item>[\s\S]*?<\/item>/g, (item) =>
      referenceList.some((reference) => item.includes(`<title>${reference} `)) ? '' : item,
    );
}

function findRecordedResponse(url: string): IRecordedResponse | undefined {
  if (url === DSJ_FEED_URL) {
    return { body: readRecordedFile('flux-dsj.xml') };
  }
  const apiGeoBody = API_GEO_BODY_BY_URL.get(url);
  if (apiGeoBody !== undefined) {
    return { body: JSON.stringify(apiGeoBody) };
  }
  const id = DETAIL_PAGE_URL_PATTERN.exec(url)?.[1];
  const fileName = readdirSync(FIXTURE_DIRECTORY).find((name) => name.endsWith(`-${String(id)}.html`));
  return fileName === undefined ? undefined : { body: readRecordedFile(fileName) };
}

// The HTTP of the PEP Source, answered with the responses recorded on the real site on 2026-10-29:
// the DSJ feed, the detail page of each attaché de justice Offre, and the failures in
// test/fixtures/pep; and API Géo's answer for the city of each of these Offres. A test swaps one
// response through responseByUrl; any other URL fails.
export function createRecordedFetch(responseByUrl: Record<string, IRecordedResponse> = {}) {
  const requestedUrlList: string[] = [];
  const fetch: typeof globalThis.fetch = (input) => {
    const url = input instanceof Request ? input.url : input.toString();
    requestedUrlList.push(url);
    const recorded = responseByUrl[url] ?? findRecordedResponse(url);
    return recorded === undefined
      ? Promise.reject(new Error(`No recorded response for ${url}`))
      : Promise.resolve(new Response(recorded.body, { status: recorded.status ?? 200 }));
  };
  return { fetch, requestedUrlList };
}
