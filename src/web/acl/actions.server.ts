import path from 'node:path';

import { createActions } from '#/actions/index.ts';

// The front works on data/ like jf, or on the folder JF_DATA_DIRECTORY names: dev-data/ for
// `mise run web`, a temporary folder for the e2e tests (playwright.config.ts)
const DATA_DIRECTORY = path.resolve(process.env.JF_DATA_DIRECTORY ?? path.join(import.meta.dirname, '../../../data'));

// The same actions as the CLI, opened once for the whole server on the first request (ADR-0003)
export const ACTIONS = await createActions({ dataDirectory: DATA_DIRECTORY });
