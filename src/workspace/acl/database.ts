import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { z } from 'zod/v4';

import { CANDIDAT_SCHEMA, type Candidat } from '#/domain/index.ts';
import { PrismaClient } from '#/workspace/generated/client.ts';

import type { Config } from './config.ts';

const ROOT_DIRECTORY = path.join(import.meta.dirname, '..', '..', '..');
const PRISMA_CLI_PATH = fileURLToPath(import.meta.resolve('prisma/build/index.js'));

// Applies the pending migrations of prisma/migrations first, so the schema exists from the
// first launch and follows every upgrade. Prisma never leaves this file: every row read is
// parsed into a domain type (ADR-0005).
export function openDatabase(databasePath: string) {
  const url = `file:${databasePath}`;
  execFileSync(process.execPath, [PRISMA_CLI_PATH, 'migrate', 'deploy'], {
    cwd: ROOT_DIRECTORY,
    env: { ...process.env, DATABASE_URL: url, CHECKPOINT_DISABLE: '1' },
    stdio: 'pipe',
  });
  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

  return {
    async listCandidats(): Promise<Candidat[]> {
      return z.array(CANDIDAT_SCHEMA).parse(await prisma.candidat.findMany({ orderBy: { name: 'asc' } }));
    },

    // The config is the source of truth, so its Candidats and Veilles replace the copied rows.
    // Removing from the config a Candidat who still has Offres makes the launch fail, through the
    // foreign key, instead of leaving them orphaned.
    async copyConfig(config: Config): Promise<void> {
      const veilleList = config.candidatList.flatMap((candidat) =>
        candidat.veilleList.map((veille) => ({ ...veille, candidatId: candidat.id })),
      );
      await prisma.$transaction([
        prisma.veille.deleteMany(),
        prisma.candidat.deleteMany({ where: { id: { notIn: config.candidatList.map((candidat) => candidat.id) } } }),
        ...config.candidatList.map(({ id, name }) =>
          prisma.candidat.upsert({ where: { id }, create: { id, name }, update: { name } }),
        ),
        prisma.veille.createMany({ data: veilleList }),
      ]);
    },
  };
}
