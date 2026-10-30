import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it, onTestFinished } from 'vitest';
import { z } from 'zod/v4';

import { createActions, messageOf } from '#/actions/index.ts';
import { CANAL_NOTIFICATION_LIST } from '#/actions/modules.ts';
import { defineCanalNotification, type ICanalNotification } from '#/notification/index.ts';
import { parametre } from '#/parametre/index.ts';

import { createDataDirectory } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';
import { startFakeHomeAssistant } from './fake-home-assistant.ts';
import { createRecordedFetch } from './recorded-http.ts';

// A Béthune Offre in Léa's Zone, from the responses recorded on 2026-10-29
const REFERENCE = '2026-2445600';

// A Version of each Artefact, as the fake Claude writes them, so that every action reading one has it
const RUN_BY_MODULE = {
  recherche: { fileByName: { 'recherche.md': '# Recherche\n\n## Sources\n\n- https://www.justice.fr/\n' } },
  lettre: {
    fileByName: {
      'brouillon.md': 'Madame, Monsieur,\n',
      'destinataires.json': JSON.stringify({
        to: null,
        ccList: [],
        salutation: { text: 'Madame, Monsieur,', source: null },
        justification: 'Aucun champ de l’Offre ne donne d’adresse.',
      }),
    },
  },
  fiche_entretien: { fileByName: { 'fiche-entretien.md': '# Fiche d’entretien\n' } },
  visualisation: { fileByName: { 'visualisation.html': '<!DOCTYPE html>\n<title>Fiche</title>\n' } },
};

// What an action needs beyond the shared input of the check, such as a Pièce, named in .pdf
const PIECE = { fileName: 'cv.pdf' };
const INPUT_BY_ACTION: Record<string, object> = {
  savePiece: {
    ...PIECE,
    content: new Uint8Array(readFileSync(path.join(import.meta.dirname, 'fixtures/profil/cv.pdf'))),
  },
  convertPiece: PIECE,
  deletePiece: PIECE,
};

type ActionMap = Record<string, (rawInput: unknown) => Promise<unknown>>;

// Secret Paramètres are write-only (ADR-0006, ADR-0010): every action, called with the fields every
// input takes, once the Canal is saved, must neither return nor throw any of them. Any action counts,
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
        leakList.push(`${name} returns the secret Paramètre ${secretName}`);
      }
    }
  }
  return leakList;
}

// For each module of the registry, Paramètres its fake accepts, so that the actions that reach the
// Canal succeed too. A module missing here fails the check: its secrets would go unchecked.
const PARAMETRES_BY_MODULE = new Map<string, () => Promise<Record<string, string>>>([
  [
    'home-assistant',
    async () => {
      const homeAssistant = await startFakeHomeAssistant();
      onTestFinished(() => homeAssistant.close());
      return { url: homeAssistant.url, token: homeAssistant.token, service: 'notify.mobile_app_iphone_de_lea' };
    },
  ],
]);

// A module of two secret Paramètres, beside a plain one: the check covers each secret, not one token
const ADDRESS_PARAMETRE = parametre(z.string(), { label: 'Adresse' });
const LOGIN_PARAMETRE = parametre(z.string(), { label: 'Identifiant', isSecret: true });
const PASSWORD_PARAMETRE = parametre(z.string(), { label: 'Mot de passe', isSecret: true });
const FAKE_VAULT = defineCanalNotification({
  id: 'coffre',
  name: 'Coffre',
  parametreSchema: z.object({ address: ADDRESS_PARAMETRE, login: LOGIN_PARAMETRE, password: PASSWORD_PARAMETRE }),
  send: () => Promise.resolve(),
  check: () => Promise.resolve(),
  listChoicesByParametre: { address: () => Promise.resolve([]) },
});
const FAKE_VAULT_PARAMETRES = {
  address: 'coffre-de-lea',
  login: 'identifiant-secret',
  password: 'mot-de-passe-secret',
};

// Léa's Offres detected, a Version of each Artefact ready, and her Canal de notification saved with
// the given Paramètres. The input of the check gives back its non-secret Paramètres only: a save
// without the secrets keeps them.
async function saveCanal(module: ICanalNotification, parametres: Record<string, string>) {
  const actions = await createActions({
    dataDirectory: createDataDirectory(),
    aiSession: createFakeAiSession(...Object.values(RUN_BY_MODULE)),
    fetch: createRecordedFetch().fetch,
    canalNotificationList: [module],
  });
  const { id, parametreList } = module.description;
  await actions.saveCanalNotification({ candidatId: 'lea', canal: id, parametres });
  await actions.detect();
  for (const artefactModule of Object.keys(RUN_BY_MODULE)) {
    await actions.runModule({ module: artefactModule, reference: REFERENCE });
    await actions.runQueuedJobs();
  }
  const secretSet = new Set(parametreList.filter(({ isSecret }) => isSecret).map(({ name }) => name));
  const input = {
    candidatId: 'lea',
    reference: REFERENCE,
    module: 'recherche',
    artefact: 'recherche',
    number: 1,
    jobId: 1,
    statut: 'a_traiter',
    fileName: 'recherche.md',
    markdown: '# Recherche\n',
    consignes: 'Citer chaque source.',
    entryListByTitle: {},
    canal: id,
    parametre: parametreList.find(({ hasChoices }) => hasChoices)?.name,
    parametres: Object.fromEntries(Object.entries(parametres).filter(([name]) => !secretSet.has(name))),
  };
  const secretByName = Object.fromEntries(Object.entries(parametres).filter(([name]) => secretSet.has(name)));
  return { actions, input, secretByName };
}

describe('the write-only secret Paramètres of a Canal de notification', () => {
  it('catches an action that returns any secret Paramètre', async () => {
    const { actions, input, secretByName } = await saveCanal(FAKE_VAULT, FAKE_VAULT_PARAMETRES);
    const leakyActionMap = {
      ...actions,
      readFullCanal: () => Promise.resolve({ password: FAKE_VAULT_PARAMETRES.password }),
    };

    expect(await findSecretLeaks(leakyActionMap, input, secretByName)).toEqual([
      'readFullCanal returns the secret Paramètre password',
    ]);
  });

  it('catches an action the check cannot call', async () => {
    const { actions, input, secretByName } = await saveCanal(FAKE_VAULT, FAKE_VAULT_PARAMETRES);
    const uncalledActionMap = { ...actions, renameCanal: () => Promise.reject(new Error('Nom manquant.')) };

    expect(await findSecretLeaks(uncalledActionMap, input, secretByName)).toEqual([
      'renameCanal fails on the input of the check (Nom manquant.): give it what it needs',
    ]);
  });

  it('are returned by no action, whichever secret', async () => {
    const { actions, input, secretByName } = await saveCanal(FAKE_VAULT, FAKE_VAULT_PARAMETRES);

    expect(Object.keys(secretByName)).toEqual(['login', 'password']);
    expect(await findSecretLeaks(actions, input, secretByName)).toEqual([]);
  });

  it.each(CANAL_NOTIFICATION_LIST.map((module) => ({ module, id: module.description.id })))(
    'are returned by no action for the module $id',
    async ({ module, id }) => {
      const parametresOf = PARAMETRES_BY_MODULE.get(id);
      if (parametresOf === undefined) {
        throw new Error(`Give PARAMETRES_BY_MODULE the Paramètres its fake accepts for the module ${id}.`);
      }
      const { actions, input, secretByName } = await saveCanal(module, await parametresOf());

      expect(Object.keys(secretByName)).not.toEqual([]);
      expect(await findSecretLeaks(actions, input, secretByName)).toEqual([]);
    },
  );
});
