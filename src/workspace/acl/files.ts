import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { z } from 'zod/v4';

import { MARKDOWN_FILE_SCHEMA, type MarkdownFile } from '#/domain/index.ts';

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
