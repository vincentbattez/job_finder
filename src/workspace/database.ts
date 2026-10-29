import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

import { PrismaClient } from './generated/client.ts';

const ROOT_DIRECTORY = path.join(import.meta.dirname, '..', '..');
const PRISMA_CLI_PATH = fileURLToPath(import.meta.resolve('prisma/build/index.js'));

// Applies the pending migrations of prisma/migrations first, so the schema exists from the
// first launch and follows every upgrade.
export function openDatabase(databasePath: string): PrismaClient {
  const url = `file:${databasePath}`;
  execFileSync(process.execPath, [PRISMA_CLI_PATH, 'migrate', 'deploy'], {
    cwd: ROOT_DIRECTORY,
    env: { ...process.env, DATABASE_URL: url, CHECKPOINT_DISABLE: '1' },
    stdio: 'pipe',
  });
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
}
