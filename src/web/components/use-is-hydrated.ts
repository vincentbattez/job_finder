import { useSyncExternalStore } from 'react';

// Nothing to watch: the value only differs between the server and the browser
function unsubscribe(): void {
  // nothing was subscribed
}

function subscribe() {
  return unsubscribe;
}

// What needs React waits for it to run the page: a form that posts to a route answering only React
// would open that route's raw answer, and React taking over an editor would reset the text typed
export function useIsHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
