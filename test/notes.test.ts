import { beforeAll, describe, expect, it } from 'vitest';

import type { Actions } from '#/actions/index.ts';

import { detectPostings } from './data-directory.ts';

// The Béthune juvenile court Posting, detected from the responses recorded on 2026-10-29
const REFERENCE = '2026-2445600';

// Each test keeps the Notes of its own Posting, so they share one Detection
describe('the Notes of a Posting', () => {
  let actions: Actions;

  beforeAll(async () => {
    ({ actions } = await detectPostings());
  });

  async function readNotes(reference: string): Promise<string> {
    const { posting } = await actions.readPosting({ reference });
    return posting.notes;
  }

  it('are empty on a Posting just detected', async () => {
    expect(await readNotes(REFERENCE)).toBe('');
  });

  it('keep what the Candidate saves on a To Apply Posting', async () => {
    await actions.saveNotes({ reference: '2026-2445609', notes: '# Appel du greffe\n\nRappeler lundi.\n' });

    expect(await readNotes('2026-2445609')).toBe('# Appel du greffe\n\nRappeler lundi.\n');
  });

  it('are rewritten at will, on an Archived Applied Posting too', async () => {
    await actions.changeStatus({ reference: '2026-2445183', status: 'applied' });
    await actions.archive({ reference: '2026-2445183' });
    await actions.saveNotes({ reference: '2026-2445183', notes: 'Premier tour : bon retour.' });

    await actions.saveNotes({ reference: '2026-2445183', notes: 'Second tour le 19/11.' });

    expect(await readNotes('2026-2445183')).toBe('Second tour le 19/11.');
  });

  it('are emptied when the Candidate saves them empty', async () => {
    await actions.saveNotes({ reference: '2026-2350473', notes: 'À effacer' });

    await actions.saveNotes({ reference: '2026-2350473', notes: '' });

    expect(await readNotes('2026-2350473')).toBe('');
  });

  it('are refused on a Posting the tool does not know', async () => {
    await expect(actions.saveNotes({ reference: 'unknown', notes: 'x' })).rejects.toMatchObject({
      code: 'unknown_posting',
    });
  });
});
