import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { Offre } from '#/domain/index.ts';

import { loadConfig } from './acl/config.ts';
import { openDatabase, type INewOffre } from './acl/database.ts';

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replaceAll(/\p{M}/gu, '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '');
}

// Opens the data folder: reads its config, migrates the database and copies the config into it,
// and creates each Candidat's Profil folder on first launch. Safe to call on every launch. The
// config and the database are only read in acl/: only domain types come out (ADR-0005).
export async function openWorkspace(dataDirectory: string) {
  const config = loadConfig(path.join(dataDirectory, 'config.json'));
  const database = openDatabase(path.join(dataDirectory, 'job_finder.sqlite'), config.defaultDelayMonths);
  await database.copyConfig(config);
  const profilDirectoryOf = (candidatId: string): string => path.join(dataDirectory, 'candidats', candidatId, 'profil');
  for (const candidat of config.candidatList) {
    mkdirSync(profilDirectoryOf(candidat.id), { recursive: true });
  }

  return {
    ...database,
    profilDirectoryOf,

    // Each Offre has a folder named by its reference and title, for its Fiche de poste and its
    // Artefacts. The Fiche de poste is written first, so an Offre in the database always has it.
    async saveOffre(newOffre: INewOffre): Promise<Offre> {
      const { reference, title } = newOffre.listedOffre;
      const offreDirectory = path.join(
        dataDirectory,
        'candidats',
        newOffre.candidatId,
        'offres',
        `${reference}-${slugify(title)}`,
      );
      mkdirSync(offreDirectory, { recursive: true });
      writeFileSync(path.join(offreDirectory, 'fiche-de-poste.md'), newOffre.fiche.markdown);
      return database.createOffre(newOffre);
    },
  };
}
