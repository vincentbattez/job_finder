import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createActions, type Actions } from '#/actions/index.ts';
import type { Detection, Offre } from '#/domain/index.ts';

import { createDataDirectory } from './data-directory.ts';
import { createFakeCanalNotification } from './fake-canal-notification.ts';
import { LEA_VEILLE_ID } from './lea.ts';
import { createRecordedFetch, DSJ_FEED_URL, readRecordedFile } from './recorded-http.ts';

// Every attaché de justice offer of the DSJ feed recorded on 2026-10-29, counted by hand from its
// titles, « (e) » and « .e » forms included
const ATTACHE_DE_JUSTICE_REFERENCE_LIST = [
  '2025-2093618',
  '2025-2102087',
  '2025-2109753',
  '2026-2199164',
  '2026-2215099',
  '2026-2231960',
  '2026-2233332',
  '2026-2278425',
  '2026-2285257',
  '2026-2285305',
  '2026-2289933',
  '2026-2289985',
  '2026-2290529',
  '2026-2315264',
  '2026-2315312',
  '2026-2315357',
  '2026-2316771',
  '2026-2316951',
  '2026-2323507',
  '2026-2338409',
  '2026-2340735',
  '2026-2343861',
  '2026-2343929',
  '2026-2344393',
  '2026-2344455',
  '2026-2346473',
  '2026-2350473',
  '2026-2359590',
  '2026-2360386',
  '2026-2360394',
  '2026-2360411',
  '2026-2360445',
  '2026-2380466',
  '2026-2382839',
  '2026-2382842',
  '2026-2383786',
  '2026-2395585',
  '2026-2396309',
  '2026-2399015',
  '2026-2400177',
  '2026-2402432',
  '2026-2404434',
  '2026-2407111',
  '2026-2409178',
  '2026-2409247',
  '2026-2409326',
  '2026-2409332',
  '2026-2410880',
  '2026-2412591',
  '2026-2412620',
  '2026-2416437',
  '2026-2417004',
  '2026-2420931',
  '2026-2426147',
  '2026-2426262',
  '2026-2426271',
  '2026-2427704',
  '2026-2430337',
  '2026-2430585',
  '2026-2439735',
  '2026-2441012',
  '2026-2445183',
  '2026-2445213',
  '2026-2445218',
  '2026-2445223',
  '2026-2445266',
  '2026-2445584',
  '2026-2445586',
  '2026-2445593',
  '2026-2445600',
  '2026-2445609',
  '2026-2445629',
  '2026-2445637',
  '2026-2445671',
  '2026-2448056',
  '2026-2448209',
  '2026-2448213',
  '2026-2448215',
  '2026-2448220',
  '2026-2448225',
  '2026-2453874',
];

// Expirée depends on the day: the clock stays on the day the responses were recorded
beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-29T12:00:00Z'));
});

afterAll(() => {
  vi.useRealTimers();
});

