import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { Artefact, Offre, Version } from '#/domain/index.ts';

import { loadConfig } from './acl/config.ts';
import { openDatabase, type INewOffre } from './acl/database.ts';
import { readTextFile } from './acl/files.ts';

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
  const candidatDirectoryOf = (candidatId: string): string => path.join(dataDirectory, 'candidats', candidatId);
  const profilDirectoryOf = (candidatId: string): string => path.join(candidatDirectoryOf(candidatId), 'profil');
  for (const candidat of config.candidatList) {
    mkdirSync(profilDirectoryOf(candidat.id), { recursive: true });
  }

  // Each Offre has a folder named by its reference and title, for its Fiche de poste and its
  // Artefacts
  function offreDirectoryOf({ candidatId, reference, title }: Pick<Offre, 'candidatId' | 'reference' | 'title'>) {
    return path.join(candidatDirectoryOf(candidatId), 'offres', `${reference}-${slugify(title)}`);
  }

  return {
    ...database,
    profilDirectoryOf,
    offreDirectoryOf,
    readTextFile,

    // Each Version of an Artefact has its own folder, so a new launch never overwrites the others
    versionDirectoryOf(offre: Offre, { artefact, number }: Version): string {
      return path.join(offreDirectoryOf(offre), artefact, `v${String(number)}`);
    },

    // Where a Candidat receives their notifications, as their config names it
    notificationTargetOf(candidatId: string): string {
      const candidat = config.candidatList.find(({ id }) => id === candidatId);
      if (candidat === undefined) {
        throw new Error(`Candidat inconnu : ${candidatId}. « jf candidats » liste les Candidats.`);
      }
      return candidat.notification.service;
    },

    // The Consignes with which a Candidat replaced the default ones of an Artefact, if any
    readConsignes(candidatId: string, artefact: Artefact): string | null {
      return readTextFile(path.join(candidatDirectoryOf(candidatId), 'consignes', `${artefact}.md`));
    },

    // The Fiche de poste is written first, so an Offre in the database always has it
    async saveOffre(newOffre: INewOffre): Promise<Offre> {
      const offreDirectory = offreDirectoryOf({ candidatId: newOffre.candidatId, ...newOffre.listedOffre });
      mkdirSync(offreDirectory, { recursive: true });
      writeFileSync(path.join(offreDirectory, 'fiche-de-poste.md'), newOffre.fiche.markdown);
      return database.createOffre(newOffre);
    },
  };
}

export type Workspace = Awaited<ReturnType<typeof openWorkspace>>;
