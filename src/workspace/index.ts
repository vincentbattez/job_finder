import path from 'node:path';

import {
  FICHE_DE_POSTE_FILE_NAME,
  type Artefact,
  type FicheDePoste,
  type Lieu,
  type Offre,
  type PieceFileName,
  type ProfilFileName,
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
  readPieces,
  readTextFile,
  writePiece,
  writeTextFile,
} from './acl/files.ts';

const PIECES_FOLDER = 'pieces';
// Among the Pièces, but not one: neither a PDF nor a Markdown file of the Profil
const CONVERSION_FOLDER = '.conversion';

function slugify(text: string): string {
  return wordListOf(text).join('-');
}

// Safe to call on every launch; the database and the files are only read in acl/ (ADR-0005). The
// database holds the Candidats, their Veilles and the Délai par défaut: the config an older jf left
// is imported at the first launch of a database without settings, then never read again (ADR-0011).
export async function openWorkspace(dataDirectory: string) {
  const database = openDatabase(path.join(dataDirectory, 'job_finder.sqlite'));
  if (!(await database.hasSettings())) {
    await database.createSettings(readObsoleteConfig(dataDirectory));
  }
  await database.readDefaultDelayMonths();
  const candidatDirectoryOf = (candidatId: string): string => path.join(dataDirectory, 'candidats', candidatId);
  const profilDirectoryOf = (candidatId: string): string => path.join(candidatDirectoryOf(candidatId), 'profil');
  // Its own subfolder, which the Markdown files of the Profil leave out
  const piecesDirectoryOf = (candidatId: string): string => path.join(profilDirectoryOf(candidatId), PIECES_FOLDER);
  const consignesDirectoryOf = (candidatId: string): string => path.join(candidatDirectoryOf(candidatId), 'consignes');
  const candidatList = await database.listCandidats();
  for (const candidat of candidatList) {
    createDirectory(profilDirectoryOf(candidat.id));
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

    // A Candidat gets their Profil folder as soon as they exist, as at launch
    async createCandidat(candidat: { id: string; name: string }): Promise<void> {
      await database.createCandidat(candidat);
      createDirectory(profilDirectoryOf(candidat.id));
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

    // The Profil is a flat folder of Markdown files
    readProfilFiles(candidatId: string) {
      return readMarkdownFiles(profilDirectoryOf(candidatId));
    },

    saveProfilFile(candidatId: string, fileName: ProfilFileName, markdown: string): void {
      writeTextFile(path.join(profilDirectoryOf(candidatId), fileName), markdown);
    },

    deleteProfilFile(candidatId: string, fileName: ProfilFileName): void {
      deleteFile(path.join(profilDirectoryOf(candidatId), fileName));
    },

    readPieces(candidatId: string) {
      return readPieces(piecesDirectoryOf(candidatId));
    },

    savePiece(candidatId: string, fileName: PieceFileName, content: Uint8Array): void {
      writePiece(piecesDirectoryOf(candidatId), fileName, content);
    },

    deletePiece(candidatId: string, fileName: PieceFileName): void {
      deleteFile(path.join(piecesDirectoryOf(candidatId), fileName));
    },

    // The session converting a Pièce runs in the Profil, where it reads the Pièce, and writes in a
    // folder of its own, emptied first: the job moves its files into the Profil, never overwriting one
    startConversion(candidatId: string, piece: PieceFileName) {
      const outputDirectory = path.join(piecesDirectoryOf(candidatId), CONVERSION_FOLDER, piece);
      emptyDirectory(outputDirectory);
      return {
        profilDirectory: profilDirectoryOf(candidatId),
        piecePath: path.join(PIECES_FOLDER, piece),
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

    // A correction by the Candidat changes the Version in place, without creating another one
    writeVersionDocument(offre: Offre, version: Version, fileName: string, markdown: string): void {
      writeTextFile(path.join(versionDirectoryOf(offre, version), fileName), markdown);
    },

    // The Consignes with which a Candidat replaced the default ones of an Artefact, if any
    readConsignes(candidatId: string, artefact: Artefact): string | null {
      return readTextFile(path.join(consignesDirectoryOf(candidatId), `${artefact}.md`));
    },

    saveConsignes(candidatId: string, artefact: Artefact, consignes: string): void {
      writeTextFile(path.join(consignesDirectoryOf(candidatId), `${artefact}.md`), consignes);
    },

    deleteConsignes(candidatId: string, artefact: Artefact): void {
      deleteFile(path.join(consignesDirectoryOf(candidatId), `${artefact}.md`), { isMissingAllowed: true });
    },

    // The Fiche de poste is written first, so an Offre in the database always has it
    async saveOffre(newOffre: INewOffre): Promise<Offre> {
      const offreDirectory = offreDirectoryOf({ candidatId: newOffre.candidatId, ...newOffre.listedOffre });
      writeTextFile(path.join(offreDirectory, FICHE_DE_POSTE_FILE_NAME), newOffre.ficheDePoste.markdown);
      return database.createOffre(newOffre);
    },

    // The folder of an Offre is named after its title: it follows a new title
    async fillOffre(offre: Offre, fields: { title: string; ficheDePoste: FicheDePoste; lieu: Lieu }): Promise<Offre> {
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
