import { describe, expect, it } from 'vitest';

import { createActions } from '#/actions/index.ts';

import { createDataDirectory } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';
import { createFakeCanalNotification } from './fake-canal-notification.ts';
import { LEA_VEILLE, LEA_VEILLE_ID } from './lea.ts';
import { createRecordedFetch, DSJ_FEED_URL, feedWithout } from './recorded-http.ts';

// An attaché de justice Offre of the court of appeal of Versailles, out of the Zone of Léa's first
// Veille, from the responses recorded on 2026-10-29
const VERSAILLES_REFERENCE = '2026-2409247';

// A second Veille of Léa, on the same title, whose Zone is Versailles
const VERSAILLES_VEILLE = {
  source: 'pep',
  parametres: { title: 'attaché de justice', courtOfAppealList: ['Versailles'] },
};

const RECHERCHE = { fileByName: { 'recherche.md': '# Recherche\n\n## Sources\n\n- https://www.justice.fr/\n' } };

// Léa's Offres already online, imported by the first Détection of her Veille
async function detectLeaOffres() {
  const actions = await createActions({ dataDirectory: createDataDirectory(), fetch: createRecordedFetch().fetch });
  await actions.detect();
  return actions;
}

// Léa sets her Veilles in her Profil, each the Source it follows and the Paramètres this Source asks
// for (ADR-0010, ADR-0011)
describe('Veilles', () => {
  it('lists the Veilles of a Candidat, on its first launch until a Détection went through', async () => {
    const actions = await createActions({ dataDirectory: createDataDirectory() });

    expect(await actions.listVeilles({ candidatId: 'lea' })).toEqual([
      { id: LEA_VEILLE_ID, candidatId: 'lea', detectedAt: null, ...LEA_VEILLE },
    ]);
  });

  it('takes a second Veille into account from the next Détection, on its first launch', async () => {
    const actions = await detectLeaOffres();

    await actions.saveVeille({
      candidatId: 'lea',
      source: 'pep',
      parametres: { title: 'attaché de justice', courtOfAppealList: ['Paris', '', 'Versailles'] },
    });

    expect(await actions.listVeilles({ candidatId: 'lea' })).toMatchObject([
      { id: LEA_VEILLE_ID },
      { id: 'lea-2', parametres: { title: 'attaché de justice', courtOfAppealList: ['Paris', 'Versailles'] } },
    ]);
    expect(await actions.detect()).toMatchObject([
      { veilleId: LEA_VEILLE_ID, isFirstLaunch: false },
      { veilleId: 'lea-2', isFirstLaunch: true },
    ]);
    expect(await actions.detect()).toMatchObject([
      { veilleId: LEA_VEILLE_ID, isFirstLaunch: false },
      { veilleId: 'lea-2', isFirstLaunch: false },
    ]);
  });

  // A broader title would otherwise start a Recherche for every Offre already online at once
  it('starts the first launch of a Veille again once its Paramètres change', async () => {
    const actions = await detectLeaOffres();

    await actions.saveVeille({
      candidatId: 'lea',
      veilleId: LEA_VEILLE_ID,
      source: 'pep',
      parametres: { title: 'attaché de justice', courtOfAppealList: ['Douai'] },
    });

    expect(await actions.listVeilles({ candidatId: 'lea' })).toMatchObject([
      { parametres: { courtOfAppealList: ['Douai'] }, detectedAt: null },
    ]);
  });

  it('keeps the Détection of a Veille saved unchanged', async () => {
    const actions = await detectLeaOffres();

    await actions.saveVeille({ candidatId: 'lea', veilleId: LEA_VEILLE_ID, ...LEA_VEILLE });

    const [veille] = await actions.listVeilles({ candidatId: 'lea' });
    expect(veille?.detectedAt).toBeInstanceOf(Date);
  });

  it('refuses the Paramètres its Source refuses, naming them as the form does', async () => {
    const actions = await createActions({ dataDirectory: createDataDirectory() });

    await expect(
      actions.saveVeille({ candidatId: 'lea', source: 'pep', parametres: { title: '', courtOfAppealList: [''] } }),
    ).rejects.toThrow(
      "La Source Place de l’Emploi Public attend d'autres Paramètres : renseigner « Titre recherché », « Cours d’appel de la Zone ».",
    );
    expect(await actions.listVeilles({ candidatId: 'lea' })).toHaveLength(1);
  });

  it('refuses a Source the registry does not know, naming those it knows', async () => {
    const actions = await createActions({ dataDirectory: createDataDirectory() });

    await expect(actions.saveVeille({ candidatId: 'lea', source: 'inconnue', parametres: {} })).rejects.toThrow(
      'Source inconnue : inconnue. En choisir une parmi pep',
    );
  });

  it('deletes a Veille, whose Offres stay with the Candidat', async () => {
    const actions = await detectLeaOffres();
    const offreList = await actions.listOffres({ candidatId: 'lea' });

    await actions.deleteVeille({ candidatId: 'lea', veilleId: LEA_VEILLE_ID });

    expect(await actions.listVeilles({ candidatId: 'lea' })).toEqual([]);
    expect(await actions.listOffres({ candidatId: 'lea' })).toEqual(offreList);
    expect(await actions.detect()).toEqual([]);
  });

  it('changes only the Veilles of the Candidat named', async () => {
    const actions = await createActions({ dataDirectory: createDataDirectory() });
    await actions.createCandidat({ id: 'camille', name: 'Camille' });

    await expect(actions.deleteVeille({ candidatId: 'camille', veilleId: LEA_VEILLE_ID })).rejects.toThrow(
      `Camille n'a pas de Veille ${LEA_VEILLE_ID} : recharger la page de son Profil.`,
    );
    expect(await actions.listVeilles({ candidatId: 'lea' })).toHaveLength(1);
  });

  // Each Veille has its own Zone: an Offre one stored out of its Zone may be in that of another
  describe('an Offre in the Zone of another Veille of the Candidat', () => {
    it('gets its Recherche and its notification once, when it is new', async () => {
      const dataDirectory = createDataDirectory();
      const notificationChannel = createFakeCanalNotification();
      const option = {
        dataDirectory,
        aiSession: createFakeAiSession(RECHERCHE),
        canalNotificationList: notificationChannel.canalNotificationList,
      };
      const earlierFetch = createRecordedFetch({ [DSJ_FEED_URL]: { body: feedWithout([VERSAILLES_REFERENCE]) } });
      const earlierActions = await createActions({ ...option, fetch: earlierFetch.fetch });
      await notificationChannel.saveFor(earlierActions);
      await earlierActions.saveVeille({ candidatId: 'lea', ...VERSAILLES_VEILLE });
      await earlierActions.detect();
      const recordedFetch = createRecordedFetch();
      const actions = await createActions({ ...option, fetch: recordedFetch.fetch });

      await actions.detect();
      recordedFetch.requestedUrlList.length = 0;
      await actions.detect();

      // Once read by each Veille, no Offre is read again: each Veille reads only its feed
      expect(recordedFetch.requestedUrlList).toEqual([DSJ_FEED_URL, DSJ_FEED_URL]);
      const offreList = await actions.listOffres({ candidatId: 'lea' });
      expect(offreList.filter(({ reference }) => reference === VERSAILLES_REFERENCE)).toMatchObject([
        { isInZone: true },
      ]);
      expect(notificationChannel.sentList.map(({ title }) => title)).toEqual(['Nouvelle Offre dans la Zone']);
      const jobList = await actions.runQueuedJobs();
      expect(jobList.map((job) => `${job.module} ${'offre' in job ? job.offre.reference : job.piece}`)).toEqual([
        `recherche ${VERSAILLES_REFERENCE}`,
      ]);
    });

    it('is placed in the Zone without anything started, when it was online at the first launch', async () => {
      const notificationChannel = createFakeCanalNotification();
      const actions = await createActions({
        dataDirectory: createDataDirectory(),
        aiSession: createFakeAiSession(),
        fetch: createRecordedFetch().fetch,
        canalNotificationList: notificationChannel.canalNotificationList,
      });
      await notificationChannel.saveFor(actions);
      await actions.detect();

      await actions.saveVeille({ candidatId: 'lea', ...VERSAILLES_VEILLE });
      await actions.detect();

      const offreList = await actions.listOffres({ candidatId: 'lea' });
      expect(offreList.find(({ reference }) => reference === VERSAILLES_REFERENCE)).toMatchObject({ isInZone: true });
      expect(notificationChannel.sentList).toEqual([]);
      expect(await actions.runQueuedJobs()).toEqual([]);
    });
  });
});
