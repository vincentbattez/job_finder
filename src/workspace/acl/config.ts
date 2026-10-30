import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { z } from 'zod/v4';

// The file where an older jf read the Candidats, their Veilles and the Délai par défaut. The database
// holds them now, written by the front: the file is imported once, at the first launch of a database
// that has no settings yet, then never read again (ADR-0011). The only file of src/ that names it
// (test/architecture.test.ts).
const CONFIG_FILE_NAME = 'config.json';

const SLUG_SCHEMA = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

// Only the Source a Veille follows knows its Paramètres: the Détection parses them (ADR-0010)
const PARAMETRES_SCHEMA = z.record(z.string(), z.json());

// A config written before the Sources became a family split the Paramètres into criteria and zone
const VEILLE_SCHEMA = z.union([
  z.strictObject({ id: SLUG_SCHEMA, source: z.string().min(1), parametres: PARAMETRES_SCHEMA }),
  z
    .strictObject({ id: SLUG_SCHEMA, source: z.string().min(1), criteria: PARAMETRES_SCHEMA, zone: PARAMETRES_SCHEMA })
    .transform(({ criteria, zone, ...veille }) => ({ ...veille, parametres: { ...criteria, ...zone } })),
]);

const CANDIDAT_SCHEMA = z.strictObject({
  id: SLUG_SCHEMA,
  name: z.string().min(1),
  veilleList: z.array(VEILLE_SCHEMA),
});

const CONFIG_SCHEMA = z.strictObject({
  defaultDelayMonths: z.int().positive(),
  candidatList: z.array(CANDIDAT_SCHEMA),
});

export type Config = z.infer<typeof CONFIG_SCHEMA>;

// The config an older jf left in the data folder, null when there is none
export function readLegacyConfig(dataDirectory: string): Config | null {
  const configPath = path.join(dataDirectory, CONFIG_FILE_NAME);
  if (!existsSync(configPath)) {
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

// The config left behind once imported: its path, for jf to say it is no longer read, null when gone
export function findObsoleteConfig(dataDirectory: string): string | null {
  const configPath = path.join(dataDirectory, CONFIG_FILE_NAME);
  return existsSync(configPath) ? configPath : null;
}
