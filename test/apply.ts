import type { Actions } from '#/actions/index.ts';

// Applied as the Candidate does it: a detected Posting is kept first, out of New (ADR-0018); an
// imported one, or one kept already, is To Apply. The reference is parsed by the actions, as any input.
export async function applyTo(
  actions: Pick<Actions, 'readPosting' | 'keep' | 'changeStatus'>,
  reference: unknown,
  letterAnswer: { isWithoutLetter?: boolean } = {},
): Promise<void> {
  const { posting } = await actions.readPosting({ reference });
  if (posting.status === 'new') {
    await actions.keep({ reference });
  }
  await actions.changeStatus({ reference, status: 'applied', ...letterAnswer });
}
