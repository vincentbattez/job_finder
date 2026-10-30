import { existsSync, readFileSync } from 'node:fs';

import { z } from 'zod/v4';

const SLUG_SCHEMA = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const COURT_OF_APPEAL_LIST_SCHEMA = z.array(z.string().min(1)).min(1);

const VEILLE_SCHEMA = z.strictObject({
  id: SLUG_SCHEMA,
  source: z.literal('pep'),
  criteria: z.strictObject({ title: z.string().min(1) }),
  zone: z.strictObject({ courtOfAppealList: COURT_OF_APPEAL_LIST_SCHEMA }),
});

const CANDIDAT_SCHEMA = z.strictObject({
  id: SLUG_SCHEMA,
  name: z.string().min(1),
  // Before the Connexion Home Assistant moved to the database, which it seeds (ADR-0006)
  notification: z
    .strictObject({
      channel: z.literal('home-assistant'),
      service: z.string().startsWith('notify.'),
    })
    .optional(),
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
