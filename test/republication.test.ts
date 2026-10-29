import { copyFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createActions, type Actions } from '#/actions/index.ts';

import { createFakeAiSession } from './fake-ai-session.ts';
import { createFakeNotificationChannel } from './fake-notification-channel.ts';
import { createRecordedFetch, DSJ_FEED_URL, feedWithout } from './recorded-http.ts';

const EXAMPLE_CONFIG_PATH = path.join(import.meta.dirname, '..', 'config.example.json');

// The Boulogne parquet Poste, published as 2026-2231960 then again as 2026-2338409, both in Léa's
// Zone (responses recorded on 2026-10-29)
const REFERENCE = '2026-2231960';
const REPUBLICATION_REFERENCE = '2026-2338409';
const OFFRE_DIRECTORY_NAME =
  '2026-2231960-attache-de-justice-affecte-aupres-des-magistrats-du-parquet-tj-boulogne-sur-mer';

const RECHERCHE_RUN = {
  fileByName: {
    'recherche.md': '# Recherche\n\nLe parquet de Boulogne-sur-Mer.\n\n## Sources\n\n- https://www.justice.fr/\n',
  },
};
const LETTRE_RUN = {
  fileByName: {
    'brouillon.md': 'Madame la Procureure,\n',
    'destinataires.json': JSON.stringify({
      to: { email: 'chcab.pr.tj-boulogne-sur-mer@justice.fr', source: 'applicationEmail' },
      ccList: [],
      salutation: { text: 'Madame la Procureure,', source: 'contact1' },
      justification: 'Le mail de candidature est celui du cabinet de la procureure.',
    }),
  },
};

function createDataDirectory(): string {
  const dataDirectory = mkdtempSync(path.join(tmpdir(), 'job-finder-'));
  copyFileSync(EXAMPLE_CONFIG_PATH, path.join(dataDirectory, 'config.json'));
  return dataDirectory;
}

// A first Détection on the feed as it was before the Republication, then the actions for the next
// one, on the feed as recorded
async function detectBeforeRepublication(aiSession = createFakeAiSession()) {
  const dataDirectory = createDataDirectory();
  const notificationChannel = createFakeNotificationChannel();
  const earlierFetch = createRecordedFetch({ [DSJ_FEED_URL]: { body: feedWithout([REPUBLICATION_REFERENCE]) } });
  const earlierActions = await createActions({
    dataDirectory,
    aiSession,
    fetch: earlierFetch.fetch,
    notificationChannel,
  });
  await earlierActions.detect();
  const actions = await createActions({
    dataDirectory,
    aiSession,
    fetch: createRecordedFetch().fetch,
    notificationChannel,
  });
  return { actions, notificationChannel, dataDirectory };
}

async function findOffre(actions: Actions, reference: string) {
  const offreList = await actions.listOffres({ candidatId: 'lea' });
  return offreList.find((offre) => offre.reference === reference);
}

describe('a Republication detected', () => {
  it('is linked to the Offre it publishes again, and that Offre to it', async () => {
    const { actions } = await detectBeforeRepublication();

    await actions.detect();

    expect(await findOffre(actions, REPUBLICATION_REFERENCE)).toMatchObject({
      republicationOf: { reference: REFERENCE },
      republicationList: [],
    });
    expect(await findOffre(actions, REFERENCE)).toMatchObject({
      republicationOf: null,
      republicationList: [{ reference: REPUBLICATION_REFERENCE }],
    });
  });

  // The feed lists the latest Offres first; the three Béthune Offres, among others, stay apart
  it('is linked on the first launch too, and is the only one among the 81 Offres recorded', async () => {
    const actions = await createActions({
      dataDirectory: createDataDirectory(),
      fetch: createRecordedFetch().fetch,
      notificationChannel: createFakeNotificationChannel(),
    });

    await actions.detect();

    const offreList = await actions.listOffres({ candidatId: 'lea' });
    expect(
      offreList.filter(({ republicationOf }) => republicationOf !== null).map(({ reference }) => reference),
    ).toEqual([REPUBLICATION_REFERENCE]);
    expect(await findOffre(actions, REPUBLICATION_REFERENCE)).toMatchObject({
      republicationOf: { reference: REFERENCE },
    });
  });
});

describe('the Republication of an Offre Postulée', () => {
  it('launches no Recherche and tells the Candidat, who decides whether to apply again', async () => {
    const aiSession = createFakeAiSession();
    const { actions, notificationChannel } = await detectBeforeRepublication(aiSession);
    await actions.changeStatus({ reference: REFERENCE, status: 'postulee' });

    await actions.detect();

    expect(await actions.runQueuedJobs()).toEqual([]);
    expect(aiSession.headlessSessionList).toEqual([]);
    expect(notificationChannel.sentList).toEqual([
      {
        target: 'notify.mobile_app_iphone_de_lea',
        title: "Republication d'une Offre Postulée",
        message: [
          'Attaché de justice affecté auprès des magistrats du parquet',
          'Tribunal Judiciaire de Boulogne-sur-mer',
          `Republication de l'Offre ${REFERENCE}, Postulée : aucune Recherche lancée`,
          'Date limite : 03/08/2026',
        ].join('\n'),
      },
    ]);
  });
});

describe('the Republication of an Offre not Postulée', () => {
  it('launches its Recherche, which reads the Artefacts retenus of the Offre it publishes again', async () => {
    const aiSession = createFakeAiSession(RECHERCHE_RUN, LETTRE_RUN, RECHERCHE_RUN);
    const { actions, dataDirectory } = await detectBeforeRepublication(aiSession);
    await actions.runModule({ module: 'recherche', reference: REFERENCE });
    await actions.runQueuedJobs();
    await actions.runModule({ module: 'lettre', reference: REFERENCE });
    await actions.runQueuedJobs();

    await actions.detect();

    expect(await actions.runQueuedJobs()).toMatchObject([
      {
        module: 'recherche',
        offre: { reference: REPUBLICATION_REFERENCE },
        state: 'done',
        version: {
          inputList: [
            { artefact: 'recherche', number: 1, offre: { reference: REFERENCE } },
            { artefact: 'lettre', number: 1, offre: { reference: REFERENCE } },
          ],
        },
      },
    ]);
    const offreDirectory = path.join(dataDirectory, 'candidats/lea/offres', OFFRE_DIRECTORY_NAME);
    const session = aiSession.headlessSessionList[2];
    expect(session?.readDirectoryList).toEqual([
      path.join(offreDirectory, 'recherche/v1'),
      path.join(offreDirectory, 'lettre/v1'),
    ]);
    expect(session?.fixedPrompt).toContain(REFERENCE);
    expect(session?.fixedPrompt).toContain(`\`${path.join(offreDirectory, 'recherche/v1')}\``);
    expect(session?.fixedPrompt).toContain(`\`${path.join(offreDirectory, 'lettre/v1')}\``);
  });
});
