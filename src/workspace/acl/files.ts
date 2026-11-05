import {
  chmodSync,
  constants,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

import { z } from 'zod/v4';

import {
  DATED_MARKDOWN_FILE_SCHEMA,
  MARKDOWN_FILE_SCHEMA,
  UPLOAD_SCHEMA,
  type DatedMarkdownFile,
  type MarkdownFile,
  type Upload,
  type UploadFileName,
} from '#/domain/index.ts';

// A text file of the data folder, or null when it does not exist
export function readTextFile(filePath: string): string | null {
  return existsSync(filePath) ? readFileSync(filePath, 'utf8') : null;
}

// The Markdown files of a folder by name, none when the folder does not exist
export function readMarkdownFiles(directory: string): MarkdownFile[] {
  const fileNameList = existsSync(directory) ? readdirSync(directory) : [];
  return z.array(MARKDOWN_FILE_SCHEMA).parse(
    fileNameList
      .filter((fileName) => fileName.endsWith('.md'))
      .toSorted((first, second) => first.localeCompare(second))
      .map((fileName) => ({ fileName, markdown: readFileSync(path.join(directory, fileName), 'utf8') })),
  );
}

// The same files, each dated by its last write
export function readDatedMarkdownFiles(directory: string): DatedMarkdownFile[] {
  return z.array(DATED_MARKDOWN_FILE_SCHEMA).parse(
    readMarkdownFiles(directory).map((file) => ({
      ...file,
      savedAt: statSync(path.join(directory, file.fileName)).mtime,
    })),
  );
}

// The Uploads of a folder by name, dated by their last write; none when the folder does not exist
export function readUploads(directory: string): Upload[] {
  const fileNameList = existsSync(directory) ? readdirSync(directory) : [];
  return z.array(UPLOAD_SCHEMA).parse(
    fileNameList
      .filter((fileName) => fileName.toLowerCase().endsWith('.pdf'))
      .toSorted((first, second) => first.localeCompare(second))
      .map((fileName) => ({ fileName, savedAt: statSync(path.join(directory, fileName)).mtime })),
  );
}

// The bytes of an Upload, written as received (ADR-0005)
export function writeUpload(directory: string, fileName: UploadFileName, content: Uint8Array): void {
  mkdirSync(directory, { recursive: true });
  writeFileSync(path.join(directory, fileName), content);
}

// A document's bytes, written as received, its folder created first
export function writeBinaryFile(filePath: string, content: Uint8Array): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

export function createDirectory(directory: string): void {
  mkdirSync(directory, { recursive: true });
}

// A session's output folder: what an earlier run left never passes for what this one wrote
export function emptyDirectory(directory: string): void {
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });
}

// Its folder is created first, so a file is written wherever the workspace places it. Written beside it
// then renamed over it: another process reads or copies the old text or the new one, never half of it
export function writeTextFile(filePath: string, text: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${String(process.pid)}.tmp`;
  writeFileSync(temporaryPath, text);
  renameSync(temporaryPath, filePath);
}

const EXISTING_FILE_ERROR_SCHEMA = z.object({ code: z.literal('EEXIST') });

// A copy no one may write, not even the session of jf edit. The first copy stays: the worker and the web
// starting together may both keep the same Original (ADR-0004), and the second only closes it too.
export function copyAsReadOnly(fromPath: string, toPath: string): void {
  try {
    copyFileSync(fromPath, toPath, constants.COPYFILE_EXCL);
  } catch (error) {
    if (!EXISTING_FILE_ERROR_SCHEMA.safeParse(error).success) {
      throw error;
    }
  }
  chmodSync(toPath, 0o444);
}

// Throws when the file does not exist, unless it is allowed to be missing
export function deleteFile(filePath: string, { isMissingAllowed = false } = {}): void {
  rmSync(filePath, { force: isMissingAllowed });
}

// A folder and all it holds; one that does not exist is already the outcome
export function deleteDirectory(directory: string): void {
  rmSync(directory, { recursive: true, force: true });
}

// A file moved within the data folder, its own folder created first
export function moveFile(from: string, to: string): void {
  mkdirSync(path.dirname(to), { recursive: true });
  renameSync(from, to);
}

export function moveDirectory(from: string, to: string): void {
  renameSync(from, to);
}
