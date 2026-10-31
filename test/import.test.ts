import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { createActions, type Actions } from '#/actions/index.ts';

import { createDataDirectory, LEA_POSTINGS_PATH } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';
import { createFakeNotificationChannel } from './fake-notification-channel.ts';
import { createRecordedFetch, fetchWithApiGeoDown } from './recorded-http.ts';

// A Job Description found elsewhere than on the Sources the Watches read
const JOB_DESCRIPTION = `# Greffier placé – Tribunal judiciaire de Lille

**Employeur :** Ministère de la Justice – Tribunal judiciaire de Lille

**Lieu d'affectation :** 13 avenue du Peuple Belge, 59000 Lille

## Missions

Le greffier assiste les magistrats du siège et du parquet.

## Candidature

Date limite de candidature : 30/11/2026.

Adresser CV et lettre de motivation à greffe.tj-lille@justice.fr

Contact : Marie Martin, directrice de greffe, 03 20 00 00 00
`;

// What the extraction session writes for it, each field copied from the Job Description
const EXTRACTION = {
  title: 'Greffier placé – Tribunal judiciaire de Lille',
  employer: 'Ministère de la Justice – Tribunal judiciaire de Lille',
  workplace: '13 avenue du Peuple Belge, 59000 Lille',
  city: 'Lille',
  deadline: '2026-11-30',
  applicationEmail: 'greffe.tj-lille@justice.fr',
  contact1: 'Marie Martin, directrice de greffe, 03 20 00 00 00',
  contact2: null,
};

