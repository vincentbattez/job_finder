import { messageOf } from '#/actions/index.ts';
import { ACTIONS } from '#/web/acl/actions.server.ts';

// The Detection button posts here: the same action as jf detect and the daily automation. A failed
// Detection goes back to the button with its message.
export async function action() {
  try {
    return { detectionList: await ACTIONS.detect(), error: null };
  } catch (error) {
    return { detectionList: [], error: messageOf(error) };
  }
}
