import type { DomainValue } from '#/domain/index.ts';

import { createCanalNotificationActions } from './canal-notification.ts';
import { createCandidateActions } from './candidates.ts';
import { openContext, type IActionsOption } from './context.ts';
import { createDetectActions } from './detect.ts';
import { createEditionActions } from './edition.ts';
import { createFactsActions } from './facts.ts';
import { createImportActions } from './import-fiche-de-poste.ts';
import { createInstructionsActions } from './instructions.ts';
import { createJobActions } from './jobs.ts';
import { createOffreActions } from './offres.ts';
import { createProfileActions } from './profile.ts';
import { createStatutActions } from './statut.ts';
import { createUploadActions } from './uploads.ts';
import { createVeilleActions } from './veilles.ts';

export type Actions = Awaited<ReturnType<typeof createActions>>;

// The CLI, the front and the worker reach nothing but the actions (ADR-0003)
export { messageOf } from '#/text/index.ts';

// The single entry point of every feature, so no business rule lives in the CLI or the front
// (ADR-0003); `satisfies` holds each action to unknown input and domain output (ADR-0005)
export async function createActions(option: IActionsOption) {
  const context = await openContext(option);
  return {
    ...createOffreActions(context),
    ...createCandidateActions(context),
    ...createDetectActions(context),
    ...createVeilleActions(context),
    ...createImportActions(context),
    ...createStatutActions(context),
    ...createProfileActions(context),
    ...createUploadActions(context),
    ...createCanalNotificationActions(context),
    ...createFactsActions(context),
    ...createInstructionsActions(context),
    ...createEditionActions(context),
    ...createJobActions(context),
  } satisfies Record<string, (rawInput: unknown) => Promise<void> | Promise<DomainValue | DomainValue[]>>;
}
