import path from 'node:path';

import { z } from 'zod/v4';

import { createActions } from '#/actions/index.ts';

// The front works on data/ like jf, or on the folder JF_DATA_DIRECTORY names: dev-data/ for
// `mise run web:dev`, a temporary folder for the e2e tests (playwright.config.ts)
const { JF_DATA_DIRECTORY: dataDirectory, JF_PROTOTYPE: prototype } = z
  .object({ JF_DATA_DIRECTORY: z.string().min(1).optional(), JF_PROTOTYPE: z.string().optional() })
  .parse(process.env);
const DATA_DIRECTORY = path.resolve(dataDirectory ?? path.join(import.meta.dirname, '../../../data'));

// PROTOTYPE (branch prototype/v1-ux): `mise run prototype` serves a snapshot of data/ with no
// Notification Channel nor Source, so nothing it does can notify anyone or query a job site
const PROTOTYPE_OPTION = prototype === '1' ? { notificationChannelList: [], sourceFactoryList: [] } : {};

// The same actions as the CLI, opened once for the whole server on the first request (ADR-0003)
export const ACTIONS = await createActions({ dataDirectory: DATA_DIRECTORY, ...PROTOTYPE_OPTION });
