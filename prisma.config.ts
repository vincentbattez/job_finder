import path from 'node:path';

import { defineConfig } from 'prisma/config';

// Prisma commands work on the development data, never on data/, unless DATABASE_URL says otherwise
const DEVELOPMENT_DATABASE_URL = `file:${path.join(import.meta.dirname, 'dev-data', 'job_finder.sqlite')}`;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'node prisma/seed.ts' },
  datasource: { url: process.env.DATABASE_URL ?? DEVELOPMENT_DATABASE_URL },
});