describe('detection on the responses recorded on 2026-10-29', () => {
  let dataDirectory: string;
  let actions: Actions;
  let detectionList: Detection[];

  beforeAll(async () => {
    dataDirectory = createDataDirectory();
    actions = await createActions({ dataDirectory, fetch: createRecordedFetch().fetch });
    detectionList = await actions.detect();
  });

  async function findOffre(reference: string): Promise<Offre | undefined> {
    const offreList = await actions.listOffres({ candidateId: 'lea' });
    return offreList.find((offre) => offre.reference === reference);
  }

  it('retains every attaché de justice offer of the feed, and no known false positive', async () => {
    const offreList = await actions.listOffres({ candidateId: 'lea' });

    expect(offreList.map((offre) => offre.reference).toSorted((left, right) => left.localeCompare(right))).toEqual(
      ATTACHE_DE_JUSTICE_REFERENCE_LIST,
    );
  });

  it('places in the Zone the Offres of the courts of appeal of Douai and Amiens, whatever department they show', async () => {
    const offreList = await actions.listOffres({ candidateId: 'lea' });

    expect(offreList.filter((offre) => offre.isInZone).map((offre) => offre.reference)).toEqual([
      '2026-2445609',
      '2026-2445600',
      '2026-2445183',
      '2026-2360445',
      '2026-2360411',
      '2026-2350473',
      '2026-2338409',
      '2026-2231960',
      '2026-2199164',
    ]);
  });

  it('records the fields of the detail page as published', async () => {
    expect(await findOffre('2026-2445600')).toMatchObject({
      candidateId: 'lea',
      reference: '2026-2445600',
      title: 'Attaché de justice affecté auprès des magistrats du siège – Tribunal pour enfants- TJ BETHUNE',
      url: 'https://choisirleservicepublic.gouv.fr/offre-emploi/2026-2445600/?tracking=1&idOrigine=502',
      publishedAt: new Date('2026-10-20T09:28:40Z'),
      dateLimite: new Date('2026-11-20'),
      employer: "Cour d'Appel de Douai",
      workplace: 'Tribunal Judiciaire de Béthune',
      applicationEmail: 'p.tj-bethune@justice.fr',
      contact1: 'Madame Odile SIMART, présidente du Tribunal Judiciaire de Béthune',
      contact2: 'secrétariat en copie : sec.p.tj-bethune@justice.fr',
      statut: 'a_traiter',
      isInZone: true,
      isExpiree: false,
    });
  });

  it('locates an Offre in the commune of its ville, with its région and coordinates', async () => {
    expect(await findOffre('2026-2445600')).toMatchObject({
      city: 'Béthune',
      region: 'Hauts-de-France',
      latitude: 50.5299,
      longitude: 2.6438,
    });
    // The commune's own name, whatever the spelling of the lieu d'affectation
    expect(await findOffre('2026-2350473')).toMatchObject({ city: 'Boulogne-sur-Mer', region: 'Hauts-de-France' });
  });

  it('locates every Offre, those out of the Zone too', async () => {
    const offreList = await actions.listOffres({ candidateId: 'lea' });

    expect(offreList.filter(({ latitude, longitude }) => latitude === null || longitude === null)).toEqual([]);
    expect(await findOffre('2026-2430337')).toMatchObject({
      isInZone: false,
      city: 'Nouméa',
      region: 'Nouvelle-Calédonie',
      latitude: -22.3363,
      longitude: 166.4076,
    });
  });

  it('keeps an application email written in free text as published', async () => {
    expect(await findOffre('2026-2199164')).toMatchObject({
      applicationEmail: 'Laurent DUMAINE, Procureur de la République : pr.tj-avesnes-sur-helpe@justice.fr',
    });
  });

  it('saves the Fiche de poste in the folder of the Offre, named by its reference and title', () => {
    const fichePoste = readFileSync(
      path.join(
        dataDirectory,
        'candidates/lea/offres',
        '2026-2445600-attache-de-justice-affecte-aupres-des-magistrats-du-siege-tribunal-pour-enfants-tj-bethune',
        'fiche-de-poste.md',
      ),
      'utf8',
    );

    expect(fichePoste).toContain('### Description du poste');
    expect(fichePoste).toContain(
      'La présente fiche de poste concerne une affectation auprès du tribunal pour enfants.',
    );
  });

  it('imports the Offres already online on the first launch', () => {
    expect(detectionList).toMatchObject([{ veilleId: LEA_VEILLE_ID, isFirstLaunch: true }]);
    expect(detectionList[0]?.newOffreList).toHaveLength(ATTACHE_DE_JUSTICE_REFERENCE_LIST.length);
  });

  it('reports the titles set aside by a narrow margin', () => {
    expect(detectionList[0]?.nearMissList.map(({ reference, title }) => `${reference} ${title}`)).toEqual([
      "2026-2432800 Attaché d'administration- chef de cabinet procureur en charge de la communication   du TJ de Paris",
      '2026-2431315 Chef du pôle des attachés de justice et des assistants spécialisés - RHG6 (H/F)',
      "2026-2282889 Attaché d'administration : CHEF(FE) DE CABINET DU PRESIDENT DU TRIBUNAL DE BETHUNE",
      "2026-2354768 ATTACHE - CHEF(FE) DE CABINET DE LA PROCUREURE GENERALE DE LA COUR D'APPEL D'ANGERS",
    ]);
  });
});

