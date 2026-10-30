import { isDeepStrictEqual } from 'node:util';

import { z } from 'zod/v4';

import { PARAMETRES_SCHEMA, type Candidat, type Veille } from '#/domain/index.ts';

import type { ActionContext } from './context.ts';

const VEILLE_INPUT_SCHEMA = z.object({ veilleId: z.string() });

// A field of the form left blank arrives empty, and counts as left out, as does an empty line of a list
const SAVE_INPUT_SCHEMA = z.object({
  veilleId: z.string().optional(),
  source: z.string(),
  parametres: PARAMETRES_SCHEMA.transform((parametres) =>
    Object.fromEntries(
      Object.entries(parametres)
        .map(([name, value]) => [name, Array.isArray(value) ? value.filter((item) => item !== '') : value] as const)
        .filter(([, value]) => value !== ''),
    ),
  ),
});

// Each Candidat sets their Veilles in their Profil: the Source they follow and the Paramètres it asks
// for, the form built from its descriptor (ADR-0010, ADR-0011)
export function createVeilleActions({ workspace, findCandidat, findSource }: ActionContext) {
  async function findVeille(candidat: Candidat, rawInput: unknown): Promise<Veille> {
    const { veilleId } = VEILLE_INPUT_SCHEMA.parse(rawInput);
    const veilleList = await workspace.listVeilles(candidat.id);
    const veille = veilleList.find(({ id }) => id === veilleId);
    if (veille === undefined) {
      throw new Error(`${candidat.name} n'a pas de Veille ${veilleId} : recharger la page de son Profil.`);
    }
    return veille;
  }

  // Named after its Candidat and numbered, since its Paramètres may change
  async function newVeilleId(candidat: Candidat): Promise<string> {
    const allVeilleList = await workspace.listVeilles();
    const idSet = new Set(allVeilleList.map(({ id }) => id));
    let number = allVeilleList.filter(({ candidatId }) => candidatId === candidat.id).length + 1;
    while (idSet.has(`${candidat.id}-${String(number)}`)) {
      number += 1;
    }
    return `${candidat.id}-${String(number)}`;
  }

  return {
    async listVeilles(rawInput: unknown): Promise<Veille[]> {
      const candidat = await findCandidat(rawInput);
      return workspace.listVeilles(candidat.id);
    },

    // Creates a Veille, or changes the one named: it starts its first launch again once its Source or
    // its Paramètres change, so the Offres already online trigger nothing (ADR-0011)
    async saveVeille(rawInput: unknown): Promise<void> {
      const candidat = await findCandidat(rawInput);
      const input = SAVE_INPUT_SCHEMA.parse(rawInput);
      const source = findSource(input.source);
      const parametres = source.parseParametres(input.parametres);
      if (input.veilleId === undefined) {
        const id = await newVeilleId(candidat);
        await workspace.createVeille({ id, candidatId: candidat.id, source: input.source, parametres });
        return;
      }
      const veille = await findVeille(candidat, rawInput);
      if (veille.source !== input.source || !isDeepStrictEqual(veille.parametres, parametres)) {
        await workspace.updateVeille(veille, { source: input.source, parametres });
      }
    },

    // Its Offres stay with the Candidat
    async deleteVeille(rawInput: unknown): Promise<void> {
      const candidat = await findCandidat(rawInput);
      await workspace.deleteVeille(await findVeille(candidat, rawInput));
    },
  };
}
