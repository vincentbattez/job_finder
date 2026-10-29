import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { loadConfig } from './acl/config.ts';
import { openDatabase } from './acl/database.ts';

// Opens the data folder: reads its config, migrates the database and copies the config into it,
// and creates each Candidat's Profil folder on first launch. Safe to call on every launch. The
// config and the database are only read in acl/: only domain types come out (ADR-0005).
export async function openWorkspace(dataDirectory: string) {
  const config = loadConfig(path.join(dataDirectory, 'config.json'));
  const database = openDatabase(path.join(dataDirectory, 'job_finder.sqlite'));
  await database.copyConfig(config);
  const profilDirectoryOf = (candidatId: string): string => path.join(dataDirectory, 'candidats', candidatId, 'profil');
  for (const candidat of config.candidatList) {
    mkdirSync(profilDirectoryOf(candidat.id), { recursive: true });
  }
  return { ...database, profilDirectoryOf };
}
