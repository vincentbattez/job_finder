import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createActions, type Actions } from '#/actions/index.ts';

import { createMigratedDataDirectory } from './data-directory.ts';
import { createRecordedFetch } from './recorded-http.ts';

const EXAMPLE_CONFIG = readFileSync(path.join(import.meta.dirname, '..', 'config.example.json'), 'utf8');

async function detectWithDefaultDelay(defaultDelayMonths: number): Promise<Actions> {
  const dataDirectory = createMigratedDataDirectory();
  writeFileSync(
    path.join(dataDirectory, 'config.json'),
    EXAMPLE_CONFIG.replace('"defaultDelayMonths": 6', () => `"defaultDelayMonths": ${String(defaultDelayMonths)}`),
  );
  const actions = await createActions({ dataDirectory, fetch: createRecordedFetch().fetch });
  await actions.detect();
  return actions;
}

async function findOffre(actions: Actions, reference: string) {
  const offreList = await actions.listOffres({ candidatId: 'lea' });
  return offreList.find((offre) => offre.reference === reference);
}

// Expirée depends on the day: the clock stays on the day the responses were recorded
beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-29T12:00:00Z'));
});

afterAll(() => {
  vi.useRealTimers();
});

// Each test changes the statut of its own Offres, so they share one Détection
describe('statut of an Offre', () => {
  let actions: Actions;

  beforeAll(async () => {
    actions = await detectWithDefaultDelay(6);
  });

  async function findStatus(reference: string) {
    const offre = await findOffre(actions, reference);
    return offre?.statut;
  }

  it('marks an Offre as Postulée, though it has no Lettre', async () => {
    await actions.changeStatut({ reference: '2026-2445600', statut: 'postulee' });

    expect(await findStatus('2026-2445600')).toBe('postulee');
  });

  it('marks as Postulées the Boulogne Offres the Candidat applied to before the tool, though Expirées', async () => {
    await actions.changeStatut({ reference: '2026-2231960', statut: 'postulee' });
    await actions.changeStatut({ reference: '2026-2338409', statut: 'postulee' });

    expect([await findOffre(actions, '2026-2231960'), await findOffre(actions, '2026-2338409')]).toMatchObject([
      { statut: 'postulee', isExpiree: true },
      { statut: 'postulee', isExpiree: true },
    ]);
  });

  it('archives an Offre', async () => {
    await actions.changeStatut({ reference: '2026-2445609', statut: 'archivee' });

    expect(await findStatus('2026-2445609')).toBe('archivee');
  });

  it('archives a Postulée Offre, whose Lettre retenue stays the one sent', async () => {
    await actions.changeStatut({ reference: '2026-2445183', statut: 'postulee' });

    await actions.changeStatut({ reference: '2026-2445183', statut: 'archivee' });

    expect(await findStatus('2026-2445183')).toBe('archivee');
    await expect(actions.runModule({ module: 'lettre', reference: '2026-2445183' })).rejects.toThrow(
      /L'Offre 2026-2445183 a été Postulée : sa Lettre retenue est figée/,
    );
  });

  // Postulée is never undone: the Lettre retenue was sent
  it('brings an Archivée Offre once Postulée back to Postulée, never to À traiter', async () => {
    await actions.changeStatut({ reference: '2026-2350473', statut: 'postulee' });
    await actions.changeStatut({ reference: '2026-2350473', statut: 'archivee' });

    await expect(actions.changeStatut({ reference: '2026-2350473', statut: 'a_traiter' })).rejects.toThrow(
      /L'Offre 2026-2350473 est Archivée : elle ne peut passer qu'en Postulée/,
    );
    await actions.changeStatut({ reference: '2026-2350473', statut: 'postulee' });
    expect(await findStatus('2026-2350473')).toBe('postulee');
  });

  it('never brings a Postulée Offre back to À traiter', async () => {
    await actions.changeStatut({ reference: '2026-2360411', statut: 'postulee' });

    await expect(actions.changeStatut({ reference: '2026-2360411', statut: 'a_traiter' })).rejects.toThrow(
      /L'Offre 2026-2360411 est Postulée : elle ne peut passer qu'en Archivée/,
    );
    expect(await findStatus('2026-2360411')).toBe('postulee');
  });

  it('brings an Archivée Offre never Postulée back to À traiter', async () => {
    await actions.changeStatut({ reference: '2026-2199164', statut: 'archivee' });

    await actions.changeStatut({ reference: '2026-2199164', statut: 'a_traiter' });

    expect(await findStatus('2026-2199164')).toBe('a_traiter');
  });

  // The front shows a button for each of them, and none other
  it('gives the statuts each Offre can move to', async () => {
    await actions.changeStatut({ reference: '2026-2445629', statut: 'postulee' });
    await actions.changeStatut({ reference: '2026-2445637', statut: 'archivee' });
    await actions.changeStatut({ reference: '2026-2445671', statut: 'postulee' });
    await actions.changeStatut({ reference: '2026-2445671', statut: 'archivee' });

    const ficheList = await Promise.all(
      ['2026-2445584', '2026-2445629', '2026-2445637', '2026-2445671'].map((reference) =>
        actions.readOffre({ reference }),
      ),
    );

    expect(ficheList.map(({ nextStatutList }) => nextStatutList)).toEqual([
      ['postulee', 'archivee'],
      ['archivee'],
      ['a_traiter'],
      ['postulee'],
    ]);
  });

  it('marks a Postulée Offre as Postulée again without complaint', async () => {
    await actions.changeStatut({ reference: '2026-2360445', statut: 'postulee' });

    await actions.changeStatut({ reference: '2026-2360445', statut: 'postulee' });

    expect(await findStatus('2026-2360445')).toBe('postulee');
  });

  it('refuses an unknown Offre', async () => {
    await expect(actions.changeStatut({ reference: '2026-0000000', statut: 'postulee' })).rejects.toThrow(
      /Offre inconnue : 2026-0000000/,
    );
  });
});

