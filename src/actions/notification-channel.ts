import { z } from 'zod/v4';

import {
  NOTIFICATION_CHANNEL_SCHEMA,
  type NotificationChannel,
  type NotificationChannelModule,
  type ParameterChoice,
  type SavedNotificationChannel,
} from '#/domain/index.ts';
import { composeTestNotification } from '#/notification/index.ts';

import { PARAMETERS_INPUT_SCHEMA, type ActionContext } from './context.ts';

// The module the Candidate picked, the saved one when left out, and the Parameters they typed; a field
// of a form left blank arrives empty, and counts as left out
const TRIAL_INPUT_SCHEMA = z.object({
  channel: z.string().optional(),
  parameters: PARAMETERS_INPUT_SCHEMA.default({}).transform((parameters) =>
    Object.fromEntries(Object.entries(parameters).filter(([, value]) => value !== '')),
  ),
});

type TypedParameters = z.infer<typeof PARAMETERS_INPUT_SCHEMA>;

const SAVE_INPUT_SCHEMA = TRIAL_INPUT_SCHEMA.required({ channel: true });

const CHOICES_INPUT_SCHEMA = TRIAL_INPUT_SCHEMA.extend({ parameter: z.string() });

// What the Candidate typed over what is saved. A Parameter left out keeps its saved value, a secret
// one included, since the front never gets it back (ADR-0006). But a saved secret goes only with the
// Parameters typed in with it, such as an address: change one, and the saved secrets stay behind, so
// that nobody on the LAN sends them elsewhere (ADR-0002). Changing module leaves every Parameter behind.
function mergeParameters(
  { parameterList, id }: NotificationChannelModule,
  saved: SavedNotificationChannel,
  givenParameters: TypedParameters,
): TypedParameters {
  const savedParameters: TypedParameters = saved.module === id ? saved.parameters : {};
  const isSameDestination = parameterList
    .filter(({ isSecret, hasChoices }) => !isSecret && !hasChoices)
    .every(({ name }) => givenParameters[name] === undefined || givenParameters[name] === savedParameters[name]);
  const secretSet = new Set(parameterList.filter(({ isSecret }) => isSecret).map(({ name }) => name));
  const keptParameters = Object.fromEntries(
    Object.entries(savedParameters).filter(([name]) => isSameDestination || !secretSet.has(name)),
  );
  return { ...keptParameters, ...givenParameters };
}

// Each Candidate chooses their Notification Channel among the modules of the family; no action returns
// a secret Parameter (ADR-0006, ADR-0010, test/write-only-token.test.ts)
export function createNotificationChannelActions({
  workspace,
  findCandidate,
  notificationChannelList,
  notificationChannelModuleOf,
  findNotificationChannelModule,
  sendNotification,
}: ActionContext) {
  // The module and the Parameters a test, a list of choices or a save works on
  async function mergeInput(rawInput: unknown, channel: string | undefined, givenParameters: TypedParameters) {
    const candidate = await findCandidate(rawInput);
    const saved = await workspace.findNotificationChannel(candidate.id);
    const module = findNotificationChannelModule(channel ?? saved.module, candidate.name);
    return { candidate, module, parameters: mergeParameters(module.description, saved, givenParameters) };
  }

  return {
    listNotificationChannels(): Promise<NotificationChannelModule[]> {
      return Promise.resolve(notificationChannelList.map(({ description }) => description));
    },

    // Each secret Parameter reduced to whether it is configured
    async readNotificationChannel(rawInput: unknown): Promise<NotificationChannel> {
      const candidate = await findCandidate(rawInput);
      const { module, parameters } = await workspace.findNotificationChannel(candidate.id);
      const parameterList = notificationChannelModuleOf(module)?.description.parameterList ?? [];
      const savedList = parameterList.filter(({ name }) => parameters[name] !== undefined);
      return NOTIFICATION_CHANNEL_SCHEMA.parse({
        module,
        parameters: Object.fromEntries(
          savedList.filter(({ isSecret }) => !isSecret).map(({ name }) => [name, parameters[name]]),
        ),
        configuredSecretList: savedList.filter(({ isSecret }) => isSecret).map(({ name }) => name),
      });
    },

    async saveNotificationChannel(rawInput: unknown): Promise<void> {
      const { channel, parameters: givenParameters } = SAVE_INPUT_SCHEMA.parse(rawInput);
      const { candidate, module, parameters } = await mergeInput(rawInput, channel, givenParameters);
      await workspace.saveNotificationChannel(candidate.id, {
        module: module.description.id,
        parameters: module.parseParameters(parameters),
      });
    },

    // The Profile tries what the Candidate typed before saving it
    async testNotificationChannel(rawInput: unknown): Promise<void> {
      const { channel, parameters: givenParameters } = TRIAL_INPUT_SCHEMA.parse(rawInput);
      const { module, parameters } = await mergeInput(rawInput, channel, givenParameters);
      await module.check(parameters);
    },

    async listParameterChoices(rawInput: unknown): Promise<ParameterChoice[]> {
      const { channel, parameters: givenParameters, parameter } = CHOICES_INPUT_SCHEMA.parse(rawInput);
      const { module, parameters } = await mergeInput(rawInput, channel, givenParameters);
      return module.listChoices(parameter, parameters);
    },

    // Through what is saved, as a new Posting would be
    async sendTestNotification(rawInput: unknown): Promise<void> {
      const candidate = await findCandidate(rawInput);
      await sendNotification(candidate.id, composeTestNotification(candidate.name));
    },
  };
}
