import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { loadConfig, type Config } from './config.ts';
import { openDatabase } from './database.ts';
import type { PrismaClient } from './generated/client.ts';

// Opens the data folder: reads its config, migrates the database and creates each Candidat's
// Profil folder on first launch, and copies the Candidats and Veilles of the config into the
// database. Safe to call on every launch.
export async function openWorkspace(dataDirectory: string): Promise<PrismaClient> {
  const config = loadConfig(path.join(dataDirectory, 'config.json'));
  const database = openDatabase(path.join(dataDirectory, 'job_finder.sqlite'));
  await copyConfigToDatabase(database, config);
  for (const candidat of config.candidatList) {
    mkdirSync(path.join(dataDirectory, 'candidats', candidat.id, 'profil'), { recursive: true });
  }
  return database;
}

// The config is the source of truth, so its Candidats and Veilles replace the copied rows.
// Removing from the config a Candidat who still has Offres makes the launch fail, through the
// foreign key, instead of leaving them orphaned.
async function copyConfigToDatabase(database: PrismaClient, config: Config): Promise<void> {
  const veilleList = config.candidatList.flatMap((candidat) =>
    candidat.veilleList.map((veille) => ({ ...veille, candidatId: candidat.id })),
  );
  await database.$transaction([
    database.veille.deleteMany(),
    database.candidat.deleteMany({ where: { id: { notIn: config.candidatList.map((candidat) => candidat.id) } } }),
    ...config.candidatList.map(({ id, name }) =>
      database.candidat.upsert({ where: { id }, create: { id, name }, update: { name } }),
    ),
    database.veille.createMany({ data: veilleList }),
  ]);
}
