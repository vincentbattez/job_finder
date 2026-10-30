import { existsSync, readFileSync } from 'node:fs';

import { z } from 'zod/v4';

const SLUG_SCHEMA = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

// Only the Source a Veille follows knows its Paramètres: the Détection parses them (ADR-0010)
const PARAMETRES_SCHEMA = z.record(z.string(), z.json());

// A config written before the Sources became a family split the Paramètres into criteria and zone:
// it still reads, so the real data/config.json needs no rewrite
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
  candidatList: z.array(CANDIDAT_SCHEMA).min(1),
});

export type Config = z.infer<typeof CONFIG_SCHEMA>;

export function loadConfig(configPath: string): Config {
  if (!existsSync(configPath)) {
    throw new Error(
      `Config introuvable : ${configPath}\nCopier config.example.json à cet emplacement, puis l'adapter.`,
    );
  }
  const result = CONFIG_SCHEMA.safeParse(JSON.parse(readFileSync(configPath, 'utf8')));
  if (!result.success) {
    throw new Error(`Config invalide : ${configPath}\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