const RESEARCH = `# Recherche : greffier placé à Lille

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
    notificationChannelList: createFakeNotificationChannel().notificationChannelList,
  });
}

// Imports the Job Description, then lets the worker run the queued jobs: its extraction first
async function importThenRunWorker(actions: Actions, markdown = JOB_DESCRIPTION) {
  const { posting } = await actions.importJobDescription({ candidateId: 'lea', fileName: FILE_NAME, markdown });
  const [extractionJob] = await actions.runQueuedJobs();
  return { extractionJob, detail: await actions.readPosting({ reference: posting.reference }) };
}

const EMPTY_EXTRACTION = Object.fromEntries(Object.keys(EXTRACTION).map((field) => [field, null]));

describe('import of a Job Description in Markdown', () => {
  it('creates the Posting at once, named after its file, with its Job Description, and queues its extraction', async () => {
    const aiSession = createFakeAiSession(extractionRun());
    const actions = await openActions(aiSession);

    const job = await actions.importJobDescription({
      candidateId: 'lea',
      fileName: FILE_NAME,
      markdown: JOB_DESCRIPTION,
    });

    expect(job).toMatchObject({ module: 'extraction', state: 'queued' });
    expect(await actions.listPostings({ candidateId: 'lea' })).toEqual([job.posting]);
    expect(job.posting).toMatchObject({
      candidateId: 'lea',
      title: FILE_NAME,
      employer: null,
      url: null,
      status: 'to_apply',
      // No Zone of a Watch holds it: the import queues its Research whatever the Zone
      isInZone: false,
    });
    const { jobDescription, extraction } = await actions.readPosting({ reference: job.posting.reference });
    expect(jobDescription).toBe(JOB_DESCRIPTION);
    // No worker runs in the test: the Posting page says so under the extraction
    expect(extraction).toMatchObject({
      state: 'queued',
      log: '',
      errorCode: null,
      workerFailure: { errorCode: 'worker_not_running', message: /^Le worker ne tourne pas/ },
    });
    // The worker runs the session, never the front nor the CLI (ADR-0003)
    expect(aiSession.headlessSessionList).toEqual([]);
  });

  it('has the worker fill the Posting with the fields Claude read and locate it, then queue its Research', async () => {
    const aiSession = createFakeAiSession(extractionRun(), { fileByName: { 'research.md': RESEARCH } });
    const actions = await openActions(aiSession);
    const { posting: importedPosting } = await actions.importJobDescription({
      candidateId: 'lea',
      fileName: FILE_NAME,
      markdown: JOB_DESCRIPTION,
    });

    const jobList = await actions.runQueuedJobs();

    expect(jobList.map(({ module, state }) => ({ module, state }))).toEqual([
      { module: 'extraction', state: 'done' },
      { module: 'research', state: 'done' },
    ]);
    const { posting, jobDescription, extraction } = await actions.readPosting({ reference: importedPosting.reference });
    expect(posting).toMatchObject({
      title: 'Greffier placé – Tribunal judiciaire de Lille',
      employer: 'Ministère de la Justice – Tribunal judiciaire de Lille',
      workplace: '13 avenue du Peuple Belge, 59000 Lille',
      deadline: new Date('2026-11-30T00:00:00Z'),
      applicationEmail: 'greffe.tj-lille@justice.fr',
      contact1: 'Marie Martin, directrice de greffe, 03 20 00 00 00',
      contact2: null,
      // API Géo's answer recorded on 2026-10-29 for Lille, so that the Posting shows on the map
      city: 'Lille',
      region: 'Hauts-de-France',
      latitude: 50.6311,
      longitude: 3.0468,
    });
    expect(jobDescription).toBe(JOB_DESCRIPTION);
    expect(extraction?.state).toBe('ready');
  });

  // API Géo only places the Posting on the map: down, it fails nothing, as in a Detection (#44)
  it('saves the extracted Posting without coordinates while API Géo is down, and the next Detection locates it', async () => {
    const dataDirectory = createDataDirectory();
    const aiSession = createFakeAiSession(extractionRun(), { fileByName: { 'research.md': RESEARCH } });
    const option = {
      dataDirectory,
      aiSession,
      notificationChannelList: createFakeNotificationChannel().notificationChannelList,
    };
    const actions = await createActions({ ...option, fetch: fetchWithApiGeoDown('unreachable') });
    const { posting: importedPosting } = await actions.importJobDescription({
      candidateId: 'lea',
      fileName: FILE_NAME,
      markdown: JOB_DESCRIPTION,
    });

    const jobList = await actions.runQueuedJobs();

    expect(jobList.map(({ module, state }) => ({ module, state }))).toEqual([
      { module: 'extraction', state: 'done' },
      { module: 'research', state: 'done' },
    ]);
    expect(jobList[0]?.log).toMatch(/\[api_geo_unreachable\] API Géo est injoignable/);
    const { posting } = await actions.readPosting({ reference: importedPosting.reference });
    expect(posting).toMatchObject({
      title: 'Greffier placé – Tribunal judiciaire de Lille',
      city: 'Lille',
      latitude: null,
      longitude: null,
    });

    const nextActions = await createActions({ ...option, fetch: createRecordedFetch().fetch });
    await nextActions.detect();

    const { posting: locatedPosting } = await nextActions.readPosting({ reference: importedPosting.reference });
    expect(locatedPosting).toMatchObject({ city: 'Lille', latitude: 50.6311, longitude: 3.0468 });
  });

  it('fails the extraction visibly when the session fails, leaving the Posting as imported, and runs it again', async () => {
    const actions = await openActions(createFakeAiSession({ isSuccess: false }, extractionRun()));
    const { posting } = await actions.importJobDescription({
      candidateId: 'lea',
      fileName: FILE_NAME,
      markdown: JOB_DESCRIPTION,
    });

    const [failedJob] = await actions.runQueuedJobs();

    const log = "Claude Code n'a pas relevé les champs de la Fiche de poste : Claude Code a rencontré une erreur.";
    expect(failedJob).toMatchObject({
      module: 'extraction',
      state: 'failed',
      log,
      errorCode: 'extraction_session_failed',
    });
    expect(await actions.followJob({ jobId: failedJob?.id })).toMatchObject({
      errorCode: 'extraction_session_failed',
    });
    const detail = await actions.readPosting({ reference: posting.reference });
    expect(detail.posting).toMatchObject({ title: FILE_NAME, employer: null });
    expect(detail.extraction).toEqual({
      state: 'failed',
      log,
      errorCode: 'extraction_session_failed',
      workerFailure: null,
    });
    expect(detail.artifactList.find(({ artifact }) => artifact === 'research')?.state).toBe('absent');

    const job = await actions.runModule({ module: 'extraction', reference: posting.reference });
    await actions.runQueuedJobs();

    expect(await actions.followJob({ jobId: job.id })).toMatchObject({
      state: 'done',
      posting: { title: 'Greffier placé – Tribunal judiciaire de Lille' },
    });
  });

  // The folder named after the new title is taken: its rename fails, and the Posting keeps its title
  it('fails the extraction visibly when its folder cannot follow the new title, keeping the database and the disk in agreement', async () => {
    const dataDirectory = createDataDirectory();
    const actions = await createActions({
      dataDirectory,
      aiSession: createFakeAiSession(extractionRun()),
      fetch: createRecordedFetch().fetch,
    });
    const { posting } = await actions.importJobDescription({
      candidateId: 'lea',
      fileName: FILE_NAME,
      markdown: JOB_DESCRIPTION,
    });
    const takenDirectory = path.join(
      dataDirectory,
      LEA_POSTINGS_PATH,
      `${posting.reference}-greffier-place-tribunal-judiciaire-de-lille`,
    );
    mkdirSync(takenDirectory, { recursive: true });
    writeFileSync(path.join(takenDirectory, 'notes.md'), '# Notes\n');

    const [failedJob] = await actions.runQueuedJobs();

    expect(failedJob).toMatchObject({ module: 'extraction', state: 'failed', errorCode: 'posting_folder_not_moved' });
    expect(failedJob?.log).toMatch(/^Le dossier de l'Offre import-\w+ n'a pas pu suivre son nouveau titre/);
    const detail = await actions.readPosting({ reference: posting.reference });
    expect(detail.posting).toMatchObject({ title: FILE_NAME, employer: null });
    expect(detail.jobDescription).toBe(JOB_DESCRIPTION);
    expect(detail.extraction).toMatchObject({ state: 'failed', errorCode: 'posting_folder_not_moved' });
  });

  it('refuses the extraction of a Posting that a Source other than the import detected', async () => {
    const actions = await openActions(createFakeAiSession());
    await actions.detect();

    await expect(actions.runModule({ module: 'extraction', reference: '2026-2445600' })).rejects.toThrow(
      "L'Offre 2026-2445600 n'a pas été importée : ses champs viennent de sa Source, sans extraction.",
    );
  });

  it('imports the same Job Description once: importing it again gives back its extraction, without another job', async () => {
    const aiSession = createFakeAiSession(extractionRun(), { fileByName: { 'research.md': RESEARCH } });
    const actions = await openActions(aiSession);
    const input = { candidateId: 'lea', fileName: FILE_NAME, markdown: JOB_DESCRIPTION };
    const job = await actions.importJobDescription(input);
    expect(await actions.importJobDescription({ ...input, fileName: 'copie.md' })).toEqual(job);
    await actions.runQueuedJobs();

    const importedAgainJob = await actions.importJobDescription(input);

    expect(importedAgainJob).toMatchObject({ id: job.id, state: 'done' });
    expect(await actions.listPostings({ candidateId: 'lea' })).toHaveLength(1);
    // One extraction, then one Research
    expect(aiSession.headlessSessionList).toHaveLength(2);
    expect(await actions.runQueuedJobs()).toEqual([]);
  });

  // Giving back the failed job would announce an extraction queued while nothing runs
  it('runs the extraction again when the Job Description is imported again after it failed', async () => {
    const actions = await openActions(createFakeAiSession({ isSuccess: false }, extractionRun()));
    const input = { candidateId: 'lea', fileName: FILE_NAME, markdown: JOB_DESCRIPTION };
    const failedJob = await actions.importJobDescription(input);
    await actions.runQueuedJobs();

    const importedAgainJob = await actions.importJobDescription(input);

    expect(importedAgainJob).toMatchObject({ module: 'extraction', state: 'queued' });
    expect(importedAgainJob.id).not.toBe(failedJob.id);
    const [extractionJob] = await actions.runQueuedJobs();
    expect(extractionJob).toMatchObject({ id: importedAgainJob.id, state: 'done' });
    expect(await actions.listPostings({ candidateId: 'lea' })).toHaveLength(1);
  });

  // The session writes the fields under the very names the extraction reads, or they are lost
  it('asks the session for every field the extraction reads, by its name', async () => {
    const aiSession = createFakeAiSession(extractionRun());
    const actions = await openActions(aiSession);

    await importThenRunWorker(actions);

    const [session] = aiSession.headlessSessionList;
    for (const field of Object.keys(EXTRACTION)) {
      expect(session?.fixedPrompt).toContain(`"${field}"`);
    }
  });

  // The fields are those of a French Job Description: copied, never translated into the prompt's English
  it('asks the session to copy each field in the language of the Job Description', async () => {
    const aiSession = createFakeAiSession(extractionRun());
    const actions = await openActions(aiSession);

    await importThenRunWorker(actions);

    const [session] = aiSession.headlessSessionList;
    expect(session?.fixedPrompt).toContain('in the language of the Job Description, never translated');
  });

  it('leaves empty each field Claude did not find, and keeps the name of the file without a title', async () => {
    const markdown = 'Le greffier assiste les magistrats du tribunal.\n';
    const actions = await openActions(createFakeAiSession(extractionRun(EMPTY_EXTRACTION)));

    const { extractionJob, detail } = await importThenRunWorker(actions, markdown);

    expect(extractionJob?.state).toBe('done');
    expect(detail.posting).toMatchObject({
      title: FILE_NAME,
      employer: null,
      workplace: null,
      city: null,
      latitude: null,
      deadline: null,
      applicationEmail: null,
      contact1: null,
      contact2: null,
      isExpired: false,
    });
  });

  // An imported Job Description is published, for the tool, the day it is imported
  it('makes a Posting without a Deadline Expired once its import plus the default delay is over', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-10-29T12:00:00Z'));
      const actions = await openActions(createFakeAiSession(extractionRun(EMPTY_EXTRACTION)));
      const { detail } = await importThenRunWorker(actions, 'Le greffier assiste les magistrats du tribunal.\n');
      expect(detail.posting).toMatchObject({ publishedAt: new Date('2026-10-29T12:00:00Z'), isExpired: false });

      vi.setSystemTime(new Date('2027-05-01T12:00:00Z'));

      expect(await actions.listPostings({ candidateId: 'lea' })).toMatchObject([{ isExpired: true }]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('refuses a field the Job Description does not contain as is, which Claude invented', async () => {
    const invented = { ...EXTRACTION, city: 'Douai', applicationEmail: 'recrutement.tj-lille@justice.fr' };
    const actions = await openActions(createFakeAiSession(extractionRun(invented)));

    const { extractionJob, detail } = await importThenRunWorker(actions);

    expect(extractionJob?.state).toBe('failed');
    expect(extractionJob?.log).toMatch(
      /figure pas tel quel dans la Fiche de poste[\s\S]*city[\s\S]*figure pas tel quel[\s\S]*applicationEmail/,
    );
    expect(detail.posting).toMatchObject({ title: FILE_NAME, employer: null, city: null });
    expect(detail.extraction?.state).toBe('failed');
  });

  it('takes a field copied with other case, spacing or apostrophes as found in the Job Description', async () => {
    const markdown = '# Attaché d’administration\n\nAffectation : 59000 LILLE\n';
    const extraction = { ...EMPTY_EXTRACTION, title: "Attaché d'administration", workplace: '59000  Lille' };
    const actions = await openActions(createFakeAiSession(extractionRun(extraction)));

    const { detail } = await importThenRunWorker(actions, markdown);

    expect(detail.posting).toMatchObject({ title: "Attaché d'administration", workplace: '59000  Lille' });
  });

  it.each([
    { failure: 'writes no extraction', plannedRun: {} },
    {
      failure: 'writes an extraction that is not JSON',
      plannedRun: { fileByName: { 'extraction.json': 'Titre : Greffier placé' } },
    },
    {
      failure: 'writes an extraction of another shape',
      plannedRun: extractionRun({ ...EXTRACTION, deadline: '30/11/2026' }),
    },
  ])('fails the extraction visibly when Claude $failure, leaving the Posting as imported', async ({ plannedRun }) => {
    const actions = await openActions(createFakeAiSession(plannedRun));

    const { extractionJob, detail } = await importThenRunWorker(actions);

    expect(extractionJob?.state).toBe('failed');
    expect(extractionJob?.log).toMatch(
      /^Les champs relevés dans la Fiche de poste ne sont pas valables \(extraction\.json\) : .+\.$/s,
    );
    expect(detail.posting).toMatchObject({ title: FILE_NAME, employer: null });
  });

  it('refuses an unknown Candidate, saving nothing', async () => {
    const actions = await openActions(createFakeAiSession());

    await expect(
      actions.importJobDescription({ candidateId: 'camille', fileName: FILE_NAME, markdown: JOB_DESCRIPTION }),
    ).rejects.toThrow('Candidat inconnu : camille.');
    expect(await actions.runQueuedJobs()).toEqual([]);
  });

  it('never takes the extraction of an earlier run for that of a new one', async () => {
    const actions = await openActions(createFakeAiSession(extractionRun(), {}, {}));
    const { detail } = await importThenRunWorker(actions);

    const job = await actions.runModule({ module: 'extraction', reference: detail.posting.reference });
    await actions.runQueuedJobs();

    expect(await actions.followJob({ jobId: job.id })).toMatchObject({ state: 'failed' });
  });
});
