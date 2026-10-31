import { codedErrorOf } from '#/domain/coded-error.ts';
import type { DomainValue } from '#/domain/index.ts';

import { createCandidateActions } from './candidates.ts';
import { openContext, type IActionsOption } from './context.ts';
import { createDetectActions } from './detect.ts';
import { createEditionActions } from './edition.ts';
import { createFactsActions } from './facts.ts';
import { createImportActions } from './import-job-description.ts';
import { createInstructionsActions } from './instructions.ts';
import { createInterviewActions } from './interviews.ts';
import { createJobActions } from './jobs.ts';
import { createNotesActions } from './notes.ts';
import { createNotificationChannelActions } from './notification-channel.ts';
import { createPostingActions } from './postings.ts';
import { createProfileActions } from './profile.ts';
import { createStatusActions } from './status.ts';
import { createUploadActions } from './uploads.ts';
import { createWatchActions } from './watches.ts';

export type Actions = Awaited<ReturnType<typeof createActions>>;

// The CLI, the front and the worker reach nothing but the actions (ADR-0003)
export { messageOf } from '#/text/index.ts';
export { codedError, codedErrorOf, formatError, formatFailure } from '#/domain/coded-error.ts';
export type { ErrorCode } from '#/domain/error.ts';
export { ARTIFACT_RENAME_LIST } from '#/domain/artifact-rename.ts';

// The single entry point of every feature, so no business rule lives in the CLI or the front
// (ADR-0003); `satisfies` holds each action to unknown input and domain output (ADR-0005)
export async function createActions(option: IActionsOption) {
  const context = await openContext(option);
  return refuseUnderCodes({
    ...createPostingActions(context),
    ...createCandidateActions(context),
    ...createDetectActions(context),
    ...createWatchActions(context),
    ...createImportActions(context),
    ...createStatusActions(context),
    ...createNotesActions(context),
    ...createInterviewActions(context),
    ...createProfileActions(context),
    ...createUploadActions(context),
    ...createNotificationChannelActions(context),
    ...createFactsActions(context),
    ...createInstructionsActions(context),
    ...createEditionActions(context),
    ...createJobActions(context),
  } satisfies Record<string, (rawInput: unknown) => Promise<void> | Promise<DomainValue | DomainValue[]>>);
}

// The boundary of every action, those added later included: a foreign failure, such as the ZodError
// of an input that does not parse, leaves under a code of the catalogue, never as its JSON (ADR-0015)
function refuseUnderCodes<TActions extends Record<string, (rawInput: unknown) => Promise<unknown>>>(
  actions: TActions,
): TActions {
  for (const [name, action] of Object.entries(actions)) {
    Object.assign(actions, {
      [name]: async (rawInput: unknown) => {
        try {
          return await action(rawInput);
        } catch (error) {
          throw codedErrorOf(error);
        }
      },
    });
  }
  return actions;
}
