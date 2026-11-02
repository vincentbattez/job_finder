import { describe, expect, it } from 'vitest';

import { textOf } from '#/actions/i18n.ts';
import { createActions } from '#/actions/index.ts';

import { createDataDirectory } from './data-directory.ts';

// A module adds its namespace when its entry point is loaded (ADR-0010, ADR-0012): every text its
// descriptor names must already read in both locales the first time it is translated
describe('the copy of the registered modules', () => {
  it('reads each Parameter text of every Source and Notification Channel in both locales', async () => {
    const actions = await createActions({ dataDirectory: createDataDirectory() });
    const moduleList = [...(await actions.listSources()), ...(await actions.listNotificationChannels())];

    const keyList = moduleList.flatMap(({ parameterList }) =>
      parameterList.flatMap(({ label, placeholder }) => (placeholder === null ? label : [label, placeholder])),
    );

    expect(keyList.length).toBeGreaterThan(0);
    for (const key of keyList) {
      expect(textOf('fr', key)).not.toBe(key);
      expect(textOf('en', key)).not.toBe(key);
    }
  });

  it('reads the French and English labels of the PEP Source word for word', async () => {
    const actions = await createActions({ dataDirectory: createDataDirectory() });
    const sourceList = await actions.listSources();
    const pep = sourceList.find(({ id }) => id === 'pep');

    expect(pep?.parameterList.map(({ label }) => [textOf('fr', label), textOf('en', label)])).toEqual([
      ['Titre recherché', 'Searched title'],
    ]);
  });
});
