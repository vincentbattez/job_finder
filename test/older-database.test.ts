import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { describe, expect, it } from 'vitest';

import { writeOlderDatabase } from './older-database.ts';

const FIRST_MIGRATION = '20261029133617_init';

function createDataDirectory(): string {
  return mkdtempSync(path.join(tmpdir(), 'job-finder-'));
}

function listMigrationNames(databasePath: string): unknown[] {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    return database.prepare('SELECT migration_name FROM _prisma_migrations ORDER BY migration_name').all();
  } finally {
    database.close();
  }
}

describe('writeOlderDatabase', () => {
  it('writes a database holding the migrations up to the given one, in the data folder', () => {
    const dataDirectory = createDataDirectory();

    const databasePath = writeOlderDatabase(dataDirectory, FIRST_MIGRATION);

    expect(databasePath).toBe(path.join(dataDirectory, 'job_finder.sqlite'));
    expect(listMigrationNames(databasePath)).toEqual([{ migration_name: FIRST_MIGRATION }]);
  });

  // A test fills its database with raw SQL: two tests at the same migration never share a file
  it('gives each data folder its own copy of the same older database', () => {
    const firstPath = writeOlderDatabase(createDataDirectory(), FIRST_MIGRATION);
    const database = new DatabaseSync(firstPath);
    database.exec("INSERT INTO Candidat (id, name) VALUES ('lea', 'Léa')");
    database.close();

    const secondPath = writeOlderDatabase(createDataDirectory(), FIRST_MIGRATION);

    const second = new DatabaseSync(secondPath, { readOnly: true });
    expect(second.prepare('SELECT count(*) AS count FROM Candidat').get()).toEqual({ count: 0 });
    second.close();
  });
});
