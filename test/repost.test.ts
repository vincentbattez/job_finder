import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createActions, type Actions } from '#/actions/index.ts';

import { createDataDirectory } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';
import { createFakeNotificationChannel } from './fake-notification-channel.ts';
import { LEA_WATCH, LEA_WATCH_ID } from './lea.ts';
import { createRecordedFetch, DSJ_FEED_URL, feedWithout } from './recorded-http.ts';

// The Boulogne parquet Position, published as 2026-2231960 then again as 2026-2338409, both in Léa's
// Zone (responses recorded on 2026-10-29)
const REFERENCE = '2026-2231960';
const REPOST_REFERENCE = '2026-2338409';
const POSTING_DIRECTORY_NAME =
  '2026-2231960-attache-de-justice-affecte-aupres-des-magistrats-du-parquet-tj-boulogne-sur-mer';

const RESEARCH_RUN = {
  fileByName: {
    'research.md': '# Recherche\n\nLe parquet de Boulogne-sur-Mer.\n\n## Sources\n\n- https://www.justice.fr/\n',
  },
};
const LETTER_RUN = {
  fileByName: {
    'draft.md': 'Madame la Procureure,\n',
    'recipients.json': JSON.stringify({
      to: { email: 'chcab.pr.tj-boulogne-sur-mer@justice.fr', source: 'applicationEmail' },
      ccList: [],
      salutation: { text: 'Madame la Procureure,', source: 'contact1' },
      justification: 'Le mail de candidature est celui du cabinet de la procureure.',
    }),
  },
};

