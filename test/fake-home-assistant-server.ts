import { z } from 'zod/v4';

import { startFakeHomeAssistant } from './fake-home-assistant.ts';

// The fake Home Assistant of the e2e tests, the first web server of playwright.config.ts: in its own
// process, on the port it is given, so the seed, the front and the worker all notify it
const { url } = await startFakeHomeAssistant({ port: z.coerce.number().int().positive().parse(process.argv[2]) });
process.stdout.write(`Fake Home Assistant ready on ${url}.\n`);
