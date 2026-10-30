import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { z } from 'zod/v4';

import { ERROR } from '#/domain/error.ts';
import { PARAMETRES_SCHEMA } from '#/domain/index.ts';

// The file where an older jf read the Candidates, their Veilles and the Délai par défaut. The database
// holds them now, written by the front: the file is imported once, at the first launch of a database
// that has no settings yet, then never read again (ADR-0011). The only file of src/ that names it
// (test/architecture.test.ts).
const CONFIG_FILE_NAME = 'config.json';

const SLUG_SCHEMA = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

// Only the Source a Veille follows knows its Paramètres: the Détection parses them (ADR-0010). A
// config written before the Sources became a family split them into criteria and zone.
const VEILLE_SCHEMA = z.union([
  z.strictObject({ id: SLUG_SCHEMA, source: z.string().min(1), parametres: PARAMETRES_SCHEMA }),
  z
    .strictObject({ id: SLUG_SCHEMA, source: z.string().min(1), criteria: PARAMETRES_SCHEMA, zone: PARAMETRES_SCHEMA })
    .transform(({ criteria, zone, ...veille }) => ({
      ...veille,
      parametres: PARAMETRES_SCHEMA.parse({ ...criteria, ...zone }),
    })),
]);

const CANDIDATE_SCHEMA = z.strictObject({
  id: SLUG_SCHEMA,
  name: z.string().min(1),
  veilleList: z.array(VEILLE_SCHEMA),
});

const CONFIG_SCHEMA = z.strictObject({
  defaultDelayMonths: z.int().positive(),
  candidateList: z.array(CANDIDATE_SCHEMA),
});

export type Config = z.infer<typeof CONFIG_SCHEMA>;

// The config an older jf left in the data folder, imported once and no longer read since: its path,
// for jf to say so, null when there is none
export function findObsoleteConfig(dataDirectory: string): string | null {
  const configPath = path.join(dataDirectory, CONFIG_FILE_NAME);
  return existsSync(configPath) ? configPath : null;
}

// Its content, to import once
export function readObsoleteConfig(dataDirectory: string): Config | null {
  const configPath = findObsoleteConfig(dataDirectory);
  if (configPath === null) {
    return null;
  }
  const result = CONFIG_SCHEMA.safeParse(JSON.parse(readFileSync(configPath, 'utf8')));
  if (!result.success) {
    throw new Error(
      `Config invalide : ${configPath}\n${z.prettifyError(result.error)}\nLa corriger pour qu'elle soit importée en base, ou la supprimer : les Candidats et leurs Veilles se règlent désormais dans le front.`,
    );
  }
  return result.data;
}

// Each French key of the config and its English name, wherever it sits in the file (#65)
const CONFIG_KEY_RENAME_LIST = [{ from: 'candidatList', to: 'candidateList' }];

function renameKeys(value: unknown, configPath: string): unknown {
  if (Array.isArray(value)) {
    return value.map((item: unknown) => renameKeys(item, configPath));
  }
  if (typeof value !== 'object' || value === null) {
    return value;
  }
  const entryList = Object.entries(value);
  for (const { from, to } of CONFIG_KEY_RENAME_LIST) {
    if (entryList.some(([key]) => key === from) && entryList.some(([key]) => key === to)) {
      throw ERROR.dataLayoutMixed(`${configPath} → ${from}`, `${configPath} → ${to}`);
    }
  }
  return Object.fromEntries(
    entryList.map(([key, item]) => [
      CONFIG_KEY_RENAME_LIST.find(({ from }) => from === key)?.to ?? key,
      renameKeys(item, configPath),
    ]),
  );
}

// The config an older jf left keeps its French keys until the first launch of this one, which
// rewrites them in place, once: the file stays untouched when they are already English
export function migrateObsoleteConfig(dataDirectory: string): void {
  const configPath = findObsoleteConfig(dataDirectory);
  if (configPath === null) {
    return;
  }
  const config: unknown = JSON.parse(readFileSync(configPath, 'utf8'));
  const migratedConfig = renameKeys(config, configPath);
  if (JSON.stringify(migratedConfig) !== JSON.stringify(config)) {
    writeFileSync(configPath, `${JSON.stringify(migratedConfig, null, 2)}\n`);
  }
}
