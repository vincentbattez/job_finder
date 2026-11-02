import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { describe, expect, it } from 'vitest';

import { createActions } from '#/actions/index.ts';

import { createDataDirectory } from './data-directory.ts';
import { writeOlderDatabase } from './older-database.ts';
import { migrateDeploy } from './prisma-cli.ts';

function createEmptyDataDirectory(): string {
  return mkdtempSync(path.join(tmpdir(), 'job-finder-'));
}

function writeConfig(dataDirectory: string, config: object): void {
  writeFileSync(path.join(dataDirectory, 'config.json'), JSON.stringify(config));
}

const LEA_CONFIG = { id: 'lea', name: 'Léa', watchList: [] };

const FIRST_MIGRATION = '20261029133617_init';
// The last migration before the Notification Channels, which turned each Home Assistant connection
// into one (ADR-0010)
const HOME_ASSISTANT_CONNECTION_MIGRATION = '20261030090736_job_profil';
// The last migration before the Sources became a family, which gathered the criteria and the Zone of
// each Watch into its Parameters (ADR-0010)
const NOTIFICATION_CHANNEL_MIGRATION = '20261030110155_canal_notification';
// The last migration before the row of the settings became that of the Default Deadline Period
const SETTINGS_MIGRATION = '20261030114047_settings';
// The last migration before Archived left the Status for a mark beside it (ADR-0007)
const BEFORE_ARCHIVED_MARK_MIGRATION = '20261031000306_job_started_at_and_worker_heartbeat';

// The last migration before the Start Date of a Posting
const BEFORE_START_DATE_MIGRATION = '20261031110442_posting_unpublished_at';

function writeJobDescription(postingDirectory: string, markdown: string): void {
  mkdirSync(postingDirectory, { recursive: true });
  writeFileSync(path.join(postingDirectory, 'job-description.md'), markdown);
}

function listLeaProfileFiles(dataDirectory: string): string[] {
  return readdirSync(path.join(dataDirectory, 'candidates', 'lea', 'profile'));
}

