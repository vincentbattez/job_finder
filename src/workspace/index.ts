import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { loadConfig } from './acl/config.ts';
import { openDatabase, type Database } from './acl/database.ts';

// Opens the data folder: reads its config, migrates the database and copies the config into it,
// and creates each Candidat's Profil folder on first launch. Safe to call on every launch. The
// config and the database are only read in acl/: only domain types come out (ADR-0005).
export async function openWorkspace(dataDirectory: string): Promise<Database> {
  const config = loadConfig(path.join(dataDirectory, 'config.json'));
  const database = openDatabase(path.join(dataDirectory, 'job_finder.sqlite'));
  await database.copyConfig(config);
  for (const candidat of config.candidatList) {
    mkdirSync(path.join(dataDirectory, 'candidats', candidat.id, 'profil'), { recursive: true });
  }
  return database;
}
