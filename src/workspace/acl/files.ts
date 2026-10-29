import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

// A text file of the data folder, or null when it does not exist
export function readTextFile(filePath: string): string | null {
  return existsSync(filePath) ? readFileSync(filePath, 'utf8') : null;
}

// The Markdown files of a folder by name, none when the folder does not exist
export function readMarkdownFiles(directory: string): { fileName: string; markdown: string }[] {
  const fileNameList = existsSync(directory) ? readdirSync(directory) : [];
  return fileNameList
    .filter((fileName) => fileName.endsWith('.md'))
    .toSorted((first, second) => first.localeCompare(second))
    .map((fileName) => ({ fileName, markdown: readFileSync(path.join(directory, fileName), 'utf8') }));
}
