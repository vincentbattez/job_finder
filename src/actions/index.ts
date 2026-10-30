import type { DomainValue } from '#/domain/index.ts';

import { createConsignesActions } from './consignes.ts';
import { openContext, type IActionsOption } from './context.ts';
import { createDetectActions } from './detect.ts';
import { createEditionActions } from './edition.ts';
import { createFaitsActions } from './faits.ts';
import { createImportActions } from './import-fiche-de-poste.ts';
import { createJobActions } from './jobs.ts';
import { createOffreActions } from './offres.ts';
import { createProfilActions } from './profil.ts';
import { createStatutActions } from './statut.ts';

export type Actions = Awaited<ReturnType<typeof createActions>>;

// The CLI, the front and the worker reach nothing but the actions (ADR-0003)
export { messageOf } from '#/text/index.ts';

// The single entry point of every feature, so no business rule lives in the CLI or the front
// (ADR-0003); `satisfies` holds each action to unknown input and domain output (ADR-0005)
export async function createActions(option: IActionsOption) {
  const context = await openContext(option);
  return {
    ...createOffreActions(context),
    ...createDetectActions(context),
    ...createImportActions(context),
    ...createStatutActions(context),
    ...createProfilActions(context),
    ...createFaitsActions(context),
    ...createConsignesActions(context),
    ...createEditionActions(context),
    ...createJobActions(context),
  } satisfies Record<string, (rawInput: unknown) => Promise<void> | Promise<DomainValue | DomainValue[]>>;
}
