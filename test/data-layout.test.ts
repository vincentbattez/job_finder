import { spawn } from 'node:child_process';
import { once } from 'node:events';
import {
  chmodSync,
  closeSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it } from 'vitest';

import { openContext } from '#/actions/context.ts';
import { i18nOf } from '#/actions/i18n.ts';
import { createActions, type Actions } from '#/actions/index.ts';
import { ArtifactText } from '#/web/components/mdx/artifact-text.tsx';
import { copyAsReadOnly, writeTextFile } from '#/workspace/acl/files.ts';

import { createFakeNotificationChannel, LEA_TARGET } from './fake-notification-channel.ts';
import { writeOlderDatabase } from './older-database.ts';
import { createRecordedFetch } from './recorded-http.ts';

// The last migration before the Candidate side spoke English
const BEFORE_CANDIDATE_MIGRATION = '20261030122214_delai_par_defaut';
// The last migration before the Visualization went away (ADR-0020)
const BEFORE_VISUALIZATION_REMOVAL_MIGRATION = '20261031110442_posting_unpublished_at';
// The last migration before each Version recorded its Inputs (ADR-0021)
const BEFORE_VERSION_INPUT_MIGRATION = '20261102182655_remove_visualization';
// The last migration before a detected Posting started New (ADR-0018)
const BEFORE_NEW_STATUS_MIGRATION = '20261102184315_version_input';
// The last migration before the Zone went away (ADR-0018)
const BEFORE_ZONE_REMOVAL_MIGRATION = '20261102194517_posting_status_new';
// The last migration before a Version was a Draft or Validated (ADR-0019)
const BEFORE_VERSION_VALIDATION_MIGRATION = '20261102184315_version_input';

const LOCK_HELD_MS = 6000;

const FACTS = '# Faits\n\n## Mobilité\n\n- Lille et alentours\n';
const CV = '# CV de Léa\n';
const CV_PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
const LETTER_INSTRUCTIONS = 'Une lettre courte.';
const BRIEF_INSTRUCTIONS = '# À réviser\n';
const DRAFT = '# Brouillon\n';
const PAST_LETTER = '# Lettre au TJ de Lille\n';
// The entries of her live data/ the tool does not know: macOS's, her own files, a backup
const UNKNOWN_ENTRY_BY_PATH = {
  '.DS_Store': 'finder',
  'job_finder.before-pr64.sqlite': 'backup',
  'candidats/lea/.DS_Store': 'finder',
  'candidats/lea/_data/Renseignements sur moi': 'Née à Lille',
};
const RESEARCH = '# Recherche 2\n';
const RECIPIENTS = JSON.stringify({
  to: null,
  ccList: [],
  salutation: { text: 'Madame, Monsieur,', source: null },
  justification: 'Aucune adresse publiée.',
});
// Léa's Watch and the last Detection of her live data/, from before the English code
const WATCH_PARAMETERS = { title: 'attaché de justice', courtOfAppealList: ['Douai', 'Amiens'] };
const DETECTED_AT = new Date('2026-10-30T10:44:22.500Z');
// An attaché de justice Posting of the recorded DSJ feed, which her last Detection already saved
const KNOWN_REFERENCE = '2026-2445600';
const FRENCH_CONFIG = JSON.stringify({
  defaultDelayMonths: 6,
  // cspell:disable-next-line
  candidatList: [{ id: 'lea', name: 'Léa', watchList: [{ id: 'lea-1', source: 'pep', parameters: WATCH_PARAMETERS }] }],
});

function writeFile(filePath: string, content: string | Uint8Array): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

