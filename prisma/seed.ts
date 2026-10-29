import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

import { fakerFR as faker } from '@faker-js/faker';

import type { Prisma } from '#/workspace/generated/client.ts';
import { openWorkspace } from '#/workspace/index.ts';

// Same folder as the default database of prisma.config.ts
const DEVELOPMENT_DATA_DIRECTORY = path.join(import.meta.dirname, '..', 'dev-data');
const EXAMPLE_CONFIG_PATH = path.join(import.meta.dirname, '..', 'config.example.json');
const OFFRE_COUNT_PER_CANDIDAT = 30;
const COURT_OF_APPEAL_LIST = ['Douai', 'Amiens', 'Paris', 'Rennes', 'Lyon', 'Bordeaux'];
const SERVICE_LIST = ['pôle civil', 'pôle pénal', 'parquet', "service de l'application des peines", 'pôle mineurs'];

function fakeOffre(candidatId: string): Prisma.OffreUncheckedCreateInput {
  const reference = `2026-${faker.string.numeric(7)}`;
  const city = faker.location.city();
  const hasRecherche = faker.datatype.boolean();
  return {
    candidatId,
    source: 'pep',
    reference,
    title: `Attaché de justice (F/H) – ${faker.helpers.arrayElement(SERVICE_LIST)}`,
    url: `https://example.org/offres/${reference}`,
    publishedAt: faker.date.recent({ days: 60 }),
    dateLimite: faker.date.soon({ days: 45 }),
    employer: `Cour d'appel de ${faker.helpers.arrayElement(COURT_OF_APPEAL_LIST)}`,
    workplace: `Tribunal judiciaire de ${city}`,
    city,
    latitude: faker.location.latitude({ min: 42.5, max: 51 }),
    longitude: faker.location.longitude({ min: -4.5, max: 7.5 }),
    applicationEmail: faker.internet.email({ provider: 'example.org' }),
    contact1: `${faker.person.fullName()}, ${faker.phone.number()}`,
    contact2: faker.helpers.maybe(() => faker.person.fullName()) ?? null,
    status: faker.helpers.arrayElement(['a_traiter', 'postulee', 'archivee'] as const),
    isInZone: faker.datatype.boolean(),
    versionList: {
      create: hasRecherche
        ? [{ artefact: 'recherche', number: 1, isRetenue: true, state: 'ready', consignes: '' }]
        : [],
    },
  };
}

// Development data only: replaces the Offres of dev-data/ with fake ones, the same on every run,
// for the Candidats of its config (copied from config.example.json when missing). data/ is never
// touched.
mkdirSync(DEVELOPMENT_DATA_DIRECTORY, { recursive: true });
const configPath = path.join(DEVELOPMENT_DATA_DIRECTORY, 'config.json');
if (!existsSync(configPath)) {
  copyFileSync(EXAMPLE_CONFIG_PATH, configPath);
}
const database = await openWorkspace(DEVELOPMENT_DATA_DIRECTORY);
const candidatList = await database.candidat.findMany();
faker.seed(1);
await database.$transaction([
  database.job.deleteMany(),
  database.version.deleteMany(),
  database.offre.deleteMany(),
  ...candidatList.flatMap(({ id }) =>
    Array.from({ length: OFFRE_COUNT_PER_CANDIDAT }, () => database.offre.create({ data: fakeOffre(id) })),
  ),
]);
process.stdout.write(`${String(candidatList.length * OFFRE_COUNT_PER_CANDIDAT)} Offres factices dans dev-data/\n`);
