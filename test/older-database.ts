import { copyFileSync, cpSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { migrateDeploy } from './prisma-cli.ts';

const PRISMA_DIRECTORY = path.join(import.meta.dirname, '..', 'prisma');

// The database at each older migration, migrated once per test file then copied: the Prisma CLI
// takes hundreds of milliseconds to start, and the upgrade at launch (ADR-0004) still spawns it
// for every copy
const DATABASE_PATH_BY_MIGRATION = new Map<string, string>();

// The database an older jf left in a data folder, migrated through a config that only knows the
// migrations up to the given one; a test then fills it with raw SQL in the shape of that time, so it
// always gets its own copy
export function writeOlderDatabase(dataDirectory: string, lastMigration: string): string {
  let sourcePath = DATABASE_PATH_BY_MIGRATION.get(lastMigration);
  if (sourcePath === undefined) {
    sourcePath = migrateOlderDatabase(lastMigration);
    DATABASE_PATH_BY_MIGRATION.set(lastMigration, sourcePath);
  }
  const databasePath = path.join(dataDirectory, 'job_finder.sqlite');
  copyFileSync(sourcePath, databasePath);
  return databasePath;
}

// Migrates a fresh database inside its own temporary Prisma folder, kept as the source of the copies
function migrateOlderDatabase(lastMigration: string): string {
  const prismaDirectory = mkdtempSync(path.join(tmpdir(), 'job-finder-prisma-'));
  const migrationList = readdirSync(path.join(PRISMA_DIRECTORY, 'migrations')).filter(
    (fileName) => fileName <= lastMigration || fileName === 'migration_lock.toml',
  );
  for (const fileName of migrationList) {
    cpSync(path.join(PRISMA_DIRECTORY, 'migrations', fileName), path.join(prismaDirectory, 'migrations', fileName), {
      recursive: true,
    });
  }
  const databasePath = path.join(prismaDirectory, 'job_finder.sqlite');
  const config = {
    schema: path.join(PRISMA_DIRECTORY, 'schema.prisma'),
    migrations: { path: path.join(prismaDirectory, 'migrations') },
    datasource: { url: `file:${databasePath}` },
  };
  const configPath = path.join(prismaDirectory, 'prisma.config.ts');
  writeFileSync(configPath, `export default ${JSON.stringify(config)};`);
  migrateDeploy(databasePath, configPath);
  return databasePath;
}
