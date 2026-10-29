import { describe, expect, it, vi } from 'vitest';

import { createActions, type Actions } from '#/actions/index.ts';

import { createDataDirectory } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';
import { createFakeNotificationChannel } from './fake-notification-channel.ts';
import { createRecordedFetch } from './recorded-http.ts';

// A Fiche de poste found elsewhere than on the Sources the Veilles read
const FICHE_DE_POSTE = `# Greffier placé – Tribunal judiciaire de Lille

**Employeur :** Ministère de la Justice – Tribunal judiciaire de Lille

**Lieu d'affectation :** 13 avenue du Peuple Belge, 59000 Lille

## Missions

Le greffier assiste les magistrats du siège et du parquet.

## Candidature

Date limite de candidature : 30/11/2026.

Adresser CV et lettre de motivation à greffe.tj-lille@justice.fr

Contact : Marie Martin, directrice de greffe, 03 20 00 00 00
`;

// What the extraction session writes for it, each field copied from the Fiche de poste
const EXTRACTION = {
  title: 'Greffier placé – Tribunal judiciaire de Lille',
  employer: 'Ministère de la Justice – Tribunal judiciaire de Lille',
  workplace: '13 avenue du Peuple Belge, 59000 Lille',
  city: 'Lille',
  dateLimite: '2026-11-30',
  applicationEmail: 'greffe.tj-lille@justice.fr',
  contact1: 'Marie Martin, directrice de greffe, 03 20 00 00 00',
  contact2: null,
};

const RECHERCHE = `# Recherche : greffier placé à Lille

Le tribunal judiciaire de Lille est l'un des plus grands de France ([justice.fr](https://www.justice.fr/)).

## Sources

- [justice.fr](https://www.justice.fr/)
`;

const FILE_NAME = 'greffier-lille.md';

function extractionRun(extraction: Record<string, unknown> = EXTRACTION) {
  return { fileByName: { 'extraction.json': JSON.stringify(extraction) } };
}

async function openActions(aiSession: ReturnType<typeof createFakeAiSession>) {
  const dataDirectory = createDataDirectory();
  return createActions({
    dataDirectory,
    aiSession,
    fetch: createRecordedFetch().fetch,
    notificationChannel: createFakeNotificationChannel(),
  });
}

// Imports the Fiche de poste, then lets the worker run the queued jobs: its extraction first
async function importThenRunWorker(actions: Actions, markdown = FICHE_DE_POSTE) {
  const { offre } = await actions.importFicheDePoste({ candidatId: 'lea', fileName: FILE_NAME, markdown });
  const [extractionJob] = await actions.runQueuedJobs();
  return { extractionJob, fiche: await actions.readOffre({ reference: offre.reference }) };
}

const EMPTY_EXTRACTION = Object.fromEntries(Object.keys(EXTRACTION).map((field) => [field, null]));

