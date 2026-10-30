import { createActions } from '#/actions/index.ts';

import { createLea } from './lea.ts';

// Run by test/global-setup.ts in a process of its own, where the actions open: gives Léa and her
// Veille to the migrated database of the data folder it names
const [dataDirectory = ''] = process.argv.slice(2);
await createLea(await createActions({ dataDirectory }));
