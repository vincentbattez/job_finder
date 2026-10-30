import { z } from 'zod/v4';

import { SETTINGS_SCHEMA, type Settings } from '#/domain/index.ts';

import type { ActionContext } from './context.ts';

// The identifier names the Candidat's folder and the commands of jf: a slug, which never leads out of
// the data folder
const CANDIDAT_ID_SCHEMA = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
  error: (issue) =>
    `« ${String(issue.input)} » n'est pas un identifiant de Candidat : des minuscules sans accent et des chiffres, séparés par des « - », comme « lea » ou « jean-pierre ».`,
});

const NAME_SCHEMA = z.string().trim().min(1, { error: 'Le nom du Candidat est vide : le renseigner.' });

const NEW_CANDIDAT_INPUT_SCHEMA = z.object({ id: CANDIDAT_ID_SCHEMA, name: NAME_SCHEMA });

const RENAME_INPUT_SCHEMA = z.object({ name: NAME_SCHEMA });

const SETTINGS_INPUT_SCHEMA = z.object({
  defaultDelayMonths: z.coerce
    .number()
    .int()
    .positive({ error: 'Le Délai par défaut est un nombre entier de mois, au moins 1.' }),
});

// The first error of an input, in the words of its schema
function parseInput<T extends z.ZodType>(schema: T, rawInput: unknown): z.infer<T> {
  const result = schema.safeParse(rawInput);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? z.prettifyError(result.error));
  }
  return result.data;
}

// Any visitor of the front creates or renames a Candidat and sets the Délai par défaut; no Candidat is
// ever deleted (ADR-0002, ADR-0011)
export function createCandidatActions({ workspace, findCandidat }: ActionContext) {
  return {
    async createCandidat(rawInput: unknown): Promise<void> {
      const candidat = parseInput(NEW_CANDIDAT_INPUT_SCHEMA, rawInput);
      const candidatList = await workspace.listCandidats();
      if (candidatList.some(({ id }) => id === candidat.id)) {
        throw new Error(`Un Candidat a déjà l'identifiant ${candidat.id} : en choisir un autre.`);
      }
      await workspace.createCandidat(candidat);
    },

    async renameCandidat(rawInput: unknown): Promise<void> {
      const candidat = await findCandidat(rawInput);
      await workspace.renameCandidat(candidat, parseInput(RENAME_INPUT_SCHEMA, rawInput).name);
    },

    async readSettings(): Promise<Settings> {
      return SETTINGS_SCHEMA.parse({
        defaultDelayMonths: await workspace.readDefaultDelayMonths(),
        obsoleteConfigPath: workspace.findObsoleteConfig(),
      });
    },

    // Expirée follows at once, here, and at their next launch in the other processes (ADR-0011)
    async saveSettings(rawInput: unknown): Promise<void> {
      await workspace.saveDefaultDelayMonths(parseInput(SETTINGS_INPUT_SCHEMA, rawInput).defaultDelayMonths);
    },
  };
}
