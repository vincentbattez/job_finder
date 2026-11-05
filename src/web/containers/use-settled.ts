import { useEffect, useRef } from 'react';

interface IFetcherState<TAnswer> {
  state: 'idle' | 'loading' | 'submitting';
  data: TAnswer;
}

// Calls back once per mutation a fetcher posted, once it settles, with its answer: undefined when it
// left none, a redirect's, rather than what a previous mutation left on the fetcher. Under load React
// may skip the submitting render, or every render of the mutation, its updates being transitions: only
// a new answer tells then, which is why relayAction answers each mutation with an object of its own.
export function useSettled<TAnswer>(
  fetcher: IFetcherState<TAnswer>,
  onSettled: (answer: TAnswer | undefined) => void,
): void {
  const sentReference = useRef<{ data: TAnswer } | null>(null);
  // What the fetcher held before its mutation, for the render that first shows it with its answer in
  const idleDataReference = useRef(fetcher.data);
  const onSettledReference = useRef(onSettled);
  onSettledReference.current = onSettled;
  useEffect(() => {
    if (fetcher.state !== 'idle') {
      sentReference.current ??= { data: idleDataReference.current };
      return;
    }
    const sent =
      sentReference.current ??
      (fetcher.data === idleDataReference.current ? null : { data: idleDataReference.current });
    idleDataReference.current = fetcher.data;
    if (sent === null) {
      return;
    }
    sentReference.current = null;
    onSettledReference.current(fetcher.data === sent.data ? undefined : fetcher.data);
  }, [fetcher.state, fetcher.data]);
}
