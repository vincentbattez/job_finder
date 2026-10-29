import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const SCHEMA_SQL = readFileSync(new URL('schema.sql', import.meta.url), 'utf8');

export function openDatabase(path: string): DatabaseSync {
  const database = new DatabaseSync(path);
  database.exec('PRAGMA foreign_keys = ON');
  database.exec(SCHEMA_SQL);
  return database;
}
