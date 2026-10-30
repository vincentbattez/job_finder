import type { Actions } from '#/actions/index.ts';

// Léa, the first Candidate: her Watch follows the attaché de justice Postings of the PEP, her Zone the
// courts of appeal of Douai and Amiens
export const LEA_WATCH = {
  source: 'pep',
  parameters: { title: 'attaché de justice', courtOfAppealList: ['Douai', 'Amiens'] },
};

// The identifier the front gives her first Watch
export const LEA_WATCH_ID = 'lea-1';

// As from the front: the Candidate, then her Watch
export async function createLea(actions: Actions, watch = LEA_WATCH): Promise<void> {
  await actions.createCandidate({ id: 'lea', name: 'Léa' });
  await actions.saveWatch({ candidateId: 'lea', ...watch });
}