// Léa's data folder as the French jf left it: a database at the last French migration, holding an
// Applied Posting with its Chosen Letter made from her own Instructions out of the second of two
// Research Versions, a failed Interview Brief, a queued Visualization, a Posting in each other
// Status, a Repost, the conversion of an Upload, her folders and the config an older jf read
function writeFrenchDataDirectory(): string {
  const dataDirectory = mkdtempSync(path.join(tmpdir(), 'job-finder-'));
  const database = new DatabaseSync(writeOlderDatabase(dataDirectory, BEFORE_CANDIDATE_MIGRATION));
  database.exec(`INSERT INTO Candidat (id, name) VALUES ('lea', 'Léa');
    INSERT INTO DelaiParDefaut (id, months) VALUES (1, 6);
    INSERT INTO Veille (id, candidatId, source, parametres, detectedAt)
    VALUES ('lea-1', 'lea', 'pep', '{"title":"attaché de justice","courtOfAppealList":["Douai","Amiens"]}', '2026-10-30T10:44:22.500+00:00');
    INSERT INTO CanalNotification (candidatId, module, parametres) VALUES ('lea', 'faux', '{"target":"notify.mobile_app_iphone_de_lea"}');
    INSERT INTO Offre (id, candidatId, source, reference, title, dateLimite, status, postuleeAt, isInZone)
    VALUES (1, 'lea', 'pep', '2026-1', 'Greffier', '2026-11-20T00:00:00.000+00:00', 'postulee', '2026-10-20T09:00:00.000+00:00', 1);
    INSERT INTO Offre (id, candidatId, source, reference, title, isInZone) VALUES (2, 'lea', 'pep', '2026-2445600', 'Attaché de justice', 1);
    INSERT INTO Offre (id, candidatId, source, reference, title, status, republicationOfId, isInZone)
    VALUES (3, 'lea', 'pep', '2026-3', 'Greffier', 'archivee', 1, 1);
    INSERT INTO Job (id, module, offreId, state) VALUES (1, 'lettre', 1, 'done');
    INSERT INTO Version (offreId, artefact, number, isRetenue, state, consignes, hasCandidatConsignes, jobId)
    VALUES (1, 'lettre', 1, 1, 'ready', 'Une lettre courte.', 1, 1);
    INSERT INTO Job (id, module, candidatId, piece, state, log) VALUES (2, 'conversion', 'lea', 'cv.pdf', 'done', 'Converti.');
    INSERT INTO Job (id, module, offreId, state) VALUES (3, 'recherche', 1, 'done');
    INSERT INTO Version (offreId, artefact, number, isRetenue, state, consignes, jobId) VALUES (1, 'recherche', 1, 0, 'ready', 'Chercher.', 3);
    INSERT INTO Job (id, module, offreId, state) VALUES (4, 'recherche', 1, 'done');
    INSERT INTO Version (offreId, artefact, number, isRetenue, state, consignes, jobId) VALUES (1, 'recherche', 2, 1, 'ready', 'Chercher.', 4);
    INSERT INTO _Input (A, B) VALUES (1, 3);
    INSERT INTO Job (id, module, offreId, state, log) VALUES (5, 'fiche_entretien', 1, 'failed', 'Interrompu.');
    INSERT INTO Version (offreId, artefact, number, isRetenue, state, consignes, hasCandidatConsignes, jobId)
    VALUES (1, 'fiche_entretien', 1, 0, 'failed', 'Réviser.', 1, 5);
    INSERT INTO Job (id, module, offreId, state) VALUES (6, 'visualisation', 3, 'queued');`);
  database.close();
  const leaDirectory = path.join(dataDirectory, 'candidats', 'lea');
  writeFile(path.join(leaDirectory, 'profil', 'faits.md'), FACTS);
  writeFile(path.join(leaDirectory, 'profil', 'cv.md'), CV);
  writeFile(path.join(leaDirectory, 'profil', 'pieces', 'cv.pdf'), CV_PDF);
  writeFile(path.join(leaDirectory, 'consignes', 'lettre.md'), LETTER_INSTRUCTIONS);
  writeFile(path.join(leaDirectory, 'consignes', 'fiche_entretien.md'), BRIEF_INSTRUCTIONS);
  writeFile(path.join(leaDirectory, 'offres', '2026-1-greffier', 'fiche-de-poste.md'), '# Greffier\n');
  const letterDirectory = path.join(leaDirectory, 'offres', '2026-1-greffier', 'lettre', 'v1');
  writeFile(path.join(letterDirectory, 'lettre.md'), '# Lettre\n');
  writeFile(path.join(letterDirectory, 'brouillon.md'), DRAFT);
  chmodSync(path.join(letterDirectory, 'brouillon.md'), 0o444);
  const postingDirectory = path.join(leaDirectory, 'offres', '2026-1-greffier');
  writeFile(path.join(postingDirectory, 'recherche', 'v1', 'recherche.md'), '# Recherche 1\n');
  writeFile(path.join(postingDirectory, 'recherche', 'v2', 'recherche.md'), RESEARCH);
  mkdirSync(path.join(postingDirectory, 'fiche_entretien', 'v1'), { recursive: true });
  writeFile(path.join(letterDirectory, 'destinataires.json'), RECIPIENTS);
  writeFile(path.join(leaDirectory, 'offres', '2026-3-greffier', 'fiche-de-poste.md'), '# Greffier, encore\n');
  writeFile(path.join(leaDirectory, 'profil', 'lettre-tj-lille-2025.md'), PAST_LETTER);
  // A Candidate folder whose Profile is still empty, as Léa's live one
  mkdirSync(path.join(dataDirectory, 'candidats', 'jean', 'profil'), { recursive: true });
  for (const [entryPath, content] of Object.entries(UNKNOWN_ENTRY_BY_PATH)) {
    writeFile(path.join(dataDirectory, entryPath), content);
  }
  writeFile(path.join(dataDirectory, 'config.json'), FRENCH_CONFIG);
  return dataDirectory;
}

// Every entry of the data folder with its size and last write, to tell a second opening changed nothing
// The names in a folder, in order
function listSorted(directory: string): string[] {
  return readdirSync(directory).toSorted((first, second) => first.localeCompare(second));
}

function snapshotOf(directory: string): string[] {
  return readdirSync(directory, { recursive: true, encoding: 'utf8' })
    .toSorted((first, second) => first.localeCompare(second))
    .map((entry) => {
      const stats = statSync(path.join(directory, entry));
      return `${entry} ${String(stats.size)} ${String(stats.mtimeMs)}`;
    });
}

