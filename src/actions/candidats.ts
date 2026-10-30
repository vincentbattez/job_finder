import { z } from 'zod/v4';

import {
  DELAI_PAR_DEFAUT_SCHEMA,
  OBSOLETE_CONFIG_SCHEMA,
  type DelaiParDefaut,
  type ObsoleteConfig,
} from '#/domain/index.ts';

import type { ActionContext } from './context.ts';

// The identifier names the Candidat's folder and the commands of jf: a slug, which never leads out of
// the data folder
const CANDIDAT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const RENAME_INPUT_SCHEMA = z.object({ name: z.string() });

const NEW_CANDIDAT_INPUT_SCHEMA = RENAME_INPUT_SCHEMA.extend({ id: z.string() });

// A field of the front arrives as text
const DELAI_PAR_DEFAUT_INPUT_SCHEMA = z.object({ months: z.union([z.string(), z.number()]) });

// The identifier and the name come from the front: checked before anything is saved
function parseCandidatId(id: string): string {
  if (!CANDIDAT_ID_PATTERN.test(id)) {
    throw new Error(
      `« ${id} » n'est pas un identifiant de Candidat : des minuscules sans accent et des chiffres, séparés par des « - », comme « lea » ou « jean-pierre ».`,
    );
  }
  return id;
}

function parseName(name: string): string {
  const trimmedName = name.trim();
  if (trimmedName === '') {
    throw new Error('Le nom du Candidat est vide : le renseigner.');
  }
  return trimmedName;
}

function parseMonths(typedMonths: string | number): number {
  const months = Number(typedMonths);
  if (!Number.isSafeInteger(months) || months < 1) {
    throw new Error('Le Délai par défaut est un nombre entier de mois, au moins 1.');
  }
  return months;
}

// Any visitor of the front creates or renames a Candidat and sets the Délai par défaut; no Candidat is
// ever deleted (ADR-0002, ADR-0011)
export function createCandidatActions({ workspace, findCandidat }: ActionContext) {
  return {
    async createCandidat(rawInput: unknown): Promise<void> {
      const input = NEW_CANDIDAT_INPUT_SCHEMA.parse(rawInput);
      const candidat = { id: parseCandidatId(input.id), name: parseName(input.name) };
      const candidatList = await workspace.listCandidats();
      if (candidatList.some(({ id }) => id === candidat.id)) {
        throw new Error(`Un Candidat a déjà l'identifiant ${candidat.id} : en choisir un autre.`);
      }
      await workspace.createCandidat(candidat);
    },

    async renameCandidat(rawInput: unknown): Promise<void> {
      const candidat = await findCandidat(rawInput);
      await workspace.renameCandidat(candidat, parseName(RENAME_INPUT_SCHEMA.parse(rawInput).name));
    },

    readDelaiParDefaut(): Promise<DelaiParDefaut> {
      return workspace.readDelaiParDefaut();
    },

    // Expirée follows at once, here, and at their next launch in the other processes (ADR-0011)
    async saveDelaiParDefaut(rawInput: unknown): Promise<void> {
      const { months } = DELAI_PAR_DEFAUT_INPUT_SCHEMA.parse(rawInput);
      await workspace.saveDelaiParDefaut(DELAI_PAR_DEFAUT_SCHEMA.parse({ months: parseMonths(months) }));
    },

    // The config an older jf left, which jf and the Candidats page say to delete once imported
    findObsoleteConfig(): Promise<ObsoleteConfig> {
      return Promise.resolve(OBSOLETE_CONFIG_SCHEMA.parse({ path: workspace.findObsoleteConfig() }));
    },
  };
}