it('refuses a reference shared by the Offres of two Candidats', async () => {
  const dataDirectory = createMigratedDataDirectory();
  const veille = {
    source: 'pep',
    parametres: { title: 'attaché de justice', courtOfAppealList: ['Douai'] },
  };
  const candidatList = ['lea', 'camille'].map((id) => ({
    id,
    name: id,
    veilleList: [{ ...veille, id: `attache-de-justice-${id}` }],
  }));
  writeFileSync(path.join(dataDirectory, 'config.json'), JSON.stringify({ defaultDelayMonths: 6, candidatList }));
  const actions = await createActions({ dataDirectory, fetch: createRecordedFetch().fetch });
  await actions.detect();

  await expect(actions.changeStatut({ reference: '2026-2445600', statut: 'postulee' })).rejects.toThrow(
    /Plusieurs Offres ont la référence 2026-2445600, chez des Candidats différents : .*Veille/,
  );
  const offre = await findOffre(actions, '2026-2445600');
  expect(offre?.statut).toBe('a_traiter');
});

describe('Expirée', () => {
  it('flags the Offres whose Date limite is over', async () => {
    const actions = await detectWithDefaultDelay(6);

    expect([await findOffre(actions, '2026-2231960'), await findOffre(actions, '2026-2445600')]).toMatchObject([
      { dateLimite: new Date('2026-04-23'), isExpiree: true },
      { dateLimite: new Date('2026-11-20'), isExpiree: false },
    ]);
  });

  // 2026-2412620 has no Date limite and was published on 2026-09-24
  it('flags an Offre without a Date limite once its publication plus the default delay of the config is over', async () => {
    const offreList = [
      await findOffre(await detectWithDefaultDelay(6), '2026-2412620'),
      await findOffre(await detectWithDefaultDelay(1), '2026-2412620'),
    ];

    expect(offreList).toMatchObject([
      { dateLimite: null, isExpiree: false },
      { dateLimite: null, isExpiree: true },
    ]);
  });
});
