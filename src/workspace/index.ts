import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  FICHE_DE_POSTE_FILE_NAME,
  type Artefact,
  type FicheDePoste,
  type Lieu,
  type Offre,
  type Version,
} from '#/domain/index.ts';
import { wordListOf } from '#/text/index.ts';

import { loadConfig } from './acl/config.ts';
import { openDatabase, type INewOffre } from './acl/database.ts';
import { readMarkdownFiles, readTextFile } from './acl/files.ts';

function slugify(text: string): string {
  return wordListOf(text).join('-');
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
  const consignesDirectoryOf = (candidatId: string): string => path.join(candidatDirectoryOf(candidatId), 'consignes');
  for (const candidat of config.candidatList) {
    mkdirSync(profilDirectoryOf(candidat.id), { recursive: true });
  }

  // Each Offre has a folder named by its reference and title, for its Fiche de poste and its
  // Artefacts
  function offreDirectoryOf({ candidatId, reference, title }: Pick<Offre, 'candidatId' | 'reference' | 'title'>) {
    return path.join(candidatDirectoryOf(candidatId), 'offres', `${reference}-${slugify(title)}`);
  }

  // Each Version of an Artefact has its own folder, so a new launch never overwrites the others
  function versionDirectoryOf(offre: Offre, { artefact, number }: Version): string {
    return path.join(offreDirectoryOf(offre), artefact, `v${String(number)}`);
  }

  return {
    ...database,
    profilDirectoryOf,
    offreDirectoryOf,
    versionDirectoryOf,
    readTextFile,

    // The Profil is a flat folder of Markdown files
    readProfilFiles(candidatId: string) {
      return readMarkdownFiles(profilDirectoryOf(candidatId));
    },

    saveProfilFile(candidatId: string, fileName: string, markdown: string): void {
      writeFileSync(path.join(profilDirectoryOf(candidatId), fileName), markdown);
    },

    // The Markdown files of a Version, such as the Brouillon and the Lettre of a Lettre Version
    readVersionDocuments(offre: Offre, version: Version) {
      return readMarkdownFiles(versionDirectoryOf(offre, version));
    },

    // A correction by the Candidat changes the Version in place, without creating another one
    writeVersionDocument(offre: Offre, version: Version, fileName: string, markdown: string): void {
      writeFileSync(path.join(versionDirectoryOf(offre, version), fileName), markdown);
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
      return readTextFile(path.join(consignesDirectoryOf(candidatId), `${artefact}.md`));
    },

    saveConsignes(candidatId: string, artefact: Artefact, consignes: string): void {
      mkdirSync(consignesDirectoryOf(candidatId), { recursive: true });
      writeFileSync(path.join(consignesDirectoryOf(candidatId), `${artefact}.md`), consignes);
    },

    deleteConsignes(candidatId: string, artefact: Artefact): void {
      rmSync(path.join(consignesDirectoryOf(candidatId), `${artefact}.md`), { force: true });
    },

    // The Fiche de poste is written first, so an Offre in the database always has it
    async saveOffre(newOffre: INewOffre): Promise<Offre> {
      const offreDirectory = offreDirectoryOf({ candidatId: newOffre.candidatId, ...newOffre.listedOffre });
      mkdirSync(offreDirectory, { recursive: true });
      writeFileSync(path.join(offreDirectory, FICHE_DE_POSTE_FILE_NAME), newOffre.fiche.markdown);
      return database.createOffre(newOffre);
    },

    // The folder of an Offre is named after its title: it follows a new title
    async fillOffre(offre: Offre, fields: { title: string; fiche: FicheDePoste; lieu: Lieu }): Promise<Offre> {
      const filledOffre = await database.fillOffre(offre, fields);
      renameSync(offreDirectoryOf(offre), offreDirectoryOf(filledOffre));
      return filledOffre;
    },

    readFicheDePoste(offre: Offre): string {
      const filePath = path.join(offreDirectoryOf(offre), FICHE_DE_POSTE_FILE_NAME);
      const ficheDePoste = readTextFile(filePath);
      if (ficheDePoste === null) {
        throw new Error(`Fiche de poste introuvable pour l'Offre ${offre.reference} : ${filePath}`);
      }
      return ficheDePoste;
    },
  };
}

export type Workspace = Awaited<ReturnType<typeof openWorkspace>>;
