import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { z } from 'zod/v4';

import {
  MARKDOWN_FILE_SCHEMA,
  PIECE_SCHEMA,
  type MarkdownFile,
  type Piece,
  type PieceFileName,
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

// The Pièces of a folder by name, dated by their last write; none when the folder does not exist
export function readPieces(directory: string): Piece[] {
  const fileNameList = existsSync(directory) ? readdirSync(directory) : [];
  return z.array(PIECE_SCHEMA).parse(
    fileNameList
      .filter((fileName) => fileName.toLowerCase().endsWith('.pdf'))
      .toSorted((first, second) => first.localeCompare(second))
      .map((fileName) => ({ fileName, savedAt: statSync(path.join(directory, fileName)).mtime })),
  );
}

// The bytes of a Pièce, written as received (ADR-0005)
export function writePiece(directory: string, fileName: PieceFileName, content: Uint8Array): void {
  mkdirSync(directory, { recursive: true });
  writeFileSync(path.join(directory, fileName), content);
}
