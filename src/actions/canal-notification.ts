import { z } from 'zod/v4';

import {
  CANAL_NOTIFICATION_SCHEMA,
  type CanalNotification,
  type CanalNotificationModule,
  type ParametreChoice,
  type SavedCanalNotification,
} from '#/domain/index.ts';
import { composeTestNotification } from '#/notification/index.ts';

import { PARAMETRES_INPUT_SCHEMA, type ActionContext } from './context.ts';

// The module the Candidate picked, the saved one when left out, and the Paramètres they typed; a field
// of a form left blank arrives empty, and counts as left out
const TRIAL_INPUT_SCHEMA = z.object({
  canal: z.string().optional(),
  parametres: PARAMETRES_INPUT_SCHEMA.default({}).transform((parametres) =>
    Object.fromEntries(Object.entries(parametres).filter(([, value]) => value !== '')),
  ),
});

type TypedParametres = z.infer<typeof PARAMETRES_INPUT_SCHEMA>;

const SAVE_INPUT_SCHEMA = TRIAL_INPUT_SCHEMA.required({ canal: true });

const CHOICES_INPUT_SCHEMA = TRIAL_INPUT_SCHEMA.extend({ parametre: z.string() });

// What the Candidate typed over what is saved. A Paramètre left out keeps its saved value, a secret
// one included, since the front never gets it back (ADR-0006). But a saved secret goes only with the
// Paramètres typed in with it, such as an address: change one, and the saved secrets stay behind, so
// that nobody on the LAN sends them elsewhere (ADR-0002). Changing module leaves every Paramètre behind.
function mergeParametres(
  { parametreList, id }: CanalNotificationModule,
  saved: SavedCanalNotification,
  givenParametres: TypedParametres,
): TypedParametres {
  const savedParametres: TypedParametres = saved.module === id ? saved.parametres : {};
  const isSameDestination = parametreList
    .filter(({ isSecret, hasChoices }) => !isSecret && !hasChoices)
    .every(({ name }) => givenParametres[name] === undefined || givenParametres[name] === savedParametres[name]);
  const secretSet = new Set(parametreList.filter(({ isSecret }) => isSecret).map(({ name }) => name));
  const keptParametres = Object.fromEntries(
    Object.entries(savedParametres).filter(([name]) => isSameDestination || !secretSet.has(name)),
  );
  return { ...keptParametres, ...givenParametres };
}

// Each Candidate chooses their Canal de notification among the modules of the family; no action returns
// a secret Paramètre (ADR-0006, ADR-0010, test/write-only-token.test.ts)
export function createCanalNotificationActions({
  workspace,
  findCandidate,
  canalNotificationList,
  canalNotificationModuleOf,
  findCanalNotificationModule,
  sendNotification,
}: ActionContext) {
  // The module and the Paramètres a test, a list of choices or a save works on
  async function mergeInput(rawInput: unknown, canal: string | undefined, givenParametres: TypedParametres) {
    const candidate = await findCandidate(rawInput);
    const saved = await workspace.findCanalNotification(candidate.id);
    const module = findCanalNotificationModule(canal ?? saved.module, candidate.name);
    return { candidate, module, parametres: mergeParametres(module.description, saved, givenParametres) };
  }

  return {
    listCanauxNotification(): Promise<CanalNotificationModule[]> {
      return Promise.resolve(canalNotificationList.map(({ description }) => description));
    },

    // Each secret Paramètre reduced to whether it is configured
    async readCanalNotification(rawInput: unknown): Promise<CanalNotification> {
      const candidate = await findCandidate(rawInput);
      const { module, parametres } = await workspace.findCanalNotification(candidate.id);
      const parametreList = canalNotificationModuleOf(module)?.description.parametreList ?? [];
      const savedList = parametreList.filter(({ name }) => parametres[name] !== undefined);
      return CANAL_NOTIFICATION_SCHEMA.parse({
        module,
        parametres: Object.fromEntries(
          savedList.filter(({ isSecret }) => !isSecret).map(({ name }) => [name, parametres[name]]),
        ),
        configuredSecretList: savedList.filter(({ isSecret }) => isSecret).map(({ name }) => name),
      });
    },

    async saveCanalNotification(rawInput: unknown): Promise<void> {
      const { canal, parametres: givenParametres } = SAVE_INPUT_SCHEMA.parse(rawInput);
      const { candidate, module, parametres } = await mergeInput(rawInput, canal, givenParametres);
      await workspace.saveCanalNotification(candidate.id, {
        module: module.description.id,
        parametres: module.parseParametres(parametres),
      });
    },

    // The Profile tries what the Candidate typed before saving it
    async testCanalNotification(rawInput: unknown): Promise<void> {
      const { canal, parametres: givenParametres } = TRIAL_INPUT_SCHEMA.parse(rawInput);
      const { module, parametres } = await mergeInput(rawInput, canal, givenParametres);
      await module.check(parametres);
    },

    async listParametreChoices(rawInput: unknown): Promise<ParametreChoice[]> {
      const { canal, parametres: givenParametres, parametre } = CHOICES_INPUT_SCHEMA.parse(rawInput);
      const { module, parametres } = await mergeInput(rawInput, canal, givenParametres);
      return module.listChoices(parametre, parametres);
    },

    // Through what is saved, as a new Offre would be
    async sendTestNotification(rawInput: unknown): Promise<void> {
      const candidate = await findCandidate(rawInput);
      await sendNotification(candidate.id, composeTestNotification(candidate.name));
    },
  };
}