async function detectTwice(responseByUrl: Parameters<typeof createRecordedFetch>[0] = {}) {
  const dataDirectory = createDataDirectory();
  const firstActions = await createActions({ dataDirectory, fetch: createRecordedFetch().fetch });
  await firstActions.detect();
  const recordedFetch = createRecordedFetch(responseByUrl);
  const actions = await createActions({ dataDirectory, fetch: recordedFetch.fetch });
  return { actions, detectionList: await actions.detect(), requestedUrlList: recordedFetch.requestedUrlList };
}

describe('a second detection', () => {
  it('never creates a known Offre again, even when the site changed its publication date', async () => {
    const republishedFeed = new TextDecoder()
      .decode(readRecordedFile('flux-dsj.xml'))
      .replaceAll(/<pubDate>[^<]*<\/pubDate>/g, '<pubDate>Fri, 30 Oct 2026 08:00:00 Z</pubDate>');

    const { actions, detectionList } = await detectTwice({ [DSJ_FEED_URL]: { body: republishedFeed } });

    expect(detectionList).toMatchObject([{ isFirstLaunch: false, newOffreList: [] }]);
    const offreList = await actions.listOffres({ candidateId: 'lea' });
    expect(offreList).toHaveLength(ATTACHE_DE_JUSTICE_REFERENCE_LIST.length);
    expect(offreList.find(({ reference }) => reference === '2026-2445600')?.publishedAt).toEqual(
      new Date('2026-10-20T09:28:40Z'),
    );
  });

  it('locates the Offres saved before they had a ville', async () => {
    const dataDirectory = createDataDirectory();
    const firstActions = await createActions({ dataDirectory, fetch: createRecordedFetch().fetch });
    await firstActions.detect();
    // As the Offres detected before the ville existed: no ville, no région, no coordinates
    new DatabaseSync(path.join(dataDirectory, 'job_finder.sqlite')).exec(
      'UPDATE "Offre" SET "city" = NULL, "region" = NULL, "latitude" = NULL, "longitude" = NULL',
    );
    const actions = await createActions({ dataDirectory, fetch: createRecordedFetch().fetch });

    await actions.detect();

    const offreList = await actions.listOffres({ candidateId: 'lea' });
    expect(offreList.filter(({ latitude }) => latitude === null)).toEqual([]);
    expect(offreList.find(({ reference }) => reference === '2026-2445600')).toMatchObject({
      city: 'Béthune',
      region: 'Hauts-de-France',
      latitude: 50.5299,
      longitude: 2.6438,
    });
  });

  it('downloads the detail page of an Offre only once', async () => {
    const { requestedUrlList } = await detectTwice();

    expect(requestedUrlList).toEqual([DSJ_FEED_URL]);
  });
});

describe('a first launch cut off mid-way', () => {
  // The Offres saved before the cut stay, but the first launch is over only once a Détection of the
  // Veille went through: the next one imports the rest without triggering anything either
  it('ends with the next Détection, which triggers nothing for the Offres left', async () => {
    const dataDirectory = createDataDirectory();
    const cutFetch = createRecordedFetch({
      'https://place-ep-recrute.talent-soft.com/offre-de-emploi/emploi_2445600.aspx': { body: '', status: 500 },
    }).fetch;
    const cutActions = await createActions({ dataDirectory, fetch: cutFetch });
    await expect(cutActions.detect()).rejects.toThrow(/HTTP 500/);
    const notificationChannel = createFakeCanalNotification();
    const actions = await createActions({
      dataDirectory,
      fetch: createRecordedFetch().fetch,
      canalNotificationList: notificationChannel.canalNotificationList,
    });

    const detectionList = await actions.detect();

    expect(detectionList).toMatchObject([{ isFirstLaunch: true }]);
    expect(detectionList[0]?.newOffreList.map(({ reference }) => reference)).toContain('2026-2445609');
    expect(notificationChannel.sentList).toEqual([]);
    expect(await actions.runQueuedJobs()).toEqual([]);
    const nextDetectionList = await actions.detect();
    expect(nextDetectionList).toMatchObject([{ isFirstLaunch: false, newOffreList: [] }]);
  });
});

