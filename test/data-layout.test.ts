import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
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
// Léa's Watch and the last Detection of her live data/, from before the English code
const WATCH_PARAMETERS = { title: 'attaché de justice', courtOfAppealList: ['Douai', 'Amiens'] };
const DETECTED_AT = new Date('2026-10-30T10:44:22.500Z');
// An attaché de justice Posting of the recorded DSJ feed, which her last Detection already saved
const KNOWN_REFERENCE = '2026-2445600';
const FRENCH_CONFIG = JSON.stringify({
  defaultDelayMonths: 6,
  candidatList: [{ id: 'lea', name: 'Léa', watchList: [{ id: 'lea-1', source: 'pep', parameters: WATCH_PARAMETERS }] }],
});

function writeFile(filePath: string, content: string | Uint8Array): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

// Léa's data folder as the French jf left it: a database at the last French migration, holding an
// Offre with a Version made from her own Consignes and the conversion of a Pièce, her folders and the
// config an older jf read
function writeFrenchDataDirectory(): string {
  const dataDirectory = mkdtempSync(path.join(tmpdir(), 'job-finder-'));
  const database = new DatabaseSync(writeOlderDatabase(dataDirectory, BEFORE_CANDIDATE_MIGRATION));
  database.exec(`INSERT INTO Candidat (id, name) VALUES ('lea', 'Léa');
    INSERT INTO DelaiParDefaut (id, months) VALUES (1, 6);
    INSERT INTO Veille (id, candidatId, source, parametres, detectedAt)
    VALUES ('lea-1', 'lea', 'pep', '{"title":"attaché de justice","courtOfAppealList":["Douai","Amiens"]}', '2026-10-30T10:44:22.500+00:00');
    INSERT INTO CanalNotification (candidatId, module, parametres) VALUES ('lea', 'faux', '{"target":"notify.mobile_app_iphone_de_lea"}');
    INSERT INTO Offre (id, candidatId, source, reference, title, isInZone) VALUES (1, 'lea', 'pep', '2026-1', 'Greffier', 1);
    INSERT INTO Offre (id, candidatId, source, reference, title, isInZone) VALUES (2, 'lea', 'pep', '2026-2445600', 'Attaché de justice', 1);
    INSERT INTO Job (id, module, offreId, state) VALUES (1, 'lettre', 1, 'done');
    INSERT INTO Version (offreId, artefact, number, isRetenue, state, consignes, hasCandidatConsignes, jobId)
    VALUES (1, 'lettre', 1, 1, 'ready', 'Une lettre courte.', 1, 1);
    INSERT INTO Job (id, module, candidatId, piece, state, log) VALUES (2, 'conversion', 'lea', 'cv.pdf', 'done', 'Converti.');`);
  database.close();
  const leaDirectory = path.join(dataDirectory, 'candidats', 'lea');
  writeFile(path.join(leaDirectory, 'profil', 'faits.md'), FACTS);
  writeFile(path.join(leaDirectory, 'profil', 'cv.md'), CV);
  writeFile(path.join(leaDirectory, 'profil', 'pieces', 'cv.pdf'), CV_PDF);
  writeFile(path.join(leaDirectory, 'consignes', 'lettre.md'), LETTER_INSTRUCTIONS);
  writeFile(path.join(leaDirectory, 'offres', '2026-1-greffier', 'fiche-de-poste.md'), '# Greffier\n');
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

    expect(await actions.listCandidates()).toEqual([{ id: 'lea', name: 'Léa' }]);
    expect(await actions.listProfileFiles({ candidateId: 'lea' })).toEqual([
      { fileName: 'cv.md', markdown: CV },
      { fileName: 'facts.md', markdown: FACTS },
    ]);
    expect(await actions.readFacts({ candidateId: 'lea' })).toContainEqual(
      expect.objectContaining({ title: 'Mobilité', entryList: ['- Lille et alentours'] }),
    );
    expect(await actions.listUploads({ candidateId: 'lea' })).toEqual([
      expect.objectContaining({ fileName: 'cv.pdf', conversion: { etat: 'pret', log: 'Converti.' } }),
    ]);
    expect(await actions.readInstructions({ candidateId: 'lea', module: 'lettre' })).toMatchObject({
      candidateInstructions: LETTER_INSTRUCTIONS,
    });
    expect(await actions.listVersions({ reference: '2026-1', artefact: 'lettre' })).toEqual([
      expect.objectContaining({ isRetenue: true, instructions: LETTER_INSTRUCTIONS, hasCandidateInstructions: true }),
    ]);
    expect(await actions.listWatches({ candidateId: 'lea' })).toEqual([
      { id: 'lea-1', candidateId: 'lea', source: 'pep', parameters: WATCH_PARAMETERS, detectedAt: DETECTED_AT },
    ]);
    expect(await actions.readDefaultDeadlinePeriod()).toEqual({ months: 6 });
    expect(listSorted(dataDirectory)).toEqual(['candidates', 'config.json', 'job_finder.sqlite']);
    expect(listSorted(path.join(dataDirectory, 'candidates', 'lea'))).toEqual(['instructions', 'offres', 'profile']);
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
    expect(detection?.newOffreList.map(({ reference }) => reference)).not.toContain(KNOWN_REFERENCE);
    expect(notificationChannel.sentList.length).toBeGreaterThan(0);
    expect(notificationChannel.sentList.every(({ target }) => target === LEA_TARGET)).toBe(true);
    const offreList = await actions.listOffres({ candidateId: 'lea' });
    expect(offreList.filter(({ reference }) => reference === KNOWN_REFERENCE)).toHaveLength(1);
  });

  // A fresh database imports the config once: a French-keyed one still brings its Candidates
  it('imports a French-keyed config into a new database', async () => {
    const dataDirectory = mkdtempSync(path.join(tmpdir(), 'job-finder-'));
    writeFile(path.join(dataDirectory, 'config.json'), FRENCH_CONFIG);

    const actions = await createActions({ dataDirectory });

    expect(await actions.listCandidates()).toEqual([{ id: 'lea', name: 'Léa' }]);
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
      JSON.stringify({ defaultDelayMonths: 6, candidatList: [], candidateList: [] }),
    );

    await expect(createActions({ dataDirectory })).rejects.toMatchObject({ code: 'data_layout_mixed' });
  });

  it('refuses a known entry of an unexpected kind rather than guess', async () => {
    const dataDirectory = writeFrenchDataDirectory();
    const factsPath = path.join(dataDirectory, 'candidats', 'lea', 'profil', 'faits.md');
    rmSync(factsPath);
    mkdirSync(factsPath);

    await expect(createActions({ dataDirectory })).rejects.toMatchObject({ code: 'data_layout_unexpected' });
  });
});
