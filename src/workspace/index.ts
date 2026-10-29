import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';

import { loadConfig, type Config } from './config.ts';
import { openDatabase } from './database.ts';

// Opens the data folder: reads its config, creates the SQLite schema and each Candidat's
// Profil folder on first launch, and copies the Candidats and Veilles of the config into the
// database. Safe to call on every launch.
export function openWorkspace(dataDirectory: string): DatabaseSync {
  const config = loadConfig(path.join(dataDirectory, 'config.json'));
  const database = openDatabase(path.join(dataDirectory, 'job_finder.sqlite'));
  copyConfigToDatabase(database, config);
  for (const candidat of config.candidatList) {
    mkdirSync(path.join(dataDirectory, 'candidats', candidat.id, 'profil'), { recursive: true });
  }
  return database;
}

// The config is the source of truth, so its Candidats and Veilles replace the copied rows.
// Foreign keys are checked at commit: removing from the config a Candidat who still has Offres
// makes the launch fail instead of leaving them orphaned.
function copyConfigToDatabase(database: DatabaseSync, config: Config): void {
  const insertCandidatStatement = database.prepare('INSERT INTO candidat (id, name) VALUES (?, ?)');
  const insertVeilleStatement = database.prepare(
    'INSERT INTO veille (id, candidat_id, source, criteria, zone) VALUES (?, ?, ?, ?, ?)',
  );
  database.exec('BEGIN; PRAGMA defer_foreign_keys = ON; DELETE FROM veille; DELETE FROM candidat;');
  try {
    for (const candidat of config.candidatList) {
      insertCandidatStatement.run(candidat.id, candidat.name);
      for (const veille of candidat.veilleList) {
        insertVeilleStatement.run(
          veille.id,
          candidat.id,
          veille.source,
          JSON.stringify(veille.criteria),
          JSON.stringify(veille.zone),
        );
      }
    }
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}