describe('actions', () => {
  it('lists the Candidates', async () => {
    const actions = await createActions({ dataDirectory: createDataDirectory() });

    expect(await actions.listCandidates()).toEqual([{ id: 'lea', name: 'Léa', locale: 'fr' }]);
  });

  it('gives each Candidate an empty Profile folder on first launch', async () => {
    const dataDirectory = createDataDirectory();

    await createActions({ dataDirectory });

    expect(listLeaProfileFiles(dataDirectory)).toEqual([]);
  });

  it('keeps the existing Profile and Candidates when launched again', async () => {
    const dataDirectory = createDataDirectory();
    await createActions({ dataDirectory });
    writeFileSync(path.join(dataDirectory, 'candidates', 'lea', 'profile', 'facts.md'), '# Faits\n');

    const actions = await createActions({ dataDirectory });

    expect(listLeaProfileFiles(dataDirectory)).toEqual(['facts.md']);
    expect(await actions.listCandidates()).toEqual([{ id: 'lea', name: 'Léa', locale: 'fr' }]);
  });

  // The real data/ comes with the config the older jf read: it is imported too (ADR-0011)
  it('brings the database an older jf left up to date', async () => {
    const dataDirectory = createEmptyDataDirectory();
    writeConfig(dataDirectory, { defaultDelayMonths: 6, candidateList: [LEA_CONFIG] });
    writeOlderDatabase(dataDirectory, FIRST_MIGRATION);

    const actions = await createActions({ dataDirectory });

    // The Notification Channels came with a later migration
    expect(await actions.readNotificationChannel({ candidateId: 'lea' })).toEqual({
      module: null,
      parameters: {},
      configuredSecretList: [],
    });
  });

  // The main checkout migrates the real data/: Léa keeps her connection, nothing to type again
  it('turns the Home Assistant connection of each Candidate into their Notification Channel, without loss', async () => {
    const dataDirectory = createEmptyDataDirectory();
    writeConfig(dataDirectory, { defaultDelayMonths: 6, candidateList: [LEA_CONFIG] });
    const database = new DatabaseSync(writeOlderDatabase(dataDirectory, HOME_ASSISTANT_CONNECTION_MIGRATION));
    database.exec(`INSERT INTO Candidat (id, name) VALUES ('lea', 'Léa');
      INSERT INTO ConnexionHomeAssistant (candidatId, url, token, service)
      VALUES ('lea', 'https://domotique.example', 'jeton-de-lea', 'notify.mobile_app_iphone_de_lea');`);
    database.close();

    const actions = await createActions({ dataDirectory });

    expect(await actions.readNotificationChannel({ candidateId: 'lea' })).toEqual({
      module: 'home-assistant',
      parameters: { url: 'https://domotique.example', service: 'notify.mobile_app_iphone_de_lea' },
      configuredSecretList: ['token'],
    });
    const migrated = new DatabaseSync(path.join(dataDirectory, 'job_finder.sqlite'), { readOnly: true });
    expect(
      migrated.prepare("SELECT json_extract(parameters, '$.token') AS token FROM NotificationChannel").get(),
    ).toEqual({
      token: 'jeton-de-lea',
    });
    migrated.close();
  });

  // The main checkout migrates the real data/: each Watch keeps its Parameters and its first launch
  // stays over, so the next Detection triggers as before
  it('gathers the criteria and the Zone of each Watch into the Parameters of its Source, without loss', () => {
    const dataDirectory = createEmptyDataDirectory();
    const databasePath = writeOlderDatabase(dataDirectory, NOTIFICATION_CHANNEL_MIGRATION);
    const database = new DatabaseSync(databasePath);
    database.exec(`INSERT INTO Candidat (id, name) VALUES ('lea', 'Léa');
      INSERT INTO Veille (id, candidatId, source, criteria, zone, detectedAt)
      VALUES ('attache-de-justice-hauts-de-france', 'lea', 'pep', '{"title":"attaché de justice"}',
        '{"courtOfAppealList":["Douai","Amiens"]}', '2026-10-30T10:44:22.500+00:00');`);
    database.close();

    migrateDeploy(databasePath);

    const migrated = new DatabaseSync(databasePath, { readOnly: true });
    expect(migrated.prepare('SELECT id, candidateId, source, parameters, detectedAt FROM Watch').all()).toEqual([
      {
        id: 'attache-de-justice-hauts-de-france',
        candidateId: 'lea',
        source: 'pep',
        parameters: '{"title":"attaché de justice","courtOfAppealList":["Douai","Amiens"]}',
        detectedAt: '2026-10-30T10:44:22.500+00:00',
      },
    ]);
    migrated.close();
  });

  // The main checkout migrates the real data/: the Default Deadline Period stays, and so does the mark that
  // the config was imported, which is never read again
  it('keeps the Default Deadline Period of the settings, and the import over', async () => {
    const dataDirectory = createEmptyDataDirectory();
    const database = new DatabaseSync(writeOlderDatabase(dataDirectory, SETTINGS_MIGRATION));
    database.exec(`INSERT INTO Settings (id, defaultDelayMonths) VALUES (1, 7);`);
    database.close();
    writeConfig(dataDirectory, { defaultDelayMonths: 2, candidateList: [LEA_CONFIG] });

    const actions = await createActions({ dataDirectory });

    expect(await actions.readDefaultDeadlinePeriod()).toEqual({ months: 7 });
    expect(await actions.listCandidates()).toEqual([]);
  });

  // The main checkout migrates the real data/: each Archived Posting finds the Status it had, Applied
  // if it ever was, and keeps the mark, its Letter frozen if it was sent (ADR-0007)
  it('turns the Archived Status into the Archived mark, without loss', async () => {
    const dataDirectory = createEmptyDataDirectory();
    const database = new DatabaseSync(writeOlderDatabase(dataDirectory, BEFORE_ARCHIVED_MARK_MIGRATION));
    database.exec(`INSERT INTO Candidate (id, name) VALUES ('lea', 'Léa');
      INSERT INTO Posting (id, candidateId, source, reference, title, status, appliedAt, isInZone)
      VALUES (1, 'lea', 'pep', '2026-1', 'Greffier', 'archived', '2026-10-20T09:00:00.000+00:00', 1);
      INSERT INTO Posting (id, candidateId, source, reference, title, status, isInZone)
      VALUES (2, 'lea', 'pep', '2026-2', 'Greffier', 'archived', 1);
      INSERT INTO Posting (id, candidateId, source, reference, title, status, appliedAt, isInZone)
      VALUES (3, 'lea', 'pep', '2026-3', 'Greffier', 'applied', '2026-10-21T09:00:00.000+00:00', 1);
      INSERT INTO Posting (id, candidateId, source, reference, title, isInZone) VALUES (4, 'lea', 'pep', '2026-4', 'Greffier', 1);`);
    database.close();
    const before = Date.now();

    const actions = await createActions({ dataDirectory });

    const postingList = await actions.listPostings({ candidateId: 'lea' });
    expect(
      postingList
        .toSorted((first, second) => first.reference.localeCompare(second.reference))
        .map(({ reference, status, appliedAt, archivedAt }) => ({
          reference,
          status,
          appliedAt,
          isArchived: archivedAt !== null,
        })),
    ).toEqual([
      { reference: '2026-1', status: 'applied', appliedAt: new Date('2026-10-20T09:00:00Z'), isArchived: true },
      { reference: '2026-2', status: 'to_apply', appliedAt: null, isArchived: true },
      { reference: '2026-3', status: 'applied', appliedAt: new Date('2026-10-21T09:00:00Z'), isArchived: false },
      { reference: '2026-4', status: 'to_apply', appliedAt: null, isArchived: false },
    ]);
    // Dated from the migration, the day it was archived having never been kept; SQLite keeps seconds
    const archivedAt = postingList.find(({ reference }) => reference === '2026-2')?.archivedAt;
    expect(archivedAt?.getTime()).toBeGreaterThanOrEqual(Math.floor(before / 1000) * 1000);
    await expect(actions.runModule({ module: 'letter', reference: '2026-1' })).rejects.toMatchObject({
      code: 'letter_frozen',
    });
    await actions.unarchive({ reference: '2026-1' });
    expect(await actions.listPostings({ candidateId: 'lea' })).toContainEqual(
      expect.objectContaining({ reference: '2026-1', status: 'applied', archivedAt: null }),
    );
  });

  // The main checkout migrates the real data/: each Posting gets the Start Date its stored Job
  // Description gives, and launching again changes nothing
  it('fills the Start Date of the existing Postings from their Job Descriptions, idempotently', async () => {
    const dataDirectory = createEmptyDataDirectory();
    const database = new DatabaseSync(writeOlderDatabase(dataDirectory, BEFORE_START_DATE_MIGRATION));
    database.exec(`INSERT INTO Candidate (id, name) VALUES ('lea', 'Léa');
      INSERT INTO Posting (candidateId, source, reference, title, isInZone) VALUES ('lea', 'pep', '2026-1', 'Greffier', 1);
      INSERT INTO Posting (candidateId, source, reference, title, isInZone) VALUES ('lea', 'pep', '2026-2', 'Greffier', 1);`);
    database.close();
    const postingsDirectory = path.join(dataDirectory, 'candidates', 'lea', 'postings');
    // As the PEP Source stored them: the day under its heading, or no such heading
    // cspell:disable
    writeJobDescription(
      path.join(postingsDirectory, '2026-1-greffier'),
      "### Lieu d'affectation\n\nTribunal judiciaire de Lille\n\n### Date de vacance de l'emploi\n\n01/12/2026\n",
    );
    writeJobDescription(path.join(postingsDirectory, '2026-2-greffier'), '### Description du poste\n\nGreffier\n');
    // cspell:enable

    await createActions({ dataDirectory });
    const actions = await createActions({ dataDirectory });

    const postingList = await actions.listPostings({ candidateId: 'lea' });
    expect(
      postingList
        .map(({ reference, startDate }) => ({ reference, startDate }))
        .toSorted((first, second) => first.reference.localeCompare(second.reference)),
    ).toEqual([
      { reference: '2026-1', startDate: new Date('2026-12-01T00:00:00Z') },
      { reference: '2026-2', startDate: null },
    ]);
  });

  it('refuses to list the Postings of an unknown Candidate', async () => {
    const actions = await createActions({ dataDirectory: createDataDirectory() });

    await expect(actions.listPostings({ candidateId: 'inconnu' })).rejects.toThrow(/Candidat inconnu : inconnu/);
  });

  it('starts in an empty data folder, creating its database, without any config', async () => {
    const actions = await createActions({ dataDirectory: createEmptyDataDirectory() });

    expect(await actions.listCandidates()).toEqual([]);
  });
});
