import path from 'node:path';

import {
  FICHE_DE_POSTE_FILE_NAME,
  type Artefact,
  type FicheDePoste,
  type Offre,
  type Place,
  type ProfileFileName,
  type UploadFileName,
  type Version,
} from '#/domain/index.ts';
import { wordListOf } from '#/text/index.ts';

import { findObsoleteConfig, readObsoleteConfig } from './acl/config.ts';
import { openDatabase, type INewOffre } from './acl/database.ts';
import {
  createDirectory,
  deleteFile,
  emptyDirectory,
  moveDirectory,
  readMarkdownFiles,
  readTextFile,
  readUploads,
  writeTextFile,
  writeUpload,
} from './acl/files.ts';
import { migrateLayout } from './layout.ts';

const UPLOADS_FOLDER = 'uploads';
// Among the Uploads, but not one: neither a PDF nor a Markdown file of the Profile
const CONVERSION_FOLDER = '.conversion';

function slugify(text: string): string {
  return wordListOf(text).join('-');
}

// Safe to call on every launch; the database and the files are only read in acl/ (ADR-0005). The
// database holds the Candidates, their Watches and the Default Deadline Period: the config an older jf left
// is imported at the first launch of a database without a Default Deadline Period, then never read again
// (ADR-0011). The French layout an older jf left moves to the English one first, before anything reads
// the data folder.
export async function openWorkspace(dataDirectory: string) {
  migrateLayout(dataDirectory);
  const database = openDatabase(path.join(dataDirectory, 'job_finder.sqlite'));
  if (!(await database.hasDefaultDeadlinePeriod())) {
    await database.createDefaultDeadlinePeriod(readObsoleteConfig(dataDirectory));
  }
  await database.readDefaultDeadlinePeriod();
  const candidateDirectoryOf = (candidateId: string): string => path.join(dataDirectory, 'candidates', candidateId);
  const profileDirectoryOf = (candidateId: string): string => path.join(candidateDirectoryOf(candidateId), 'profile');
  // Its own subfolder, which the Markdown files of the Profile leave out
  const uploadsDirectoryOf = (candidateId: string): string =>
    path.join(profileDirectoryOf(candidateId), UPLOADS_FOLDER);
  const instructionsDirectoryOf = (candidateId: string): string =>
    path.join(candidateDirectoryOf(candidateId), 'instructions');
  const candidateList = await database.listCandidates();
  for (const candidate of candidateList) {
    createDirectory(profileDirectoryOf(candidate.id));
  }

  // Each Offre has a folder named by its reference and title, for its Fiche de poste and its
  // Artefacts
  function offreDirectoryOf({ candidateId, reference, title }: Pick<Offre, 'candidateId' | 'reference' | 'title'>) {
    return path.join(candidateDirectoryOf(candidateId), 'offres', `${reference}-${slugify(title)}`);
  }

  // Each Version of an Artefact has its own folder, so a new launch never overwrites the others
  function versionDirectoryOf(offre: Offre, { artefact, number }: Version): string {
    return path.join(offreDirectoryOf(offre), artefact, `v${String(number)}`);
  }

  return {
    ...database,
    profileDirectoryOf,

    // A Candidate gets their Profile folder as soon as they exist, as at launch
    async createCandidate(candidate: { id: string; name: string }): Promise<void> {
      await database.createCandidate(candidate);
      createDirectory(profileDirectoryOf(candidate.id));
    },

    // The config left behind once imported, which jf says is no longer read until it is deleted
    findObsoleteConfig: () => findObsoleteConfig(dataDirectory),
    offreDirectoryOf,
    versionDirectoryOf,
    readTextFile,

    // The folder where a job's session writes its Version
    createVersionDirectory(offre: Offre, version: Version): string {
      const directory = versionDirectoryOf(offre, version);
      createDirectory(directory);
      return directory;
    },

    // The Profile is a flat folder of Markdown files
    readProfileFiles(candidateId: string) {
      return readMarkdownFiles(profileDirectoryOf(candidateId));
    },

    saveProfileFile(candidateId: string, fileName: ProfileFileName, markdown: string): void {
      writeTextFile(path.join(profileDirectoryOf(candidateId), fileName), markdown);
    },

    deleteProfileFile(candidateId: string, fileName: ProfileFileName): void {
      deleteFile(path.join(profileDirectoryOf(candidateId), fileName));
    },

    readUploads(candidateId: string) {
      return readUploads(uploadsDirectoryOf(candidateId));
    },

    saveUpload(candidateId: string, fileName: UploadFileName, content: Uint8Array): void {
      writeUpload(uploadsDirectoryOf(candidateId), fileName, content);
    },

    deleteUpload(candidateId: string, fileName: UploadFileName): void {
      deleteFile(path.join(uploadsDirectoryOf(candidateId), fileName));
    },

    // The session converting an Upload runs in the Profile, where it reads the Upload, and writes in a
    // folder of its own, emptied first: the job moves its files into the Profile, never overwriting one
    startConversion(candidateId: string, upload: UploadFileName) {
      const outputDirectory = path.join(uploadsDirectoryOf(candidateId), CONVERSION_FOLDER, upload);
      emptyDirectory(outputDirectory);
      return {
        profileDirectory: profileDirectoryOf(candidateId),
        uploadPath: path.join(UPLOADS_FOLDER, upload),
        outputDirectory,
      };
    },

    readConversionFiles(outputDirectory: string) {
      return readMarkdownFiles(outputDirectory);
    },

    // The Markdown files of a Version, such as the Brouillon and the Lettre of a Lettre Version
    readVersionDocuments(offre: Offre, version: Version) {
      return readMarkdownFiles(versionDirectoryOf(offre, version));
    },

    // A correction by the Candidate changes the Version in place, without creating another one
    writeVersionDocument(offre: Offre, version: Version, fileName: string, markdown: string): void {
      writeTextFile(path.join(versionDirectoryOf(offre, version), fileName), markdown);
    },

    // The Instructions with which a Candidate replaced the default ones of an Artefact, if any
    readInstructions(candidateId: string, artefact: Artefact): string | null {
      return readTextFile(path.join(instructionsDirectoryOf(candidateId), `${artefact}.md`));
    },

    saveInstructions(candidateId: string, artefact: Artefact, instructions: string): void {
      writeTextFile(path.join(instructionsDirectoryOf(candidateId), `${artefact}.md`), instructions);
    },

    deleteInstructions(candidateId: string, artefact: Artefact): void {
      deleteFile(path.join(instructionsDirectoryOf(candidateId), `${artefact}.md`), { isMissingAllowed: true });
    },

    // The Fiche de poste is written first, so an Offre in the database always has it
    async saveOffre(newOffre: INewOffre): Promise<Offre> {
      const offreDirectory = offreDirectoryOf({ candidateId: newOffre.candidateId, ...newOffre.listedOffre });
      writeTextFile(path.join(offreDirectory, FICHE_DE_POSTE_FILE_NAME), newOffre.ficheDePoste.markdown);
      return database.createOffre(newOffre);
    },

    // The folder of an Offre is named after its title: it follows a new title
    async fillOffre(offre: Offre, fields: { title: string; ficheDePoste: FicheDePoste; place: Place }): Promise<Offre> {
      const filledOffre = await database.fillOffre(offre, fields);
      moveDirectory(offreDirectoryOf(offre), offreDirectoryOf(filledOffre));
      return filledOffre;
    },

    readFicheDePoste(offre: Offre): string {
      const filePath = path.join(offreDirectoryOf(offre), FICHE_DE_POSTE_FILE_NAME);
      const ficheDePoste = readTextFile(filePath);
      if (ficheDePoste === null) {
        throw new Error(
          `Fiche de poste introuvable pour l'Offre ${offre.reference} : ${filePath}. La remettre à cet emplacement, d'où l'outil la lit.`,
        );
      }
      return ficheDePoste;
    },
  };
}

export type Workspace = Awaited<ReturnType<typeof openWorkspace>>;
