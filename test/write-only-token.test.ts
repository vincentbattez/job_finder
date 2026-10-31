import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it, onTestFinished } from 'vitest';
import { z } from 'zod/v4';

import { createActions, messageOf } from '#/actions/index.ts';
import { NOTIFICATION_CHANNEL_LIST } from '#/actions/modules.ts';
import { addResources, textKeyOf } from '#/domain/catalogue/i18n.ts';
import { defineNotificationChannel, type INotificationChannel } from '#/notification/index.ts';
import { parameter } from '#/parameter/index.ts';

import { createDataDirectory } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';
import { startFakeHomeAssistant } from './fake-home-assistant.ts';
import { LEA_WATCH, LEA_WATCH_ID } from './lea.ts';
import { createRecordedFetch } from './recorded-http.ts';

// A Béthune Posting in Léa's Zone, from the responses recorded on 2026-10-29
const REFERENCE = '2026-2445600';

// A Version of each Artifact, as the fake Claude writes them, so that every action reading one has it
const RUN_BY_MODULE = {
  research: { fileByName: { 'research.md': '# Recherche\n\n## Sources\n\n- https://www.justice.fr/\n' } },
  letter: {
    fileByName: {
      'draft.md': 'Madame, Monsieur,\n',
      'recipients.json': JSON.stringify({
        to: null,
        ccList: [],
        salutation: { text: 'Madame, Monsieur,', source: null },
        justification: 'Aucun champ de l’Offre ne donne d’adresse.',
      }),
    },
  },
  interview_brief: { fileByName: { 'interview-brief.md': '# Fiche d’entretien\n' } },
  visualization: { fileByName: { 'visualization.html': '<!DOCTYPE html>\n<title>Fiche</title>\n' } },
};

// What an action needs beyond the shared input of the check, such as an Upload, named in .pdf
const UPLOAD = { fileName: 'cv.pdf' };
const INPUT_BY_ACTION: Record<string, object> = {
  saveUpload: {
    ...UPLOAD,
    content: new Uint8Array(readFileSync(path.join(import.meta.dirname, 'fixtures/profile/cv.pdf'))),
  },
  convertUpload: UPLOAD,
  deleteUpload: UPLOAD,
  createCandidate: { id: 'camille', name: 'Camille' },
  renameCandidate: { name: 'Léa' },
  setCandidateLocale: { locale: 'fr' },
  saveDefaultDeadlinePeriod: { months: 6 },
  saveWatch: LEA_WATCH,
  deleteWatch: { watchId: LEA_WATCH_ID },
  saveNotes: { notes: '# Appel du greffe\n' },
};

type ActionMap = Record<string, (rawInput: unknown) => Promise<unknown>>;

// Secret Parameters are write-only (ADR-0006, ADR-0010): every action, called with the fields every
// input takes, once the Channel is saved, must neither return nor throw any of them. Any action counts,
// those to come included: one whose input this one does not fit is reported, until INPUT_BY_ACTION
// gives it what it needs. Each action runs once, on that input: a leak on another branch of it would
// pass.
async function findSecretLeaks(actionMap: ActionMap, input: object, secretByName: Record<string, string>) {
  const leakList: string[] = [];
  for (const [name, action] of Object.entries(actionMap)) {
    let output: string;
    try {
      const result = await action({ ...input, ...INPUT_BY_ACTION[name] });
      output = result === undefined ? '' : JSON.stringify(result);
    } catch (error) {
      leakList.push(`${name} fails on the input of the check (${messageOf(error)}): give it what it needs`);
      output = error instanceof Error ? `${error.message} ${String(error.cause)}` : String(error);
    }
    for (const [secretName, secret] of Object.entries(secretByName)) {
      if (output.includes(secret)) {
        leakList.push(`${name} returns the secret Parameter ${secretName}`);
      }
    }
  }
  return leakList;
}

// For each module of the registry, Parameters its fake accepts, so that the actions that reach the
// Channel succeed too. A module missing here fails the check: its secrets would go unchecked.
const PARAMETERS_BY_MODULE = new Map<string, () => Promise<Record<string, string>>>([
  [
    'home-assistant',
    async () => {
      const homeAssistant = await startFakeHomeAssistant();
      onTestFinished(() => homeAssistant.close());
      return { url: homeAssistant.url, token: homeAssistant.token, service: 'notify.mobile_app_iphone_de_lea' };
    },
  ],
]);

// A module of two secret Parameters, beside a plain one: the check covers each secret, not one token
const FAKE_VAULT_COPY_EN = { addressLabel: 'Address', loginLabel: 'Login', passwordLabel: 'Password' };

declare module 'i18next' {
  interface ResourceNamespaceMap {
    fakeVault: typeof FAKE_VAULT_COPY_EN;
  }
}

