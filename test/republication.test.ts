import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createActions, type Actions } from '#/actions/index.ts';

import { createDataDirectory } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';
import { createFakeNotificationChannel } from './fake-notification-channel.ts';
import { LEA_WATCH, LEA_WATCH_ID } from './lea.ts';
import { createRecordedFetch, DSJ_FEED_URL, feedWithout } from './recorded-http.ts';

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

// A first Detection on the feed as it was before the Republication, then the actions for the next
// one, on the feed as recorded. Out of the Zone, the Zone of Léa's Watch leaves out the court of
// appeal of Douai, that of Boulogne.
async function detectBeforeRepublication(aiSession = createFakeAiSession(), { isOutOfZone = false } = {}) {
  const dataDirectory = createDataDirectory();
  const notificationChannel = createFakeNotificationChannel();
  const earlierFetch = createRecordedFetch({ [DSJ_FEED_URL]: { body: feedWithout([REPUBLICATION_REFERENCE]) } });
  const earlierActions = await createActions({
    dataDirectory,
    aiSession,
    fetch: earlierFetch.fetch,
    notificationChannelList: notificationChannel.notificationChannelList,
  });
  if (isOutOfZone) {
    await earlierActions.saveWatch({
      candidateId: 'lea',
      watchId: LEA_WATCH_ID,
      source: 'pep',
      parameters: { ...LEA_WATCH.parameters, courtOfAppealList: ['Amiens'] },
    });
  }
  await notificationChannel.saveFor(earlierActions);
  await earlierActions.detect();
  const actions = await createActions({
    dataDirectory,
    aiSession,
    fetch: createRecordedFetch().fetch,
    notificationChannelList: notificationChannel.notificationChannelList,
  });
  return { actions, notificationChannel, dataDirectory };
}

async function findOffre(actions: Actions, reference: string) {
  const offreList = await actions.listOffres({ candidateId: 'lea' });
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
      notificationChannelList: createFakeNotificationChannel().notificationChannelList,
    });

    await actions.detect();

    const offreList = await actions.listOffres({ candidateId: 'lea' });
    expect(
      offreList.filter(({ republicationOf }) => republicationOf !== null).map(({ reference }) => reference),
    ).toEqual([REPUBLICATION_REFERENCE]);
    expect(await findOffre(actions, REPUBLICATION_REFERENCE)).toMatchObject({
      republicationOf: { reference: REFERENCE },
    });
  });
});

describe('the Republication of an Offre Postulée', () => {
  it('launches no Recherche and tells the Candidate, who decides whether to apply again', async () => {
    const aiSession = createFakeAiSession();
    const { actions, notificationChannel } = await detectBeforeRepublication(aiSession);
    await actions.changeStatut({ reference: REFERENCE, statut: 'postulee' });

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

describe('the Republication of an Offre Postulée out of the Zone', () => {
  it('tells the Candidate all the same, who already applied to the Poste', async () => {
    const { actions, notificationChannel } = await detectBeforeRepublication(createFakeAiSession(), {
      isOutOfZone: true,
    });
    await actions.changeStatut({ reference: REFERENCE, statut: 'postulee' });

    await actions.detect();

    expect(await findOffre(actions, REPUBLICATION_REFERENCE)).toMatchObject({ isInZone: false });
    expect(notificationChannel.sentList).toMatchObject([{ title: "Republication d'une Offre Postulée" }]);
    expect(await actions.runQueuedJobs()).toEqual([]);
  });

  // Archivée since, the Offre was Postulée all the same
  it('tells the Candidate once the Offre Postulée is Archivée', async () => {
    const { actions, notificationChannel } = await detectBeforeRepublication(createFakeAiSession(), {
      isOutOfZone: true,
    });
    await actions.changeStatut({ reference: REFERENCE, statut: 'postulee' });
    await actions.changeStatut({ reference: REFERENCE, statut: 'archivee' });

    await actions.detect();

    expect(notificationChannel.sentList).toMatchObject([{ title: "Republication d'une Offre Postulée" }]);
  });
});

describe('the Republication of an Offre not Postulée', () => {
  it('tells the Candidate it publishes again an Offre, named by its reference', async () => {
    const { actions, notificationChannel } = await detectBeforeRepublication(createFakeAiSession(RECHERCHE_RUN));

    await actions.detect();

    expect(notificationChannel.sentList).toEqual([
      {
        target: 'notify.mobile_app_iphone_de_lea',
        title: 'Republication dans la Zone',
        message: [
          'Attaché de justice affecté auprès des magistrats du parquet',
          'Tribunal Judiciaire de Boulogne-sur-mer',
          `Republication de l'Offre ${REFERENCE} : sa Recherche part de celle de cette Offre`,
          'Date limite : 03/08/2026',
        ].join('\n'),
      },
    ]);
  });

  it('tells nothing out of the Zone', async () => {
    const { actions, notificationChannel } = await detectBeforeRepublication(createFakeAiSession(), {
      isOutOfZone: true,
    });

    await actions.detect();

    expect(notificationChannel.sentList).toEqual([]);
  });

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
    const offreDirectory = path.join(dataDirectory, 'candidates/lea/offres', OFFRE_DIRECTORY_NAME);
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