describe('the French data folder', () => {
  // The main checkout migrates Léa's real data/ on the next launch: nothing of her Profile is lost
  it('moves to the English layout on opening, and reads back through the actions', async () => {
    const dataDirectory = writeFrenchDataDirectory();

    const actions = await createActions({ dataDirectory });

    expect(await actions.listCandidates()).toEqual([{ id: 'lea', name: 'Léa', locale: 'fr' }]);
    expect(await actions.listProfileFiles({ candidateId: 'lea' })).toEqual([
      { fileName: 'cv.md', markdown: CV },
      { fileName: 'facts.md', markdown: FACTS },
      { fileName: 'letter-tj-lille-2025.md', markdown: PAST_LETTER },
    ]);
    expect(await actions.readFacts({ candidateId: 'lea' })).toContainEqual(
      expect.objectContaining({ title: 'Mobilité', entryList: ['- Lille et alentours'] }),
    );
    expect(await actions.listUploads({ candidateId: 'lea' })).toEqual([
      expect.objectContaining({ fileName: 'cv.pdf', conversion: { state: 'ready', log: 'Converti.' } }),
    ]);
    expect(await actions.readInstructions({ candidateId: 'lea', module: 'letter' })).toMatchObject({
      candidateInstructions: LETTER_INSTRUCTIONS,
    });
    expect(await actions.listVersions({ reference: '2026-1', artifact: 'letter' })).toEqual([
      expect.objectContaining({ isChosen: true, instructions: LETTER_INSTRUCTIONS, hasCandidateInstructions: true }),
    ]);
    expect(await actions.listWatches({ candidateId: 'lea' })).toEqual([
      // Its Zone gone since (ADR-0018)
      {
        id: 'lea-1',
        candidateId: 'lea',
        source: 'pep',
        parameters: { title: 'attaché de justice' },
        detectedAt: DETECTED_AT,
        label: 'attaché de justice',
        nearMissList: [],
      },
    ]);
    expect(await actions.readDefaultDeadlinePeriod()).toEqual({ months: 6 });
    expect(listSorted(dataDirectory)).toEqual([
      '.DS_Store',
      'candidates',
      'config.json',
      'job_finder.before-pr64.sqlite',
      'job_finder.sqlite',
    ]);
    expect(listSorted(path.join(dataDirectory, 'candidates', 'lea'))).toEqual([
      '_data',
      '.DS_Store',
      'instructions',
      'postings',
      'profile',
    ]);
  });

  // What the tool does not know stays where it is, as it was; an empty Profile moves all the same
  it('leaves the entries it does not know untouched', async () => {
    const dataDirectory = writeFrenchDataDirectory();

    await createActions({ dataDirectory });

    for (const [entryPath, content] of Object.entries(UNKNOWN_ENTRY_BY_PATH)) {
      const englishPath = entryPath.replace(/^candidats\//, 'candidates/');
      expect(readFileSync(path.join(dataDirectory, englishPath), 'utf8')).toBe(content);
    }
    expect(listSorted(path.join(dataDirectory, 'candidates', 'jean'))).toEqual(['profile']);
    expect(listSorted(path.join(dataDirectory, 'candidates', 'jean', 'profile'))).toEqual([]);
  });

  // Léa's Postings keep their Status, Deadline and Repost links, each Job Description its folder
  it('keeps each Posting with its Status, its Repost link and its Job Description', async () => {
    const dataDirectory = writeFrenchDataDirectory();

    const actions = await createActions({ dataDirectory });

    const postingList = await actions.listPostings({ candidateId: 'lea' });
    expect(
      postingList
        .toSorted((first, second) => first.reference.localeCompare(second.reference))
        .map(({ reference, status, appliedAt, archivedAt, deadline, repostOf, repostList }) => ({
          reference,
          status,
          appliedAt,
          isArchived: archivedAt !== null,
          deadline,
          repostOf,
          repostList,
        })),
    ).toEqual([
      {
        reference: '2026-1',
        status: 'applied',
        appliedAt: new Date('2026-10-20T09:00:00Z'),
        isArchived: false,
        deadline: new Date('2026-11-20T00:00:00Z'),
        repostOf: null,
        repostList: [{ reference: '2026-3' }],
      },
      {
        reference: '2026-2445600',
        // To Apply with no Research: New, to be sorted (ADR-0018)
        status: 'new',
        appliedAt: null,
        isArchived: false,
        deadline: null,
        repostOf: null,
        repostList: [],
      },
      {
        reference: '2026-3',
        // Archived, never Applied and with no Research: New, with the Archived mark (ADR-0007, ADR-0018)
        status: 'new',
        appliedAt: null,
        isArchived: true,
        deadline: null,
        repostOf: { reference: '2026-1' },
        repostList: [],
      },
    ]);
    const { jobDescription } = await actions.readPosting({ reference: '2026-3' });
    expect(jobDescription).toBe('# Greffier, encore\n');
    // The Interview Brief of a Posting went with its Version: an Interview Brief belongs to an Interview now
    expect(listSorted(path.join(dataDirectory, 'candidates', 'lea', 'postings', '2026-1-greffier'))).toEqual([
      'job-description.md',
      'letter',
      'research',
    ]);
  });

  // The Letter she sent stays the one recorded: no correction, no new Version, no other Version retained
  it('keeps the Letter of an Applied Posting frozen', async () => {
    const dataDirectory = writeFrenchDataDirectory();

    const actions = await createActions({ dataDirectory });

    const { statusChoiceList, artifactList } = await actions.readPosting({ reference: '2026-1' });
    expect(statusChoiceList).toEqual(['to_apply', 'hired', 'rejected']);
    expect(artifactList.find(({ artifact }) => artifact === 'letter')).toMatchObject({ isEditable: false });
    await expect(actions.runModule({ module: 'letter', reference: '2026-1' })).rejects.toThrow(/figée/);
    const draftPath = path.join(
      dataDirectory,
      'candidates',
      'lea',
      'postings',
      '2026-1-greffier',
      'letter',
      'v1',
      'original.md',
    );
    expect(readFileSync(draftPath, 'utf8')).toBe(DRAFT);
    expect(statSync(draftPath).mode & 0o777).toBe(0o444);
  });

  // Each Version keeps its number, its Instructions, the Versions it read and whether it is chosen; a
  // failed or queued Job reads back under its English module. The Interview Brief and the Visualization
  // of a Posting go, with their jobs: they belong to an Interview now (spec #45).
  it('keeps every Version of each Artifact of a Posting, its Chosen Version, its inputs and its Jobs', async () => {
    const dataDirectory = writeFrenchDataDirectory();

    const actions = await createActions({ dataDirectory });

    expect(await actions.listVersions({ reference: '2026-1', artifact: 'research' })).toEqual([
      expect.objectContaining({ artifact: 'research', number: 1, isChosen: false }),
      expect.objectContaining({ artifact: 'research', number: 2, isChosen: true }),
    ]);
    expect(await actions.listVersions({ reference: '2026-1', artifact: 'letter' })).toEqual([
      expect.objectContaining({
        inputList: [
          {
            key: 'artifact:research',
            readVersion: {
              artifact: 'research',
              number: 2,
              posting: { reference: '2026-1' },
              interview: null,
              customArtifact: null,
            },
          },
        ],
      }),
    ]);
    const { artifactList, recipients } = await actions.readPosting({ reference: '2026-1' });
    expect(Object.fromEntries(artifactList.map(({ artifact, state }) => [artifact, state]))).toEqual({
      research: 'ready',
      letter: 'ready',
    });
    const research = artifactList.find(({ artifact }) => artifact === 'research');
    expect(research?.versionList[1]).toMatchObject({ text: RESEARCH });
    const letter = artifactList.find(({ artifact }) => artifact === 'letter');
    expect(letter?.versionList[0]?.original).toBe(DRAFT);
    expect(recipients).toEqual(JSON.parse(RECIPIENTS));
    expect(await actions.runQueuedJobs()).toEqual([]);
    expect(await actions.readInstructions({ candidateId: 'lea', module: 'interview_brief' })).toMatchObject({
      candidateInstructions: BRIEF_INSTRUCTIONS,
    });
  });

  it('rewrites the keys of the config an older jf left', async () => {
    const dataDirectory = writeFrenchDataDirectory();

    await createActions({ dataDirectory });

    const config: unknown = JSON.parse(readFileSync(path.join(dataDirectory, 'config.json'), 'utf8'));
    expect(config).toEqual({
      defaultDelayMonths: 6,
      candidateList: [
        { id: 'lea', name: 'Léa', watchList: [{ id: 'lea-1', source: 'pep', parameters: WATCH_PARAMETERS }] },
      ],
    });
  });

  // Her daily Detection goes on after the update: no first launch, so a new Posting is saved New and
  // her phone hears of it, through the Notification Channel she had saved
  it('keeps the next Detection from being a first launch', async () => {
    const dataDirectory = writeFrenchDataDirectory();
    const notificationChannel = createFakeNotificationChannel();
    const actions = await createActions({
      dataDirectory,
      fetch: createRecordedFetch().fetch,
      notificationChannelList: notificationChannel.notificationChannelList,
    });

    const [detection] = await actions.detect();

    expect(detection).toMatchObject({ watchId: 'lea-1', isFirstLaunch: false, notificationFailureList: [] });
    expect(detection?.newPostingList.map(({ reference }) => reference)).not.toContain(KNOWN_REFERENCE);
    expect(notificationChannel.sentList.length).toBeGreaterThan(0);
    expect(notificationChannel.sentList.every(({ target }) => target === LEA_TARGET)).toBe(true);
    const postingList = await actions.listPostings({ candidateId: 'lea' });
    expect(postingList.filter(({ reference }) => reference === KNOWN_REFERENCE)).toHaveLength(1);
  });

  // A fresh database imports the config once: a French-keyed one still brings its Candidates
  it('imports a French-keyed config into a new database', async () => {
    const dataDirectory = mkdtempSync(path.join(tmpdir(), 'job-finder-'));
    writeFile(path.join(dataDirectory, 'config.json'), FRENCH_CONFIG);

    const actions = await createActions({ dataDirectory });

    expect(await actions.listCandidates()).toEqual([{ id: 'lea', name: 'Léa', locale: 'fr' }]);
    expect(await actions.listWatches({ candidateId: 'lea' })).toEqual([
      {
        id: 'lea-1',
        candidateId: 'lea',
        source: 'pep',
        parameters: WATCH_PARAMETERS,
        detectedAt: null,
        label: WATCH_PARAMETERS.title,
        nearMissList: [],
      },
    ]);
  });

  // The front, the worker and jf detect each open the workspace, again and again
  it('changes nothing when opened again', async () => {
    const dataDirectory = writeFrenchDataDirectory();
    await createActions({ dataDirectory });
    const entryList = snapshotOf(dataDirectory);

    await createActions({ dataDirectory });

    expect(snapshotOf(dataDirectory)).toEqual(entryList);
  });

  // Merging two Profiles is the Candidate's call, never a guess of the tool
  it('refuses a folder holding both layouts, saying what to do', async () => {
    const dataDirectory = writeFrenchDataDirectory();
    writeFile(path.join(dataDirectory, 'candidates', 'lea', 'profile', 'facts.md'), FACTS);

    await expect(createActions({ dataDirectory })).rejects.toMatchObject({ code: 'data_layout_mixed' });
    await expect(createActions({ dataDirectory })).rejects.toThrow(/candidats.*candidates/);
  });

  it('refuses a config holding both keys', async () => {
    const dataDirectory = mkdtempSync(path.join(tmpdir(), 'job-finder-'));
    writeFile(
      path.join(dataDirectory, 'config.json'),
      // cspell:disable-next-line
      JSON.stringify({ defaultDelayMonths: 6, candidatList: [], candidateList: [] }),
    );

    await expect(createActions({ dataDirectory })).rejects.toMatchObject({ code: 'config_keys_mixed' });
    // cspell:disable-next-line
    await expect(createActions({ dataDirectory })).rejects.toThrow(/candidatList.*candidateList/);
  });

  it('refuses a config it cannot read, saying where', async () => {
    const dataDirectory = mkdtempSync(path.join(tmpdir(), 'job-finder-'));
    writeFile(path.join(dataDirectory, 'config.json'), JSON.stringify({ defaultDelayMonths: 0, candidateList: [] }));

    await expect(createActions({ dataDirectory })).rejects.toMatchObject({ code: 'config_invalid' });
    await expect(createActions({ dataDirectory })).rejects.toThrow(/config\.json/);
  });

  it('refuses a known entry of an unexpected kind rather than guess', async () => {
    const dataDirectory = writeFrenchDataDirectory();
    const factsPath = path.join(dataDirectory, 'candidats', 'lea', 'profil', 'faits.md');
    rmSync(factsPath);
    mkdirSync(factsPath);

    await expect(createActions({ dataDirectory })).rejects.toMatchObject({ code: 'data_layout_unexpected' });
  });
});

// Léa's data folder as the jf of the Visualization left it: an Applied Posting whose first Interview has
// a Chosen Interview Brief, read by two Visualization Versions, one Chosen and one queued, with their
// folders and her own Visualization Instructions
function writeVisualizationDataDirectory(): string {
  const dataDirectory = mkdtempSync(path.join(tmpdir(), 'job-finder-'));
  const database = new DatabaseSync(writeOlderDatabase(dataDirectory, BEFORE_VISUALIZATION_REMOVAL_MIGRATION));
  database.exec(`INSERT INTO Candidate (id, name) VALUES ('lea', 'Léa');
    INSERT INTO DefaultDeadlinePeriod (id, months) VALUES (1, 6);
    INSERT INTO Posting (id, candidateId, source, reference, title, status, appliedAt, isInZone)
    VALUES (1, 'lea', 'pep', '2026-1', 'Greffier', 'applied', '2026-10-20T09:00:00.000+00:00', 1);
    INSERT INTO Interview (id, postingId, number, startAt, place, interviewers)
    VALUES (1, 1, 1, '2026-11-19T14:00:00.000+00:00', 'Lille', '');
    INSERT INTO Job (id, module, postingId, interviewId, state) VALUES (1, 'interview_brief', 1, 1, 'done');
    INSERT INTO Version (id, postingId, interviewId, artifact, number, isChosen, state, instructions, jobId)
    VALUES (1, 1, 1, 'interview_brief', 1, 1, 'ready', 'Réviser.', 1);
    INSERT INTO Job (id, module, postingId, interviewId, state) VALUES (2, 'visualization', 1, 1, 'done');
    INSERT INTO Version (id, postingId, interviewId, artifact, number, isChosen, state, instructions, jobId)
    VALUES (2, 1, 1, 'visualization', 1, 1, 'ready', 'Dessiner.', 2);
    INSERT INTO Job (id, module, postingId, interviewId, state) VALUES (3, 'visualization', 1, 1, 'queued');
    INSERT INTO Version (id, postingId, interviewId, artifact, number, state, instructions, jobId)
    VALUES (3, 1, 1, 'visualization', 2, 'running', 'Dessiner.', 3);
    INSERT INTO _Input (A, B) VALUES (1, 2), (1, 3);`);
  database.close();
  const leaDirectory = path.join(dataDirectory, 'candidates', 'lea');
  const interviewDirectory = path.join(leaDirectory, 'postings', '2026-1-greffier', 'interviews', '1');
  writeFile(path.join(leaDirectory, 'postings', '2026-1-greffier', 'job-description.md'), '# Greffier\n');
  writeFile(path.join(interviewDirectory, 'interview_brief', 'v1', 'interview-brief.md'), BRIEF_INSTRUCTIONS);
  writeFile(path.join(interviewDirectory, 'visualization', 'v1', 'visualization.html'), '<!DOCTYPE html></html>\n');
  mkdirSync(path.join(interviewDirectory, 'visualization', 'v2'), { recursive: true });
  writeFile(path.join(leaDirectory, 'instructions', 'visualization.md'), 'Une page courte.');
  writeFile(path.join(leaDirectory, 'instructions', 'interview_brief.md'), BRIEF_INSTRUCTIONS);
  return dataDirectory;
}

function selectAll(dataDirectory: string, sql: string): unknown[] {
  const database = new DatabaseSync(path.join(dataDirectory, 'job_finder.sqlite'), { readOnly: true });
  try {
    return database.prepare(sql).all();
  } finally {
    database.close();
  }
}

// The main checkout migrates Léa's real data/, which holds Visualizations: they go, the Interview Brief
// they read stays (ADR-0020)
describe('the Visualization of an older data folder', () => {
  it('goes with its Versions, its jobs, its folders and its Instructions', async () => {
    const dataDirectory = writeVisualizationDataDirectory();

    const actions = await createActions({ dataDirectory });

    expect(selectAll(dataDirectory, 'SELECT id, artifact FROM Version')).toEqual([
      { id: 1, artifact: 'interview_brief' },
    ]);
    expect(selectAll(dataDirectory, 'SELECT id, module FROM Job')).toEqual([{ id: 1, module: 'interview_brief' }]);
    expect(selectAll(dataDirectory, 'SELECT versionId FROM VersionInput')).toEqual([]);
    const interviewDirectory = path.join(
      dataDirectory,
      'candidates',
      'lea',
      'postings',
      '2026-1-greffier',
      'interviews',
      '1',
    );
    expect(listSorted(interviewDirectory)).toEqual(['interview_brief']);
    expect(listSorted(path.join(dataDirectory, 'candidates', 'lea', 'instructions'))).toEqual(['interview_brief.md']);
    expect(await actions.listVersions({ reference: '2026-1', artifact: 'interview_brief', interview: 1 })).toEqual([
      expect.objectContaining({ number: 1, isChosen: true }),
    ]);
    expect(await actions.runQueuedJobs()).toEqual([]);
  });

  it('changes nothing when opened again', async () => {
    const dataDirectory = writeVisualizationDataDirectory();
    await createActions({ dataDirectory });
    const entryList = snapshotOf(dataDirectory);

    await createActions({ dataDirectory });

    expect(snapshotOf(dataDirectory)).toEqual(entryList);
  });
});

// Léa's Versions as the jf before the Inputs left them, linked to the Versions they read: of their own
// Posting, on an Interview, the Letter sent for another Posting and the Research a Repost publishes again
function writeReadVersionDataDirectory(): string {
  const dataDirectory = mkdtempSync(path.join(tmpdir(), 'job-finder-'));
  const database = new DatabaseSync(writeOlderDatabase(dataDirectory, BEFORE_VERSION_INPUT_MIGRATION));
  database.exec(`INSERT INTO Candidate (id, name) VALUES ('lea', 'Léa');
    INSERT INTO DefaultDeadlinePeriod (id, months) VALUES (1, 6);
    INSERT INTO Posting (id, candidateId, source, reference, title, status, appliedAt, isInZone)
    VALUES (1, 'lea', 'pep', '2026-1', 'Greffier', 'applied', '2026-10-20T09:00:00.000+00:00', 1),
      (2, 'lea', 'pep', '2026-2', 'Greffier', 'applied', '2026-10-10T09:00:00.000+00:00', 1);
    INSERT INTO Posting (id, candidateId, source, reference, title, repostOfId, isInZone)
    VALUES (3, 'lea', 'pep', '2026-3', 'Greffier', 1, 1);
    INSERT INTO Interview (id, postingId, number, startAt, place, interviewers)
    VALUES (1, 1, 1, '2026-11-19T14:00:00.000+00:00', 'Lille', '');
    INSERT INTO Version (id, postingId, interviewId, artifact, number, isChosen, state, instructions) VALUES
      (1, 1, NULL, 'research', 1, 1, 'ready', 'Chercher.'),
      (2, 1, NULL, 'letter', 1, 1, 'ready', 'Écrire.'),
      (3, 2, NULL, 'letter', 1, 1, 'ready', 'Écrire.'),
      (4, 1, 1, 'interview_brief', 1, 1, 'ready', 'Réviser.'),
      (5, 1, 1, 'portrait', 1, 1, 'ready', 'Chercher.'),
      (6, 3, NULL, 'research', 1, 1, 'ready', 'Chercher.');
    INSERT INTO _Input (A, B) VALUES (2, 1), (2, 3), (4, 1), (4, 5), (6, 1);`);
  database.close();
  return dataDirectory;
}

// The main checkout migrates Léa's real data/, whose Versions read others: each link becomes a
// recorded Input, and nothing else is known of them (spec #125)
describe('the read Versions of an older database', () => {
  it('become recorded Inputs, keyed as the Artifact module resolves them', async () => {
    const dataDirectory = writeReadVersionDataDirectory();

    await createActions({ dataDirectory });

    expect(selectAll(dataDirectory, 'SELECT versionId, key, readVersionId FROM VersionInput ORDER BY id')).toEqual([
      { versionId: 2, key: 'artifact:research', readVersionId: 1 },
      { versionId: 2, key: 'posting:2026-2/letter', readVersionId: 3 },
      { versionId: 4, key: 'artifact:research', readVersionId: 1 },
      { versionId: 4, key: 'artifact:portrait@1', readVersionId: 5 },
      { versionId: 6, key: 'posting:2026-1/research', readVersionId: 1 },
    ]);
  });

  // Every Version is kept, each Chosen one Validated; a Letter without its first draft was brought
  it('keeps every Version, each given its validation and its origin', async () => {
    const dataDirectory = writeReadVersionDataDirectory();

    await createActions({ dataDirectory });

    expect(selectAll(dataDirectory, 'SELECT id, validation, origin FROM Version ORDER BY id')).toEqual([
      { id: 1, validation: 'validated', origin: 'ai' },
      { id: 2, validation: 'validated', origin: 'candidate' },
      { id: 3, validation: 'validated', origin: 'candidate' },
      { id: 4, validation: 'validated', origin: 'ai' },
      { id: 5, validation: 'validated', origin: 'ai' },
      { id: 6, validation: 'validated', origin: 'ai' },
    ]);
  });

  // A migrated record only knows the Versions it read: the other Inputs open checked by default
  it('prefills a regeneration: each Artifact as the Version read it, the other Inputs by default', async () => {
    const dataDirectory = writeReadVersionDataDirectory();
    writeFile(path.join(dataDirectory, 'candidates', 'lea', 'profile', 'letter-tj-lille-2025.md'), PAST_LETTER);
    const { artifacts } = await openContext({ dataDirectory });
    const brief = await artifacts.find({ reference: '2026-1', artifact: 'interview_brief', interview: 1 });

    const inputList = await brief.readInputs();

    expect(Object.fromEntries(inputList.map(({ key, isChecked }) => [key, isChecked]))).toEqual({
      job_description: true,
      'artifact:research': true,
      'artifact:letter': false,
      'artifact:portrait@1': true,
      'profile:letter-tj-lille-2025.md': true,
      'posting:2026-2/letter': false,
    });
  });
});

// Léa's To Apply Postings as the jf before New left them: one with a Research Version, one whose
// Research is only queued, one put back To Apply after it was Applied, one nobody looked at, Archived
// or not, beside an Applied one
function writeUnsortedDataDirectory(): string {
  const dataDirectory = mkdtempSync(path.join(tmpdir(), 'job-finder-'));
  const database = new DatabaseSync(writeOlderDatabase(dataDirectory, BEFORE_NEW_STATUS_MIGRATION));
  database.exec(`INSERT INTO Candidate (id, name) VALUES ('lea', 'Léa');
    INSERT INTO DefaultDeadlinePeriod (id, months) VALUES (1, 6);
    INSERT INTO Posting (id, candidateId, source, reference, title, status, appliedAt, archivedAt, isInZone) VALUES
      (1, 'lea', 'pep', '2026-1', 'Greffier', 'to_apply', NULL, NULL, 1),
      (2, 'lea', 'pep', '2026-2', 'Greffier', 'to_apply', NULL, NULL, 1),
      (3, 'lea', 'pep', '2026-3', 'Greffier', 'to_apply', '2026-10-20T09:00:00.000+00:00', NULL, 0),
      (4, 'lea', 'pep', '2026-4', 'Greffier', 'to_apply', NULL, NULL, 0),
      (5, 'lea', 'pep', '2026-5', 'Greffier', 'to_apply', NULL, '2026-10-21T09:00:00.000+00:00', 0),
      (6, 'lea', 'pep', '2026-6', 'Greffier', 'applied', '2026-10-20T09:00:00.000+00:00', NULL, 0);
    INSERT INTO Version (id, postingId, artifact, number, isChosen, state, instructions)
    VALUES (1, 1, 'research', 1, 1, 'ready', 'Chercher.');
    INSERT INTO Job (id, module, postingId, state) VALUES (1, 'research', 2, 'queued');
    INSERT INTO Job (id, module, postingId, state) VALUES (2, 'conversion', NULL, 'done');`);
  database.close();
  return dataDirectory;
}

// The main checkout migrates Léa's real data/, where To Apply filled up with Postings nobody sorted
// (ADR-0018): those with no Research become New, which she sorts
describe('the unsorted Postings of an older database', () => {
  it('become New when To Apply with no Research, never Applied', async () => {
    const dataDirectory = writeUnsortedDataDirectory();

    await createActions({ dataDirectory });

    expect(selectAll(dataDirectory, 'SELECT reference, status FROM Posting ORDER BY id')).toEqual([
      { reference: '2026-1', status: 'to_apply' },
      { reference: '2026-2', status: 'to_apply' },
      { reference: '2026-3', status: 'to_apply' },
      { reference: '2026-4', status: 'new' },
      { reference: '2026-5', status: 'new' },
      { reference: '2026-6', status: 'applied' },
    ]);
  });
});

// Léa's Watches as the jf with a Zone left them: the PEP one with its courts of appeal, one of
// another Source whose Parameters hold none, beside a Posting in the Zone and one out of it
function writeZonedDataDirectory(): string {
  const dataDirectory = mkdtempSync(path.join(tmpdir(), 'job-finder-'));
  const database = new DatabaseSync(writeOlderDatabase(dataDirectory, BEFORE_ZONE_REMOVAL_MIGRATION));
  database.exec(`INSERT INTO Candidate (id, name) VALUES ('lea', 'Léa');
    INSERT INTO DefaultDeadlinePeriod (id, months) VALUES (1, 6);
    INSERT INTO Watch (id, candidateId, source, parameters, detectedAt) VALUES
      ('hauts-de-france', 'lea', 'pep', '{"title":"attaché de justice","courtOfAppealList":["Douai","Amiens"]}',
        '2026-10-30T10:44:22.500+00:00'),
      ('other', 'lea', 'other', '{"title":"greffier"}', NULL);
    INSERT INTO Posting (id, candidateId, source, reference, title, status, isInZone) VALUES
      (1, 'lea', 'pep', '2026-1', 'Greffier', 'new', 1),
      (2, 'lea', 'pep', '2026-2', 'Greffier', 'to_apply', 0);`);
  database.close();
  return dataDirectory;
}

// The main checkout migrates Léa's real data/: the Candidate's sorting replaces the Zone (ADR-0018)
describe('the Zone of an older database', () => {
  it('leaves the Parameters of each Watch and its Postings, idempotently', async () => {
    const dataDirectory = writeZonedDataDirectory();

    await createActions({ dataDirectory });
    await createActions({ dataDirectory });

    expect(selectAll(dataDirectory, 'SELECT id, parameters, detectedAt FROM Watch ORDER BY id')).toEqual([
      {
        id: 'hauts-de-france',
        parameters: '{"title":"attaché de justice"}',
        detectedAt: '2026-10-30T10:44:22.500+00:00',
      },
      { id: 'other', parameters: '{"title":"greffier"}', detectedAt: null },
    ]);
    expect(selectAll(dataDirectory, "SELECT name FROM pragma_table_info('Posting') WHERE name = 'isInZone'")).toEqual(
      [],
    );
    expect(selectAll(dataDirectory, 'SELECT reference, status FROM Posting ORDER BY id')).toEqual([
      { reference: '2026-1', status: 'new' },
      { reference: '2026-2', status: 'to_apply' },
    ]);
  });
});

const AI_LETTER = '# Lettre telle que l’IA l’a écrite\n';
// A Letter stays plain Markdown: what MDX reads as syntax stays as she wrote it
const CORRECTED_LETTER = '# Lettre corrigée par Léa\n\nMoins de <5 ans {sic}.\n';
const BROUGHT_LETTER = '# Lettre apportée par Léa\n';
const PORTRAIT = '# Portrait du jury\n';
// A Markdown Brief holding what MDX reads as syntax, in its text and in code, which keeps it as is
const BRIEF = [
  '# Fiche d’entretien',
  '',
  'Un délai {raisonnable}, moins de <5 ans, un <b>mot</b>, déjà \\{échappé}.',
  '',
  'Le code `a{b}<c>` reste tel quel.',
  '',
  '```',
  '{ "rôle": "<juge>" }',
  '```',
  '',
].join('\n');
// The same Brief as MDX reads it, escaped by hand
const ESCAPED_BRIEF = [
  '# Fiche d’entretien',
  '',
  'Un délai \\{raisonnable}, moins de \\<5 ans, un \\<b>mot\\</b>, déjà \\{échappé}.',
  '',
  'Le code `a{b}<c>` reste tel quel.',
  '',
  '```',
  '{ "rôle": "<juge>" }',
  '```',
  '',
].join('\n');

// Léa's Versions as the jf before the Draft left them: a Research regenerated after its Chosen Version
// then failed once, another Posting's Research never chosen, a Letter she corrected beside one she
// brought, and an Interview's Portrait, chosen, and Brief, not
function writeChosenDataDirectory(): string {
  const dataDirectory = mkdtempSync(path.join(tmpdir(), 'job-finder-'));
  const database = new DatabaseSync(writeOlderDatabase(dataDirectory, BEFORE_VERSION_VALIDATION_MIGRATION));
  database.exec(`INSERT INTO Candidate (id, name) VALUES ('lea', 'Léa');
    INSERT INTO DefaultDeadlinePeriod (id, months) VALUES (1, 6);
    INSERT INTO Posting (id, candidateId, source, reference, title, status, appliedAt, isInZone) VALUES
      (1, 'lea', 'pep', '2026-1', 'Greffier', 'applied', '2026-10-20T09:00:00.000+00:00', 1),
      (2, 'lea', 'pep', '2026-2', 'Greffier', 'to_apply', NULL, 1);
    INSERT INTO Interview (id, postingId, number, startAt, place, interviewers)
    VALUES (1, 1, 1, '2026-11-19T14:00:00.000+00:00', 'Lille', '');
    INSERT INTO Version (id, postingId, interviewId, artifact, number, isChosen, state, instructions) VALUES
      (1, 1, NULL, 'research', 1, 0, 'ready', 'Chercher.'),
      (2, 1, NULL, 'research', 2, 1, 'ready', 'Chercher.'),
      (3, 1, NULL, 'research', 3, 0, 'ready', 'Chercher.'),
      (4, 1, NULL, 'research', 4, 0, 'failed', 'Chercher.'),
      (5, 2, NULL, 'research', 1, 0, 'ready', 'Chercher.'),
      (6, 1, NULL, 'letter', 1, 1, 'ready', 'Écrire.'),
      (7, 1, NULL, 'letter', 2, 0, 'ready', 'Écrire.'),
      (8, 1, 1, 'portrait', 1, 1, 'ready', 'Chercher.'),
      (9, 1, 1, 'interview_brief', 1, 0, 'ready', 'Réviser.');`);
  database.close();
  const postingsDirectory = path.join(dataDirectory, 'candidates', 'lea', 'postings');
  const firstDirectory = path.join(postingsDirectory, '2026-1-greffier');
  const interviewDirectory = path.join(firstDirectory, 'interviews', '1');
  writeFile(path.join(firstDirectory, 'job-description.md'), '# Greffier\n');
  writeFile(path.join(postingsDirectory, '2026-2-greffier', 'job-description.md'), '# Greffier\n');
  for (const number of ['v1', 'v2', 'v3']) {
    writeFile(path.join(firstDirectory, 'research', number, 'research.md'), RESEARCH);
  }
  mkdirSync(path.join(firstDirectory, 'research', 'v4'), { recursive: true });
  writeFile(path.join(postingsDirectory, '2026-2-greffier', 'research', 'v1', 'research.md'), RESEARCH);
  writeFile(path.join(firstDirectory, 'letter', 'v1', 'letter.md'), CORRECTED_LETTER);
  writeFile(path.join(firstDirectory, 'letter', 'v1', 'recipients.json'), RECIPIENTS);
  writeFile(path.join(firstDirectory, 'letter', 'v1', 'draft.md'), AI_LETTER);
  chmodSync(path.join(firstDirectory, 'letter', 'v1', 'draft.md'), 0o444);
  writeFile(path.join(firstDirectory, 'letter', 'v2', 'letter.md'), BROUGHT_LETTER);
  writeFile(path.join(interviewDirectory, 'portrait', 'v1', 'portrait.md'), PORTRAIT);
  writeFile(path.join(interviewDirectory, 'interview_brief', 'v1', 'interview-brief.md'), BRIEF);
  return dataDirectory;
}

// The text and the Original of each Version of a Posting, its Interviews' included, as the Posting page
// reads them
async function readVersionTexts(actions: Actions, reference: string): Promise<Record<string, unknown>> {
  const { artifactList, interviewList } = await actions.readPosting({ reference });
  return Object.fromEntries(
    [...artifactList, ...interviewList.flatMap((interview) => interview.artifactList)].flatMap(
      ({ artifact, versionList }) =>
        versionList.map(({ version: { number }, text, original }) => [
          `${artifact} v${String(number)}`,
          { text, original },
        ]),
    ),
  );
}

// The main checkout migrates Léa's real data/: her Chosen Versions and her corrections come through the
// V1, and every AI Version keeps the AI's text as its Original (spec #125, ADR-0019)
describe('the Versions of an older data folder', () => {
  it('are Validated up to the Chosen one, Drafts after it or without one', async () => {
    const dataDirectory = writeChosenDataDirectory();

    await createActions({ dataDirectory });

    expect(selectAll(dataDirectory, 'SELECT id, isChosen, validation FROM Version ORDER BY id')).toEqual([
      { id: 1, isChosen: 0, validation: 'validated' },
      { id: 2, isChosen: 1, validation: 'validated' },
      { id: 3, isChosen: 0, validation: 'draft' },
      { id: 4, isChosen: 0, validation: 'draft' },
      { id: 5, isChosen: 0, validation: 'draft' },
      { id: 6, isChosen: 1, validation: 'validated' },
      { id: 7, isChosen: 0, validation: 'draft' },
      { id: 8, isChosen: 1, validation: 'validated' },
      { id: 9, isChosen: 0, validation: 'draft' },
    ]);
  });

  it('keep the AI’s text as their Original: a Letter its first draft, a brought Letter none', async () => {
    const dataDirectory = writeChosenDataDirectory();

    const actions = await createActions({ dataDirectory });

    expect(selectAll(dataDirectory, 'SELECT id, origin FROM Version ORDER BY id')).toEqual([
      { id: 1, origin: 'ai' },
      { id: 2, origin: 'ai' },
      { id: 3, origin: 'ai' },
      { id: 4, origin: 'ai' },
      { id: 5, origin: 'ai' },
      { id: 6, origin: 'ai' },
      { id: 7, origin: 'candidate' },
      { id: 8, origin: 'ai' },
      { id: 9, origin: 'ai' },
    ]);
    expect(await readVersionTexts(actions, '2026-1')).toEqual({
      'research v1': { text: RESEARCH, original: RESEARCH },
      'research v2': { text: RESEARCH, original: RESEARCH },
      'research v3': { text: RESEARCH, original: RESEARCH },
      'research v4': { text: null, original: null },
      'letter v1': { text: CORRECTED_LETTER, original: AI_LETTER },
      'letter v2': { text: BROUGHT_LETTER, original: null },
      'portrait v1': { text: PORTRAIT, original: PORTRAIT },
      'interview_brief v1': { text: ESCAPED_BRIEF, original: ESCAPED_BRIEF },
    });
    expect(await readVersionTexts(actions, '2026-2')).toEqual({
      'research v1': { text: RESEARCH, original: RESEARCH },
    });
    const portraitOriginalPath = path.join(
      dataDirectory,
      'candidates/lea/postings/2026-1-greffier/interviews/1/portrait/v1/original.md',
    );
    expect(statSync(portraitOriginalPath).mode & 0o777).toBe(0o444);
  });

  it('escape, in their text and Original, what MDX reads as syntax, so that each compiles as written', async () => {
    const dataDirectory = writeChosenDataDirectory();

    const actions = await createActions({ dataDirectory });

    const { interviewList } = await actions.readPosting({ reference: '2026-1' });
    const brief = interviewList[0]?.artifactList.find(({ artifact }) => artifact === 'interview_brief');
    const html = renderToStaticMarkup(
      createElement(
        I18nextProvider,
        { i18n: i18nOf('en') },
        createElement(ArtifactText, { text: brief?.versionList[0]?.text ?? '', format: 'mdx' }),
      ),
    );
    expect(html).toContain(
      '<p>Un délai {raisonnable}, moins de &lt;5 ans, un &lt;b&gt;mot&lt;/b&gt;, déjà {échappé}.</p>',
    );
    expect(html).toContain('<code>a{b}&lt;c&gt;</code>');
    expect(html).not.toContain('does not compile as MDX');
    expect(html).not.toContain('Unknown component');
  });

  it('changes nothing when opened again', async () => {
    const dataDirectory = writeChosenDataDirectory();
    await createActions({ dataDirectory });
    const entryList = snapshotOf(dataDirectory);
    const versionList = selectAll(dataDirectory, 'SELECT * FROM Version ORDER BY id');

    await createActions({ dataDirectory });

    expect(snapshotOf(dataDirectory)).toEqual(entryList);
    expect(selectAll(dataDirectory, 'SELECT * FROM Version ORDER BY id')).toEqual(versionList);
  });

  // The worker and the web open the same data at their first launch: between one's check that an Original is
  // missing and its copy, the other may have kept it. No action can stop in that gap, hence the copy itself.
  it('leave the Original another launch has just kept, read-only', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'jf-original-'));
    const textPath = path.join(directory, 'research.md');
    const originalPath = path.join(directory, 'original.md');
    writeFileSync(textPath, RESEARCH);
    copyAsReadOnly(textPath, originalPath);
    writeFileSync(textPath, '# Corrected\n');

    copyAsReadOnly(textPath, originalPath);

    expect(readFileSync(originalPath, 'utf8')).toBe(RESEARCH);
    expect(statSync(originalPath).mode & 0o777).toBe(0o444);
  });

  // Rewritten in place, the text the other launch is copying would freeze as a truncated Original
  it('leave whole the text the other launch is copying while rewriting it', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'jf-original-'));
    const textPath = path.join(directory, 'research.md');
    writeFileSync(textPath, RESEARCH);
    const textBeingCopied = openSync(textPath, 'r');

    writeTextFile(textPath, '# Escaped\n');

    expect(readFileSync(textBeingCopied, 'utf8')).toBe(RESEARCH);
    expect(readFileSync(textPath, 'utf8')).toBe('# Escaped\n');
    closeSync(textBeingCopied);
  });

  it('close an Original the other launch has copied but not closed yet', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'jf-original-'));
    const textPath = path.join(directory, 'research.md');
    const originalPath = path.join(directory, 'original.md');
    writeFileSync(textPath, '# Corrected\n');
    writeFileSync(originalPath, RESEARCH, { mode: 0o644 });

    copyAsReadOnly(textPath, originalPath);

    expect(readFileSync(originalPath, 'utf8')).toBe(RESEARCH);
    expect(statSync(originalPath).mode & 0o777).toBe(0o444);
  });
});

describe('two launches on a data folder an older jf left', () => {
  // The worker and the web open the same data at their first launch. Prisma gives up on a database locked
  // for 5 s: here a process holds the lock longer than that, as a launch migrating at the same time can.
  it('migrate once the other has let go of the database, rather than crash', async () => {
    const dataDirectory = mkdtempSync(path.join(tmpdir(), 'jf-locked-'));
    const databasePath = writeOlderDatabase(dataDirectory, BEFORE_ZONE_REMOVAL_MIGRATION);
    const holder = spawn(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `import { DatabaseSync } from 'node:sqlite';
         const database = new DatabaseSync(${JSON.stringify(databasePath)});
         database.exec('BEGIN EXCLUSIVE');
         console.log('held');
         setTimeout(() => database.exec('COMMIT'), ${String(LOCK_HELD_MS)});`,
      ],
      { stdio: ['ignore', 'pipe', 'inherit'] },
    );
    await once(holder.stdout, 'data');

    await createActions({ dataDirectory });

    expect(selectAll(dataDirectory, 'PRAGMA table_info(Posting)')).not.toContainEqual(
      expect.objectContaining({ name: 'isInZone' }),
    );
  }, 20_000);
});