addResources('fakeVault', {
  en: FAKE_VAULT_COPY_EN,
  fr: { addressLabel: 'Adresse', loginLabel: 'Identifiant', passwordLabel: 'Mot de passe' },
});

const ADDRESS_PARAMETER = parameter(z.string(), { label: textKeyOf('fakeVault', 'addressLabel') });
const LOGIN_PARAMETER = parameter(z.string(), { label: textKeyOf('fakeVault', 'loginLabel'), isSecret: true });
const PASSWORD_PARAMETER = parameter(z.string(), { label: textKeyOf('fakeVault', 'passwordLabel'), isSecret: true });
const FAKE_VAULT = defineNotificationChannel({
  id: 'coffre',
  name: 'Coffre',
  parameterSchema: z.object({ address: ADDRESS_PARAMETER, login: LOGIN_PARAMETER, password: PASSWORD_PARAMETER }),
  send: () => Promise.resolve(),
  check: () => Promise.resolve(),
  listChoicesByParameter: { address: () => Promise.resolve([]) },
});
const FAKE_VAULT_PARAMETERS = {
  address: 'coffre-de-lea',
  login: 'identifiant-secret',
  password: 'mot-de-passe-secret',
};

// Léa's Postings detected, a Version of each Artifact ready, and her Notification Channel saved with
// the given Parameters. The input of the check gives back its non-secret Parameters only: a save
// without the secrets keeps them.
async function saveChannel(module: INotificationChannel, parameters: Record<string, string>) {
  const actions = await createActions({
    dataDirectory: createDataDirectory(),
    aiSession: createFakeAiSession(...Object.values(RUN_BY_MODULE)),
    fetch: createRecordedFetch().fetch,
    notificationChannelList: [module],
  });
  const { id, parameterList } = module.description;
  await actions.saveNotificationChannel({ candidateId: 'lea', channel: id, parameters });
  await actions.detect();
  for (const artifactModule of Object.keys(RUN_BY_MODULE)) {
    await actions.runModule({ module: artifactModule, reference: REFERENCE });
    await actions.runQueuedJobs();
  }
  const secretSet = new Set(parameterList.filter(({ isSecret }) => isSecret).map(({ name }) => name));
  const input = {
    candidateId: 'lea',
    reference: REFERENCE,
    module: 'research',
    artifact: 'research',
    number: 1,
    jobId: 1,
    status: 'to_apply',
    fileName: 'research.md',
    markdown: '# Research\n',
    instructions: 'Citer chaque source.',
    entryListByTitle: {},
    channel: id,
    parameter: parameterList.find(({ hasChoices }) => hasChoices)?.name,
    parameters: Object.fromEntries(Object.entries(parameters).filter(([name]) => !secretSet.has(name))),
  };
  const secretByName = Object.fromEntries(Object.entries(parameters).filter(([name]) => secretSet.has(name)));
  return { actions, input, secretByName };
}

describe('the write-only secret Parameters of a Notification Channel', () => {
  it('catches an action that returns any secret Parameter', async () => {
    const { actions, input, secretByName } = await saveChannel(FAKE_VAULT, FAKE_VAULT_PARAMETERS);
    const leakyActionMap = {
      ...actions,
      readFullChannel: () => Promise.resolve({ password: FAKE_VAULT_PARAMETERS.password }),
    };

    expect(await findSecretLeaks(leakyActionMap, input, secretByName)).toEqual([
      'readFullChannel returns the secret Parameter password',
    ]);
  });

  it('catches an action the check cannot call', async () => {
    const { actions, input, secretByName } = await saveChannel(FAKE_VAULT, FAKE_VAULT_PARAMETERS);
    const uncalledActionMap = { ...actions, renameChannel: () => Promise.reject(new Error('Nom manquant.')) };

    expect(await findSecretLeaks(uncalledActionMap, input, secretByName)).toEqual([
      'renameChannel fails on the input of the check (Nom manquant.): give it what it needs',
    ]);
  });

  it('are returned by no action, whichever secret', async () => {
    const { actions, input, secretByName } = await saveChannel(FAKE_VAULT, FAKE_VAULT_PARAMETERS);

    expect(Object.keys(secretByName)).toEqual(['login', 'password']);
    expect(await findSecretLeaks(actions, input, secretByName)).toEqual([]);
  });

  it.each(NOTIFICATION_CHANNEL_LIST.map((module) => ({ module, id: module.description.id })))(
    'are returned by no action for the module $id',
    async ({ module, id }) => {
      const parametersOf = PARAMETERS_BY_MODULE.get(id);
      if (parametersOf === undefined) {
        throw new Error(`Give PARAMETERS_BY_MODULE the Parameters its fake accepts for the module ${id}.`);
      }
      const { actions, input, secretByName } = await saveChannel(module, await parametersOf());

      expect(Object.keys(secretByName)).not.toEqual([]);
      expect(await findSecretLeaks(actions, input, secretByName)).toEqual([]);
    },
  );
});