// A first Detection on the feed as it was before the Repost, then the actions for the next
// one, on the feed as recorded. Out of the Zone, the Zone of Léa's Watch leaves out the court of
// appeal of Douai, that of Boulogne.
async function detectBeforeRepost(aiSession = createFakeAiSession(), { isOutOfZone = false } = {}) {
  const dataDirectory = createDataDirectory();
  const notificationChannel = createFakeNotificationChannel();
  const earlierFetch = createRecordedFetch({ [DSJ_FEED_URL]: { body: feedWithout([REPOST_REFERENCE]) } });
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

async function findPosting(actions: Actions, reference: string) {
  const postingList = await actions.listPostings({ candidateId: 'lea' });
  return postingList.find((posting) => posting.reference === reference);
}

describe('a Repost detected', () => {
  it('is linked to the Posting it publishes again, and that Posting to it', async () => {
    const { actions } = await detectBeforeRepost();

    await actions.detect();

    expect(await findPosting(actions, REPOST_REFERENCE)).toMatchObject({
      repostOf: { reference: REFERENCE },
      repostList: [],
    });
    expect(await findPosting(actions, REFERENCE)).toMatchObject({
      repostOf: null,
      repostList: [{ reference: REPOST_REFERENCE }],
    });
  });

  // The feed lists the latest Postings first; the three Béthune Postings, among others, stay apart
  it('is linked on the first launch too, and is the only one among the 81 Postings recorded', async () => {
    const actions = await createActions({
      dataDirectory: createDataDirectory(),
      fetch: createRecordedFetch().fetch,
      notificationChannelList: createFakeNotificationChannel().notificationChannelList,
    });

    await actions.detect();

    const postingList = await actions.listPostings({ candidateId: 'lea' });
    expect(postingList.filter(({ repostOf }) => repostOf !== null).map(({ reference }) => reference)).toEqual([
      REPOST_REFERENCE,
    ]);
    expect(await findPosting(actions, REPOST_REFERENCE)).toMatchObject({
      repostOf: { reference: REFERENCE },
    });
  });
});

describe('the Repost of an Applied Posting', () => {
  it('launches no Research and tells the Candidate, who decides whether to apply again', async () => {
    const aiSession = createFakeAiSession();
    const { actions, notificationChannel } = await detectBeforeRepost(aiSession);
    await actions.changeStatus({ reference: REFERENCE, status: 'applied' });

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

describe('the Repost of an Applied Posting out of the Zone', () => {
  it('tells the Candidate all the same, who already applied to the Position', async () => {
    const { actions, notificationChannel } = await detectBeforeRepost(createFakeAiSession(), {
      isOutOfZone: true,
    });
    await actions.changeStatus({ reference: REFERENCE, status: 'applied' });

    await actions.detect();

    expect(await findPosting(actions, REPOST_REFERENCE)).toMatchObject({ isInZone: false });
    expect(notificationChannel.sentList).toMatchObject([{ title: "Republication d'une Offre Postulée" }]);
    expect(await actions.runQueuedJobs()).toEqual([]);
  });

  // Archived since, the Posting was Applied all the same
  it('tells the Candidate once the Applied Posting is Archived', async () => {
    const { actions, notificationChannel } = await detectBeforeRepost(createFakeAiSession(), {
      isOutOfZone: true,
    });
    await actions.changeStatus({ reference: REFERENCE, status: 'applied' });
    await actions.archive({ reference: REFERENCE });

    await actions.detect();

    expect(notificationChannel.sentList).toMatchObject([{ title: "Republication d'une Offre Postulée" }]);
  });
});

describe('the Repost of a Posting not Applied', () => {
  it('tells the Candidate it publishes again a Posting, named by its reference', async () => {
    const { actions, notificationChannel } = await detectBeforeRepost(createFakeAiSession(RESEARCH_RUN));

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
    const { actions, notificationChannel } = await detectBeforeRepost(createFakeAiSession(), {
      isOutOfZone: true,
    });

    await actions.detect();

    expect(notificationChannel.sentList).toEqual([]);
  });

  it('launches its Research, which reads the Chosen Artifacts of the Posting it publishes again', async () => {
    const aiSession = createFakeAiSession(RESEARCH_RUN, LETTER_RUN, RESEARCH_RUN);
    const { actions, dataDirectory } = await detectBeforeRepost(aiSession);
    await actions.runModule({ module: 'research', reference: REFERENCE });
    await actions.runQueuedJobs();
    await actions.runModule({ module: 'letter', reference: REFERENCE });
    await actions.runQueuedJobs();

    await actions.detect();

    expect(await actions.runQueuedJobs()).toMatchObject([
      {
        module: 'research',
        posting: { reference: REPOST_REFERENCE },
        state: 'done',
        version: {
          inputList: [
            { artifact: 'research', number: 1, posting: { reference: REFERENCE } },
            { artifact: 'letter', number: 1, posting: { reference: REFERENCE } },
          ],
        },
      },
    ]);
    const postingDirectory = path.join(dataDirectory, 'candidates/lea/postings', POSTING_DIRECTORY_NAME);
    const session = aiSession.headlessSessionList[2];
    expect(session?.readDirectoryList).toEqual([
      path.join(postingDirectory, 'research/v1'),
      path.join(postingDirectory, 'letter/v1'),
    ]);
    expect(session?.fixedPrompt).toContain(REFERENCE);
    expect(session?.fixedPrompt).toContain(`\`${path.join(postingDirectory, 'research/v1')}\``);
    expect(session?.fixedPrompt).toContain(`\`${path.join(postingDirectory, 'letter/v1')}\``);
  });

  // The Prompt the Posting page shows beside the Research of the Repost
  it('shows, beside its Research, the Chosen Artifacts of the Posting it publishes again', async () => {
    const { actions } = await detectBeforeRepost(createFakeAiSession(RESEARCH_RUN, LETTER_RUN));
    await actions.runModule({ module: 'research', reference: REFERENCE });
    await actions.runQueuedJobs();
    await actions.runModule({ module: 'letter', reference: REFERENCE });
    await actions.runQueuedJobs();

    await actions.detect();

    const { artifactList } = await actions.readPosting({ reference: REPOST_REFERENCE });
    const research = artifactList.find(({ artifact }) => artifact === 'research');
    expect(research?.module.prompt?.readVersionList).toEqual([
      { reference: REFERENCE, artifact: 'research', interviewNumber: null, number: 1 },
      { reference: REFERENCE, artifact: 'letter', interviewNumber: null, number: 1 },
    ]);
  });
});
