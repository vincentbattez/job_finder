import { codedError } from '#/domain/coded-error.ts';
import { STATUS_SCHEMA } from '#/domain/index.ts';
import { assertStatusChange } from '#/status/index.ts';

import { REFERENCE_INPUT_SCHEMA, type ActionContext } from './context.ts';

const STATUS_INPUT_SCHEMA = REFERENCE_INPUT_SCHEMA.extend({ status: STATUS_SCHEMA });

export function createStatusActions({ workspace, artifacts, findPosting, findLocale }: ActionContext) {
  return {
    // Keeping a New Posting is deciding to pursue it: To Apply, its Research queued as the import's,
    // unless the Candidate already ran one (ADR-0018). Dismissing it is archiving it, which leaves it New.
    async keep(rawInput: unknown): Promise<void> {
      const posting = await findPosting(REFERENCE_INPUT_SCHEMA.parse(rawInput).reference);
      if (posting.status !== 'new') {
        throw codedError(
          'not_new',
          { reference: posting.reference },
          { locale: await findLocale(posting.candidateId) },
        );
      }
      await workspace.setStatus(posting, 'to_apply');
      const research = await artifacts.find({ posting, artifact: 'research' });
      const { state } = await research.readState();
      if (state === 'absent') {
        await research.queueRun({ isAutomatic: true });
      }
    },

    async changeStatus(rawInput: unknown): Promise<void> {
      const { reference, status } = STATUS_INPUT_SCHEMA.parse(rawInput);
      const posting = await findPosting(reference);
      const interviewList = await workspace.listInterviews(posting);
      assertStatusChange(
        { ...posting, hasInterview: interviewList.length > 0 },
        status,
        await findLocale(posting.candidateId),
      );
      // Moving to the Status it already has keeps the day of its last change
      if (status !== posting.status) {
        await workspace.setStatus(posting, status);
      }
    },

    // Whatever its Status, which stays as it is (ADR-0007); archiving again keeps the first date,
    // which sorts the Archived
    async archive(rawInput: unknown): Promise<void> {
      const posting = await findPosting(REFERENCE_INPUT_SCHEMA.parse(rawInput).reference);
      await workspace.setArchivedAt(posting, posting.archivedAt ?? new Date());
    },

    // Only removes the mark: the Posting is found exactly where it was
    async unarchive(rawInput: unknown): Promise<void> {
      const posting = await findPosting(REFERENCE_INPUT_SCHEMA.parse(rawInput).reference);
      await workspace.setArchivedAt(posting, null);
    },
  };
}
