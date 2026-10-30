import { execFileSync } from 'node:child_process';
import path from 'node:path';

// import.meta.resolve does not exist where Vitest runs its global setup
const PRISMA_CLI_PATH = path.join(import.meta.dirname, '..', 'node_modules', 'prisma', 'build', 'index.js');

// Migrates the database as jf does at launch (ADR-0004), with the migrations of prisma.config.ts
// unless another config names others
export function migrateDeploy(databasePath: string, configPath?: string): void {
  const configArgumentList = configPath === undefined ? [] : ['--config', configPath];
  execFileSync(process.execPath, [PRISMA_CLI_PATH, 'migrate', 'deploy', ...configArgumentList], {
    env: { ...process.env, DATABASE_URL: `file:${databasePath}`, CHECKPOINT_DISABLE: '1' },
    stdio: 'pipe',
  });
}
