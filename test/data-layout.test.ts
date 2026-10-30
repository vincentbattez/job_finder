import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { describe, expect, it } from 'vitest';

import { createActions } from '#/actions/index.ts';

import { createFakeNotificationChannel, LEA_TARGET } from './fake-notification-channel.ts';
import { writeOlderDatabase } from './older-database.ts';
import { createRecordedFetch } from './recorded-http.ts';

// The last migration before the Candidate side spoke English
const BEFORE_CANDIDATE_MIGRATION = '20261030122214_delai_par_defaut';

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
      { id: 'lea-1', candidateId: 'lea', source: 'pep', parameters: WATCH_PARAMETERS, detectedAt: DETECTED_AT },
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
        .map(({ reference, status, appliedAt, deadline, repostOf, repostList }) => ({
          reference,
          status,
          appliedAt,
          deadline,
          repostOf,
          repostList,
        })),
    ).toEqual([
      {
        reference: '2026-1',
        status: 'applied',
        appliedAt: new Date('2026-10-20T09:00:00Z'),
        deadline: new Date('2026-11-20T00:00:00Z'),
        repostOf: null,
        repostList: [{ reference: '2026-3' }],
      },
      {
        reference: '2026-2445600',
        status: 'to_apply',
        appliedAt: null,
        deadline: null,
        repostOf: null,
        repostList: [],
      },
      {
        reference: '2026-3',
        status: 'archived',
        appliedAt: null,
        deadline: null,
        repostOf: { reference: '2026-1' },
        repostList: [],
      },
    ]);
    const { jobDescription } = await actions.readPosting({ reference: '2026-3' });
    expect(jobDescription).toBe('# Greffier, encore\n');
    expect(listSorted(path.join(dataDirectory, 'candidates', 'lea', 'postings', '2026-1-greffier'))).toEqual([
      'interview_brief',
      'job-description.md',
      'letter',
      'research',
    ]);
  });

  // The Letter she sent stays the one recorded: no correction, no new Version, no other Version retained
  it('keeps the Letter of an Applied Posting frozen', async () => {
    const dataDirectory = writeFrenchDataDirectory();

    const actions = await createActions({ dataDirectory });

    const { nextStatusList, artifactList } = await actions.readPosting({ reference: '2026-1' });
    expect(nextStatusList).toEqual(['archived']);
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
      'draft.md',
    );
    expect(readFileSync(draftPath, 'utf8')).toBe(DRAFT);
    expect(statSync(draftPath).mode & 0o777).toBe(0o444);
  });

  // Each Version keeps its number, its Instructions, the Versions it read and whether it is chosen; a
  // failed or queued Job reads back under its English module
  it('keeps every Version of each Artifact, its Chosen Version, its inputs and its Jobs', async () => {
    const dataDirectory = writeFrenchDataDirectory();

    const actions = await createActions({ dataDirectory });

    expect(await actions.listVersions({ reference: '2026-1', artifact: 'research' })).toEqual([
      expect.objectContaining({ artifact: 'research', number: 1, isChosen: false }),
      expect.objectContaining({ artifact: 'research', number: 2, isChosen: true }),
    ]);
    expect(await actions.listVersions({ reference: '2026-1', artifact: 'letter' })).toEqual([
      expect.objectContaining({
        inputList: [{ artifact: 'research', number: 2, posting: { reference: '2026-1' } }],
      }),
    ]);
    const { artifactList, recipients } = await actions.readPosting({ reference: '2026-1' });
    expect(Object.fromEntries(artifactList.map(({ artifact, state }) => [artifact, state]))).toEqual({
      research: 'ready',
      letter: 'ready',
      interview_brief: 'failed',
      visualization: 'absent',
    });
    const research = artifactList.find(({ artifact }) => artifact === 'research');
    expect(research?.versionList[1]?.documentList).toEqual([
      expect.objectContaining({ fileName: 'research.md', markdown: RESEARCH }),
    ]);
    const letter = artifactList.find(({ artifact }) => artifact === 'letter');
    expect(letter?.versionList[0]?.documentList.map(({ fileName }) => fileName)).toEqual(
      expect.arrayContaining(['draft.md', 'letter.md']),
    );
    expect(recipients).toEqual(JSON.parse(RECIPIENTS));
    const { artifactList: queuedArtifactList } = await actions.readPosting({ reference: '2026-3' });
    expect(queuedArtifactList.find(({ artifact }) => artifact === 'visualization')).toMatchObject({
      state: 'in_progress',
    });
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

  // Her daily Detection goes on after the update: no first launch, so a new Posting in her Zone gets
  // its Research and her phone hears of it, through the Notification Channel she had saved
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
      { id: 'lea-1', candidateId: 'lea', source: 'pep', parameters: WATCH_PARAMETERS, detectedAt: null },
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
