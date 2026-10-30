import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it, onTestFinished } from 'vitest';

import { createActions, messageOf } from '#/actions/index.ts';

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
  deletePiece: PIECE,
};

type ActionMap = Record<string, (rawInput: unknown) => Promise<unknown>>;

// The token is write-only (ADR-0006): every action, called with the fields every input takes, once a
// token is saved, must neither return it nor throw it. Any action counts, those to come included: one
// whose input this one does not fit is reported, until INPUT_BY_ACTION gives it what it needs. Each action runs
// once, on that input: a leak on another branch of it would pass.
async function findTokenLeaks(actionMap: ActionMap, input: object, token: string): Promise<string[]> {
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
    if (output.includes(token)) {
      leakList.push(`${name} returns the token`);
    }
  }
  return leakList;
}

// Léa's Offres detected, a Version of each Artefact ready, and her Connexion Home Assistant saved with the token of
// the fake, which accepts it: the actions that reach Home Assistant then succeed too
async function saveToken() {
  const homeAssistant = await startFakeHomeAssistant();
  onTestFinished(() => homeAssistant.close());
  const { url, token } = homeAssistant;
  const actions = await createActions({
    dataDirectory: createDataDirectory(),
    aiSession: createFakeAiSession(...Object.values(RUN_BY_MODULE)),
    fetch: createRecordedFetch().fetch,
  });
  await actions.saveConnexionHomeAssistant({ candidatId: 'lea', url, token });
  await actions.detect();
  for (const module of Object.keys(RUN_BY_MODULE)) {
    await actions.runModule({ module, reference: REFERENCE });
    await actions.runQueuedJobs();
  }
  // The fields of every action's input, the token left out: a save without it keeps it
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
    url,
    service: 'notify.mobile_app_iphone_de_lea',
  };
  return { actions, input, token };
}

describe('the write-only token of the Connexion Home Assistant', () => {
  it('catches an action that returns the token', async () => {
    const { actions, input, token } = await saveToken();
    const leakyActionMap = { ...actions, readFullConnexion: () => Promise.resolve({ url: input.url, token }) };

    expect(await findTokenLeaks(leakyActionMap, input, token)).toEqual(['readFullConnexion returns the token']);
  });

  it('catches an action the check cannot call', async () => {
    const { actions, input, token } = await saveToken();
    const uncalledActionMap = { ...actions, renameConnexion: () => Promise.reject(new Error('Nom manquant.')) };

    expect(await findTokenLeaks(uncalledActionMap, input, token)).toEqual([
      'renameConnexion fails on the input of the check (Nom manquant.): give it what it needs',
    ]);
  });

  it('is returned by no action', async () => {
    const { actions, input, token } = await saveToken();

    expect(await findTokenLeaks(actions, input, token)).toEqual([]);
  });
});
