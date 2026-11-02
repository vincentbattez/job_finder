import { describe, expect, it } from 'vitest';

import { createActions } from '#/actions/index.ts';

import { createDataDirectory } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';
import { createFakeNotificationChannel } from './fake-notification-channel.ts';
import { LEA_WATCH, LEA_WATCH_ID } from './lea.ts';
import { createRecordedFetch, DSJ_FEED_URL, feedWithout } from './recorded-http.ts';

// An attaché de justice Posting of the court of appeal of Versailles, from the responses recorded on
// 2026-10-29
const VERSAILLES_REFERENCE = '2026-2409247';

// A second Watch of Léa, on a title that also matches the Versailles Posting
const SECOND_WATCH = { source: 'pep', parameters: { title: 'attaché de justice' } };

// Léa's Postings already online, imported by the first Detection of her Watch
async function detectLeaPostings() {
  const actions = await createActions({ dataDirectory: createDataDirectory(), fetch: createRecordedFetch().fetch });
  await actions.detect();
  return actions;
}

// Léa sets her Watches in her Profile, each the Source it follows and the Parameters this Source asks
// for (ADR-0010, ADR-0011)
describe('Watches', () => {
  it('lists the Watches of a Candidate, on its first launch until a Detection went through', async () => {
    const actions = await createActions({ dataDirectory: createDataDirectory() });

    expect(await actions.listWatches({ candidateId: 'lea' })).toEqual([
      { id: LEA_WATCH_ID, candidateId: 'lea', detectedAt: null, ...LEA_WATCH },
    ]);
  });

  it('takes a second Watch into account from the next Detection, on its first launch', async () => {
    const actions = await detectLeaPostings();

    await actions.saveWatch({
      candidateId: 'lea',
      source: 'pep',
      parameters: { title: 'attaché de justice' },
    });

    expect(await actions.listWatches({ candidateId: 'lea' })).toMatchObject([
      { id: LEA_WATCH_ID },
      { id: 'lea-2', parameters: { title: 'attaché de justice' } },
    ]);
    expect(await actions.detect()).toMatchObject([
      { watchId: LEA_WATCH_ID, isFirstLaunch: false },
      { watchId: 'lea-2', isFirstLaunch: true },
    ]);
    expect(await actions.detect()).toMatchObject([
      { watchId: LEA_WATCH_ID, isFirstLaunch: false },
      { watchId: 'lea-2', isFirstLaunch: false },
    ]);
  });

  // A broader title would otherwise start a Research for every Posting already online at once
  it('starts the first launch of a Watch again once its Parameters change', async () => {
    const actions = await detectLeaPostings();

    await actions.saveWatch({
      candidateId: 'lea',
      watchId: LEA_WATCH_ID,
      source: 'pep',
      parameters: { title: 'attaché' },
    });

    expect(await actions.listWatches({ candidateId: 'lea' })).toMatchObject([
      { parameters: { title: 'attaché' }, detectedAt: null },
    ]);
  });

  it('keeps the Detection of a Watch saved unchanged', async () => {
    const actions = await detectLeaPostings();

    await actions.saveWatch({ candidateId: 'lea', watchId: LEA_WATCH_ID, ...LEA_WATCH });

    const [watch] = await actions.listWatches({ candidateId: 'lea' });
    expect(watch?.detectedAt).toBeInstanceOf(Date);
  });

  it('refuses the Parameters its Source refuses, naming them as the form does', async () => {
    const actions = await createActions({ dataDirectory: createDataDirectory() });

    await expect(actions.saveWatch({ candidateId: 'lea', source: 'pep', parameters: { title: '' } })).rejects.toThrow(
      "La Source Place de l’Emploi Public attend d'autres Paramètres : renseigner « Titre recherché ».",
    );
    expect(await actions.listWatches({ candidateId: 'lea' })).toHaveLength(1);
  });

  it('refuses a Source the registry does not know, naming those it knows', async () => {
    const actions = await createActions({ dataDirectory: createDataDirectory() });

    await expect(actions.saveWatch({ candidateId: 'lea', source: 'inconnue', parameters: {} })).rejects.toThrow(
      'Source inconnue : inconnue. En choisir une parmi pep',
    );
  });

  it('deletes a Watch, whose Postings stay with the Candidate', async () => {
    const actions = await detectLeaPostings();
    const postingList = await actions.listPostings({ candidateId: 'lea' });

    await actions.deleteWatch({ candidateId: 'lea', watchId: LEA_WATCH_ID });

    expect(await actions.listWatches({ candidateId: 'lea' })).toEqual([]);
    expect(await actions.listPostings({ candidateId: 'lea' })).toEqual(postingList);
    expect(await actions.detect()).toEqual([]);
  });

  it('changes only the Watches of the Candidate named', async () => {
    const actions = await createActions({ dataDirectory: createDataDirectory() });
    await actions.createCandidate({ id: 'camille', name: 'Camille' });

    await expect(actions.deleteWatch({ candidateId: 'camille', watchId: LEA_WATCH_ID })).rejects.toThrow(
      `Camille n'a pas de Veille ${LEA_WATCH_ID} : recharger la page de son Profil.`,
    );
    expect(await actions.listWatches({ candidateId: 'lea' })).toHaveLength(1);
  });

  // The Zone is gone (ADR-0018): a Posting both Watches list is the same Posting, which the Candidate sorts
  describe('a Posting another Watch of the Candidate also lists', () => {
    it('is read and notified once, when it is new, and gets no Research', async () => {
      const dataDirectory = createDataDirectory();
      const notificationChannel = createFakeNotificationChannel();
      const option = {
        dataDirectory,
        aiSession: createFakeAiSession(),
        notificationChannelList: notificationChannel.notificationChannelList,
      };
      const earlierFetch = createRecordedFetch({ [DSJ_FEED_URL]: { body: feedWithout([VERSAILLES_REFERENCE]) } });
      const earlierActions = await createActions({ ...option, fetch: earlierFetch.fetch });
      await notificationChannel.saveFor(earlierActions);
      await earlierActions.saveWatch({ candidateId: 'lea', ...SECOND_WATCH });
      await earlierActions.detect();
      const recordedFetch = createRecordedFetch();
      const actions = await createActions({ ...option, fetch: recordedFetch.fetch });

      await actions.detect();

      // Read by the first Watch only, the second one reading only its feed
      expect(recordedFetch.requestedUrlList.filter((url) => url.includes('/offre-de-emploi/'))).toEqual([
        expect.stringContaining(VERSAILLES_REFERENCE.slice('AAAA-'.length)),
      ]);
      const postingList = await actions.listPostings({ candidateId: 'lea' });
      expect(postingList.filter(({ reference }) => reference === VERSAILLES_REFERENCE)).toHaveLength(1);
      expect(notificationChannel.sentList.map(({ title }) => title)).toEqual(['1 nouvelle Offre']);
      expect(await actions.runQueuedJobs()).toEqual([]);
    });

    it('is not read again by a new Watch, whose first launch starts nothing', async () => {
      const notificationChannel = createFakeNotificationChannel();
      const actions = await createActions({
        dataDirectory: createDataDirectory(),
        aiSession: createFakeAiSession(),
        fetch: createRecordedFetch().fetch,
        notificationChannelList: notificationChannel.notificationChannelList,
      });
      await notificationChannel.saveFor(actions);
      await actions.detect();
      const postingList = await actions.listPostings({ candidateId: 'lea' });

      await actions.saveWatch({ candidateId: 'lea', ...SECOND_WATCH });
      await actions.detect();

      expect(await actions.listPostings({ candidateId: 'lea' })).toEqual(postingList);
      expect(notificationChannel.sentList).toEqual([]);
      expect(await actions.runQueuedJobs()).toEqual([]);
    });
  });
});
