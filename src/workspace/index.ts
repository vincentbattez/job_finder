import path from 'node:path';

import { tFor } from '#/domain/catalogue/i18n.ts';
import {
  JOB_DESCRIPTION_FILE_NAME,
  type Artifact,
  type JobDescription,
  type Locale,
  type Location,
  type Posting,
  type ProfileFileName,
  type UploadFileName,
  type Version,
} from '#/domain/index.ts';
import { wordListOf } from '#/text/index.ts';

import { findObsoleteConfig, readObsoleteConfig } from './acl/config.ts';
import { openDatabase, type INewCandidate, type INewPosting } from './acl/database.ts';
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

  // Each Posting has a folder named by its reference and title, for its Job Description and its
  // Artifacts
  function postingDirectoryOf({ candidateId, reference, title }: Pick<Posting, 'candidateId' | 'reference' | 'title'>) {
    return path.join(candidateDirectoryOf(candidateId), 'postings', `${reference}-${slugify(title)}`);
  }

  // Each Version of an Artifact has its own folder, so a new launch never overwrites the others
  function versionDirectoryOf(posting: Posting, { artifact, number }: Version): string {
    return path.join(postingDirectoryOf(posting), artifact, `v${String(number)}`);
  }

  return {
    ...database,
    profileDirectoryOf,

    // A Candidate gets their Profile folder as soon as they exist, as at launch
    async createCandidate(candidate: INewCandidate): Promise<void> {
      await database.createCandidate(candidate);
      createDirectory(profileDirectoryOf(candidate.id));
    },

    // The config left behind once imported, which jf says is no longer read until it is deleted
    findObsoleteConfig: () => findObsoleteConfig(dataDirectory),
    postingDirectoryOf,
    versionDirectoryOf,
    readTextFile,

    // The folder where a job's session writes its Version
    createVersionDirectory(posting: Posting, version: Version): string {
      const directory = versionDirectoryOf(posting, version);
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

    // The Markdown files of a Version, such as the Draft and the Letter of a Letter Version
    readVersionDocuments(posting: Posting, version: Version) {
      return readMarkdownFiles(versionDirectoryOf(posting, version));
    },

    // A correction by the Candidate changes the Version in place, without creating another one
    writeVersionDocument(posting: Posting, version: Version, fileName: string, markdown: string): void {
      writeTextFile(path.join(versionDirectoryOf(posting, version), fileName), markdown);
    },

    // The Instructions with which a Candidate replaced the default ones of an Artifact, if any
    readInstructions(candidateId: string, artifact: Artifact): string | null {
      return readTextFile(path.join(instructionsDirectoryOf(candidateId), `${artifact}.md`));
    },

    saveInstructions(candidateId: string, artifact: Artifact, instructions: string): void {
      writeTextFile(path.join(instructionsDirectoryOf(candidateId), `${artifact}.md`), instructions);
    },

    deleteInstructions(candidateId: string, artifact: Artifact): void {
      deleteFile(path.join(instructionsDirectoryOf(candidateId), `${artifact}.md`), { isMissingAllowed: true });
    },

    // The Job Description is written first, so a Posting in the database always has it
    async savePosting(newPosting: INewPosting): Promise<Posting> {
      const postingDirectory = postingDirectoryOf({ candidateId: newPosting.candidateId, ...newPosting.listedPosting });
      writeTextFile(path.join(postingDirectory, JOB_DESCRIPTION_FILE_NAME), newPosting.jobDescription.markdown);
      return database.createPosting(newPosting);
    },

    // The folder of a Posting is named after its title: it follows a new title
    async fillPosting(
      posting: Posting,
      fields: { title: string; jobDescription: JobDescription; location: Location },
    ): Promise<Posting> {
      const filledPosting = await database.fillPosting(posting, fields);
      moveDirectory(postingDirectoryOf(posting), postingDirectoryOf(filledPosting));
      return filledPosting;
    },

    // The locale of the Candidate of the Posting, in which a missing file is told
    readJobDescription(posting: Posting, locale: Locale): string {
      const filePath = path.join(postingDirectoryOf(posting), JOB_DESCRIPTION_FILE_NAME);
      const jobDescription = readTextFile(filePath);
      if (jobDescription === null) {
        throw new Error(tFor(locale, 'error')('missingJobDescription', { reference: posting.reference, filePath }));
      }
      return jobDescription;
    },
  };
}

export type Workspace = Awaited<ReturnType<typeof openWorkspace>>;
