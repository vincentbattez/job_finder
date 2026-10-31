import { createActions } from '#/actions/index.ts';

import { createFakeNotificationChannel } from './fake-notification-channel.ts';
import { createRecordedFetch } from './recorded-http.ts';

// Run by test/global-setup.ts in a process of its own, where the actions open: runs the first
// Detection of the run on Léa's data folder it names, on the recorded responses, with the fake
// Notification Channel saved as hers. A first launch sends nothing and launches no Claude.
const [dataDirectory = ''] = process.argv.slice(2);
const notificationChannel = createFakeNotificationChannel();
const actions = await createActions({
  dataDirectory,
  fetch: createRecordedFetch().fetch,
  notificationChannelList: notificationChannel.notificationChannelList,
});
await notificationChannel.saveFor(actions);
await actions.detect();