describe('import of a Fiche de poste in Markdown', () => {
  it('creates the Offre at once, named after its file, with its Fiche de poste, and queues its extraction', async () => {
    const aiSession = createFakeAiSession(extractionRun());
    const actions = await openActions(aiSession);

    const job = await actions.importFicheDePoste({ candidatId: 'lea', fileName: FILE_NAME, markdown: FICHE_DE_POSTE });

    expect(job).toMatchObject({ module: 'extraction', state: 'queued' });
    expect(await actions.listOffres({ candidatId: 'lea' })).toEqual([job.offre]);
    expect(job.offre).toMatchObject({
      candidatId: 'lea',
      title: FILE_NAME,
      employer: null,
      url: null,
      status: 'a_traiter',
      // No Zone of a Veille holds it: the import queues its Recherche whatever the Zone
      isInZone: false,
    });
    const { ficheDePoste, extraction } = await actions.readOffre({ reference: job.offre.reference });
    expect(ficheDePoste).toBe(FICHE_DE_POSTE);
    expect(extraction).toEqual({ etat: 'en_cours', log: '' });
    // The worker runs the session, never the front nor the CLI (ADR-0003)
    expect(aiSession.headlessSessionList).toEqual([]);
  });

  it('has the worker fill the Offre with the fields Claude read and locate it, then queue its Recherche', async () => {
    const aiSession = createFakeAiSession(extractionRun(), { fileByName: { 'recherche.md': RECHERCHE } });
    const actions = await openActions(aiSession);
    const { offre: importedOffre } = await actions.importFicheDePoste({
      candidatId: 'lea',
      fileName: FILE_NAME,
      markdown: FICHE_DE_POSTE,
    });

    const jobList = await actions.runQueuedJobs();

    expect(jobList.map(({ module, state }) => ({ module, state }))).toEqual([
      { module: 'extraction', state: 'done' },
      { module: 'recherche', state: 'done' },
    ]);
    const { offre, ficheDePoste, extraction } = await actions.readOffre({ reference: importedOffre.reference });
    expect(offre).toMatchObject({
      title: 'Greffier placé – Tribunal judiciaire de Lille',
      employer: 'Ministère de la Justice – Tribunal judiciaire de Lille',
      workplace: '13 avenue du Peuple Belge, 59000 Lille',
      dateLimite: new Date('2026-11-30T00:00:00Z'),
      applicationEmail: 'greffe.tj-lille@justice.fr',
      contact1: 'Marie Martin, directrice de greffe, 03 20 00 00 00',
      contact2: null,
      // API Géo's answer recorded on 2026-10-29 for Lille, so that the Offre shows on the map
      city: 'Lille',
      region: 'Hauts-de-France',
      latitude: 50.6311,
      longitude: 3.0468,
    });
    expect(ficheDePoste).toBe(FICHE_DE_POSTE);
    expect(extraction?.etat).toBe('pret');
  });

  it('fails the extraction visibly when the session fails, leaving the Offre as imported, and runs it again', async () => {
    const actions = await openActions(createFakeAiSession({ isSuccess: false }, extractionRun()));
    const { offre } = await actions.importFicheDePoste({
      candidatId: 'lea',
      fileName: FILE_NAME,
      markdown: FICHE_DE_POSTE,
    });

    const [failedJob] = await actions.runQueuedJobs();

    const log = "Claude Code n'a pas relevé les champs de la Fiche de poste : Claude Code a rencontré une erreur.";
    expect(failedJob).toMatchObject({ module: 'extraction', state: 'failed', log });
    const fiche = await actions.readOffre({ reference: offre.reference });
    expect(fiche.offre).toMatchObject({ title: FILE_NAME, employer: null });
    expect(fiche.extraction).toEqual({ etat: 'en_echec', log });
    expect(fiche.artefactList.find(({ artefact }) => artefact === 'recherche')?.etat).toBe('absent');

    const job = await actions.runModule({ module: 'extraction', reference: offre.reference });
    await actions.runQueuedJobs();

    expect(await actions.followJob({ jobId: job.id })).toMatchObject({
      state: 'done',
      offre: { title: 'Greffier placé – Tribunal judiciaire de Lille' },
    });
  });

  it('refuses the extraction of an Offre that a Source other than the import detected', async () => {
    const actions = await openActions(createFakeAiSession());
    await actions.detect();

    await expect(actions.runModule({ module: 'extraction', reference: '2026-2445600' })).rejects.toThrow(
      "L'Offre 2026-2445600 n'a pas été importée : ses champs viennent de sa Source, sans extraction.",
    );
  });

  it('imports the same Fiche de poste once: importing it again gives back its extraction, without another job', async () => {
    const aiSession = createFakeAiSession(extractionRun(), { fileByName: { 'recherche.md': RECHERCHE } });
    const actions = await openActions(aiSession);
    const input = { candidatId: 'lea', fileName: FILE_NAME, markdown: FICHE_DE_POSTE };
    const job = await actions.importFicheDePoste(input);
    expect(await actions.importFicheDePoste({ ...input, fileName: 'copie.md' })).toEqual(job);
    await actions.runQueuedJobs();

    const importedAgainJob = await actions.importFicheDePoste(input);

    expect(importedAgainJob).toMatchObject({ id: job.id, state: 'done' });
    expect(await actions.listOffres({ candidatId: 'lea' })).toHaveLength(1);
    // One extraction, then one Recherche
    expect(aiSession.headlessSessionList).toHaveLength(2);
    expect(await actions.runQueuedJobs()).toEqual([]);
  });

  it('leaves empty each field Claude did not find, and keeps the name of the file without a title', async () => {
    const markdown = 'Le greffier assiste les magistrats du tribunal.\n';
    const actions = await openActions(createFakeAiSession(extractionRun(EMPTY_EXTRACTION)));

    const { extractionJob, fiche } = await importThenRunWorker(actions, markdown);

    expect(extractionJob?.state).toBe('done');
    expect(fiche.offre).toMatchObject({
      title: FILE_NAME,
      employer: null,
      workplace: null,
      city: null,
      latitude: null,
      dateLimite: null,
      applicationEmail: null,
      contact1: null,
      contact2: null,
      isExpiree: false,
    });
  });

  // An imported Fiche de poste is published, for the tool, the day it is imported
  it('makes an Offre without a Date limite Expirée once its import plus the default delay is over', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-10-29T12:00:00Z'));
      const actions = await openActions(createFakeAiSession(extractionRun(EMPTY_EXTRACTION)));
      const { fiche } = await importThenRunWorker(actions, 'Le greffier assiste les magistrats du tribunal.\n');
      expect(fiche.offre).toMatchObject({ publishedAt: new Date('2026-10-29T12:00:00Z'), isExpiree: false });

      vi.setSystemTime(new Date('2027-05-01T12:00:00Z'));

      expect(await actions.listOffres({ candidatId: 'lea' })).toMatchObject([{ isExpiree: true }]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('refuses a field the Fiche de poste does not contain as is, which Claude invented', async () => {
    const invented = { ...EXTRACTION, city: 'Douai', applicationEmail: 'recrutement.tj-lille@justice.fr' };
    const actions = await openActions(createFakeAiSession(extractionRun(invented)));

    const { extractionJob, fiche } = await importThenRunWorker(actions);

    expect(extractionJob?.state).toBe('failed');
    expect(extractionJob?.log).toMatch(
      /figure pas tel quel dans la Fiche de poste[\s\S]*city[\s\S]*figure pas tel quel[\s\S]*applicationEmail/,
    );
    expect(fiche.offre).toMatchObject({ title: FILE_NAME, employer: null, city: null });
    expect(fiche.extraction?.etat).toBe('en_echec');
  });

  it('takes a field copied with other case, spacing or apostrophes as found in the Fiche de poste', async () => {
    const markdown = '# Attaché d’administration\n\nAffectation : 59000 LILLE\n';
    const extraction = { ...EMPTY_EXTRACTION, title: "Attaché d'administration", workplace: '59000  Lille' };
    const actions = await openActions(createFakeAiSession(extractionRun(extraction)));

    const { fiche } = await importThenRunWorker(actions, markdown);

    expect(fiche.offre).toMatchObject({ title: "Attaché d'administration", workplace: '59000  Lille' });
  });

  it.each([
    { failure: 'writes no extraction', plannedRun: {} },
    {
      failure: 'writes an extraction that is not JSON',
      plannedRun: { fileByName: { 'extraction.json': 'Titre : Greffier placé' } },
    },
    {
      failure: 'writes an extraction of another shape',
      plannedRun: extractionRun({ ...EXTRACTION, dateLimite: '30/11/2026' }),
    },
  ])('fails the extraction visibly when Claude $failure, leaving the Offre as imported', async ({ plannedRun }) => {
    const actions = await openActions(createFakeAiSession(plannedRun));

    const { extractionJob, fiche } = await importThenRunWorker(actions);

    expect(extractionJob?.state).toBe('failed');
    expect(extractionJob?.log).toMatch(
      /^Les champs relevés dans la Fiche de poste ne sont pas valables \(extraction\.json\) : .+\.$/s,
    );
    expect(fiche.offre).toMatchObject({ title: FILE_NAME, employer: null });
  });

  it('refuses an unknown Candidat, saving nothing', async () => {
    const actions = await openActions(createFakeAiSession());

    await expect(
      actions.importFicheDePoste({ candidatId: 'camille', fileName: FILE_NAME, markdown: FICHE_DE_POSTE }),
    ).rejects.toThrow('Candidat inconnu : camille.');
    expect(await actions.runQueuedJobs()).toEqual([]);
  });

  it('never takes the extraction of an earlier run for that of a new one', async () => {
    const actions = await openActions(createFakeAiSession(extractionRun(), {}, {}));
    const { fiche } = await importThenRunWorker(actions);

    const job = await actions.runModule({ module: 'extraction', reference: fiche.offre.reference });
    await actions.runQueuedJobs();

    expect(await actions.followJob({ jobId: job.id })).toMatchObject({ state: 'failed' });
  });
});
