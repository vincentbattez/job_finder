import { chmodSync, copyFileSync } from 'node:fs';

// The copy is the one to edit: the original becomes read-only
export function copyAsReadOnlyOriginal(originalPath: string, copyPath: string): void {
  copyFileSync(originalPath, copyPath);
  chmodSync(originalPath, 0o444);
}
