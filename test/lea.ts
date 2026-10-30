import type { Actions } from '#/actions/index.ts';

// Léa, the first Candidate: her Veille follows the attaché de justice Offres of the PEP, her Zone the
// courts of appeal of Douai and Amiens
export const LEA_VEILLE = {
  source: 'pep',
  parametres: { title: 'attaché de justice', courtOfAppealList: ['Douai', 'Amiens'] },
};

// The identifier the front gives her first Veille
export const LEA_VEILLE_ID = 'lea-1';

// As from the front: the Candidate, then her Veille
export async function createLea(actions: Actions, veille = LEA_VEILLE): Promise<void> {
  await actions.createCandidate({ id: 'lea', name: 'Léa' });
  await actions.saveVeille({ candidateId: 'lea', ...veille });
}
