import { useSyncExternalStore } from 'react';

// Nothing to watch: the value only differs between the server and the browser
function unsubscribe(): void {
  // nothing was subscribed
}

function subscribe() {
  return unsubscribe;
}

// A form that posts to a route answering only React must wait for React to run the page: posted
// before, it would open that route's raw answer
export function useIsHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