const BETHUNE_API_GEO_URL =
  'https://geo.api.gouv.fr/communes?nom=B%C3%A9thune&fields=nom,centre,region&boost=population&limit=5';

describe('a ville API Géo does not know', () => {
  it('keeps it as read, without coordinates, and looks it up again at the next detection', async () => {
    const dataDirectory = createDataDirectory();
    const recordedFetch = createRecordedFetch({ [BETHUNE_API_GEO_URL]: { body: '[]' } });
    const firstActions = await createActions({ dataDirectory, fetch: recordedFetch.fetch });
    await firstActions.detect();
    const firstOffreList = await firstActions.listOffres({ candidateId: 'lea' });
    expect(firstOffreList.find(({ reference }) => reference === '2026-2445600')).toMatchObject({
      city: 'Béthune',
      region: null,
      latitude: null,
      longitude: null,
    });
    const actions = await createActions({ dataDirectory, fetch: createRecordedFetch().fetch });

    await actions.detect();

    const offreList = await actions.listOffres({ candidateId: 'lea' });
    expect(offreList.find(({ reference }) => reference === '2026-2445600')).toMatchObject({
      city: 'Béthune',
      latitude: 50.5299,
    });
  });
});

describe('a detection that fails visibly', () => {
  it.each([
    {
      failure: 'the site ignored the filter of the feed',
      response: { body: readRecordedFile('flux-filtre-ignore.xml') },
      message: /ne reprend pas « Direction des Services Judiciaires »/,
    },
    {
      failure: 'the feed is empty',
      response: { body: readRecordedFile('flux-vide.xml') },
      message: /flux PEP est vide/,
    },
    {
      failure: 'the site answers an HTTP error',
      response: { body: readRecordedFile('erreur-http-500.html'), status: 500 },
      message: /HTTP 500/,
    },
  ])('stops when $failure', async ({ response, message }) => {
    const recordedFetch = createRecordedFetch({ [DSJ_FEED_URL]: response });
    const actions = await createActions({ dataDirectory: createDataDirectory(), fetch: recordedFetch.fetch });

    await expect(actions.detect()).rejects.toThrow(message);
  });

  it('stops when API Géo answers an HTTP error', async () => {
    const recordedFetch = createRecordedFetch({ [BETHUNE_API_GEO_URL]: { body: '', status: 503 } });
    const actions = await createActions({ dataDirectory: createDataDirectory(), fetch: recordedFetch.fetch });

    await expect(actions.detect()).rejects.toThrow(/API Géo a répondu HTTP 503/);
  });
});

// The feed holds private-use characters (Word bullets), and the site sometimes cuts a character in
// half: here the « é » of Béthune loses its second byte
it('reads pages holding invalid UTF-8 and private-use characters', async () => {
  const page = readRecordedFile('offre-2026-2445600.html');
  const workplaceIndex = Buffer.from(page).indexOf('Tribunal Judiciaire de Béthune</p>');
  page[workplaceIndex + 'Tribunal Judiciaire de B'.length + 1] = 'e'.codePointAt(0) ?? 0;
  const recordedFetch = createRecordedFetch({
    'https://place-ep-recrute.talent-soft.com/offre-de-emploi/emploi_2445600.aspx': { body: page },
  });
  const actions = await createActions({ dataDirectory: createDataDirectory(), fetch: recordedFetch.fetch });

  await actions.detect();

  const offreList = await actions.listOffres({ candidateId: 'lea' });
  expect(offreList.find(({ reference }) => reference === '2026-2445600')?.workplace).toBe(
    'Tribunal Judiciaire de B\u{FFFD}ethune',
  );
});
