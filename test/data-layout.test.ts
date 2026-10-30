import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { describe, expect, it } from 'vitest';

import { createActions } from '#/actions/index.ts';

import { writeOlderDatabase } from './older-database.ts';

// The last migration before the Candidate side spoke English
const BEFORE_CANDIDATE_MIGRATION = '20261030122214_delai_par_defaut';

const FACTS = '# Faits\n\n## Mobilité\n\n- Lille et alentours\n';
const CV = '# CV de Léa\n';
const CV_PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
const LETTER_INSTRUCTIONS = 'Une lettre courte.';
const FRENCH_CONFIG = JSON.stringify({
  defaultDelayMonths: 6,
  candidatList: [{ id: 'lea', name: 'Léa', veilleList: [] }],
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
    INSERT INTO Veille (id, candidatId, source, parametres) VALUES ('lea-1', 'lea', 'pep', '{}');
    INSERT INTO Offre (id, candidatId, source, reference, title, isInZone) VALUES (1, 'lea', 'pep', '2026-1', 'Greffier', 1);
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
    expect(listSorted(dataDirectory)).toEqual(['candidates', 'config.json', 'job_finder.sqlite']);
    expect(listSorted(path.join(dataDirectory, 'candidates', 'lea'))).toEqual(['instructions', 'offres', 'profile']);
  });

  it('rewrites the keys of the config an older jf left', async () => {
    const dataDirectory = writeFrenchDataDirectory();

    await createActions({ dataDirectory });

    const config: unknown = JSON.parse(readFileSync(path.join(dataDirectory, 'config.json'), 'utf8'));
    expect(config).toEqual({
      defaultDelayMonths: 6,
      candidateList: [{ id: 'lea', name: 'Léa', veilleList: [] }],
    });
  });

  // A fresh database imports the config once: a French-keyed one still brings its Candidates
  it('imports a French-keyed config into a new database', async () => {
    const dataDirectory = mkdtempSync(path.join(tmpdir(), 'job-finder-'));
    writeFile(path.join(dataDirectory, 'config.json'), FRENCH_CONFIG);

    const actions = await createActions({ dataDirectory });

    expect(await actions.listCandidates()).toEqual([{ id: 'lea', name: 'Léa' }]);
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
