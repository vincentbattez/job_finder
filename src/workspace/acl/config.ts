import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { z } from 'zod/v4';

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
