import { cpSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { migrateDeploy } from './prisma-cli.ts';

const PRISMA_DIRECTORY = path.join(import.meta.dirname, '..', 'prisma');

// The database an older jf left in a data folder, migrated through a config that only knows the
// migrations up to the given one; a test then fills it with raw SQL in the shape of that time
export function writeOlderDatabase(dataDirectory: string, lastMigration: string): string {
  const prismaDirectory = mkdtempSync(path.join(tmpdir(), 'job-finder-prisma-'));
  const migrationList = readdirSync(path.join(PRISMA_DIRECTORY, 'migrations')).filter(
    (fileName) => fileName <= lastMigration || fileName === 'migration_lock.toml',
  );
  for (const fileName of migrationList) {
    cpSync(path.join(PRISMA_DIRECTORY, 'migrations', fileName), path.join(prismaDirectory, 'migrations', fileName), {
      recursive: true,
    });
  }
  const databasePath = path.join(dataDirectory, 'job_finder.sqlite');
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
