import { ACTIONS } from '#/web/acl/actions.server.ts';

// The Détection button posts here: the same action as jf detect and the daily automation. A failed
// Détection goes back to the button with its message.
export async function action() {
  try {
    return { detectionList: await ACTIONS.detect(), error: null };
  } catch (error) {
    return { detectionList: [], error: error instanceof Error ? error.message : String(error) };
  }
}
