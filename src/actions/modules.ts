import { HOME_ASSISTANT } from '#/modules/notification-home-assistant/index.ts';
import { SMTP } from '#/modules/notification-smtp/index.ts';
import { PEP } from '#/modules/source-pep/index.ts';

// The registry of the interchangeable modules: the only file that imports them, and so names them.
// Adding a module is a folder of src/modules/ and a line here (ADR-0010,
// test/architecture.test.ts).
export const NOTIFICATION_CHANNEL_LIST = [HOME_ASSISTANT, SMTP];

export const SOURCE_LIST = [PEP];
