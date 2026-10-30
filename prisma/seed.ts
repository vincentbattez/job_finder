import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { fakerFR as faker } from '@faker-js/faker';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

import { PrismaClient, type Prisma } from '#/workspace/generated/client.ts';
import { openWorkspace } from '#/workspace/index.ts';

// Same folder as the default database of prisma.config.ts
const DEVELOPMENT_DATA_DIRECTORY = path.join(import.meta.dirname, '..', 'dev-data');
const POSTING_COUNT_PER_CANDIDATE = 30;
const COURT_OF_APPEAL_LIST = ['Douai', 'Amiens', 'Paris', 'Rennes', 'Lyon', 'Bordeaux'];
const SERVICE_LIST = ['pôle civil', 'pôle pénal', 'parquet', "service de l'application des peines", 'pôle mineurs'];

function fakePosting(candidateId: string): Prisma.PostingUncheckedCreateInput {
  const reference = `2026-${faker.string.numeric(7)}`;
  const city = faker.location.city();
  const hasResearch = faker.datatype.boolean();
  return {
    candidateId,
    source: 'pep',
    reference,
    title: `Attaché de justice (F/H) – ${faker.helpers.arrayElement(SERVICE_LIST)}`,
    url: `https://example.org/postings/${reference}`,
    publishedAt: faker.date.recent({ days: 60 }),
    deadline: faker.date.soon({ days: 45 }),
    employer: `Cour d'appel de ${faker.helpers.arrayElement(COURT_OF_APPEAL_LIST)}`,
    workplace: `Tribunal judiciaire de ${city}`,
    city,
    region: faker.location.state(),
    latitude: faker.location.latitude({ min: 42.5, max: 51 }),
    longitude: faker.location.longitude({ min: -4.5, max: 7.5 }),
    applicationEmail: faker.internet.email({ provider: 'example.org' }),
    contact1: `${faker.person.fullName()}, ${faker.phone.number()}`,
    contact2: faker.helpers.maybe(() => faker.person.fullName()) ?? null,
    status: faker.helpers.arrayElement(['to_apply', 'applied', 'archived'] as const),
    isInZone: faker.datatype.boolean(),
    versionList: {
      create: hasResearch
        ? [{ artifact: 'research', number: 1, isChosen: true, state: 'ready', instructions: '' }]
        : [],
    },
  };
}

// Development data only: replaces the Postings of dev-data/ with fake ones, the same on every run,
// for its Candidates, Léa when it has none yet. data/ is never touched.
mkdirSync(DEVELOPMENT_DATA_DIRECTORY, { recursive: true });
const workspace = await openWorkspace(DEVELOPMENT_DATA_DIRECTORY);
const existingCandidateList = await workspace.listCandidates();
if (existingCandidateList.length === 0) {
  await workspace.createCandidate({ id: 'lea', name: 'Léa', locale: 'fr' });
}
const candidateList = await workspace.listCandidates();
// The seed is tooling, not the application: it writes raw rows without the anti-corruption
// layer (ADR-0005)
const database = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: `file:${path.join(DEVELOPMENT_DATA_DIRECTORY, 'job_finder.sqlite')}` }),
});
faker.seed(1);
await database.$transaction([database.job.deleteMany(), database.version.deleteMany(), database.posting.deleteMany()]);
const postingList = await database.$transaction(
  candidateList.flatMap(({ id }) =>
    Array.from({ length: POSTING_COUNT_PER_CANDIDATE }, () => database.posting.create({ data: fakePosting(id) })),
  ),
);
// Every Posting has its Job Description in its folder, as the Detection saves it
for (const posting of postingList) {
  const postingDirectory = workspace.postingDirectoryOf(posting);
  mkdirSync(postingDirectory, { recursive: true });
  writeFileSync(path.join(postingDirectory, 'job-description.md'), `## Missions\n\n${faker.lorem.paragraphs(3)}\n`);
}
process.stdout.write(`${String(candidateList.length * POSTING_COUNT_PER_CANDIDATE)} Offres factices dans dev-data/\n`);
