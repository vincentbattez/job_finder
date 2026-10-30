import { existsSync, readdirSync, renameSync, statSync } from 'node:fs';

// What an entry of the data folder is, null when it does not exist
export function kindOf(entryPath: string): 'file' | 'directory' | null {
  if (!existsSync(entryPath)) {
    return null;
  }
  return statSync(entryPath).isDirectory() ? 'directory' : 'file';
}

// The names in a folder, none when it does not exist
export function listEntries(directory: string): string[] {
  return kindOf(directory) === 'directory' ? readdirSync(directory) : [];
}

// A rename keeps the entry as it is, a read-only file included. Another process opening the workspace
// at the same time may have moved it first: that is the same outcome.
export function moveEntry(from: string, to: string): void {
  try {
    renameSync(from, to);
  } catch (error) {
    if (existsSync(from) || !existsSync(to)) {
      throw error;
    }
  }
}
