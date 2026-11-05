import { useEffect, useRef } from 'react';

export interface IFetcherState<TAnswer> {
  state: 'idle' | 'loading' | 'submitting';
  data: TAnswer;
}

interface ISettleMemory<TAnswer> {
  // What the fetcher held when the mutation in flight was seen leaving
  sent: { data: TAnswer } | null;
  // What the fetcher held when last seen idle
  idleData: TAnswer;
}

export function createSettleMemory<TAnswer>(data: TAnswer): ISettleMemory<TAnswer> {
  return { sent: null, idleData: data };
}

// Reads one render of a fetcher: the answer of the mutation it settles, undefined when that left none,
// a redirect's, rather than what a previous mutation left on the fetcher; null when it settles none.
// Under load React may skip the submitting render, or every render of the mutation, its updates being
// transitions: only a new answer tells then, which is why relayAction answers each mutation with an
// object of its own.
export function settle<TAnswer>(
  memory: ISettleMemory<TAnswer>,
  { state, data }: IFetcherState<TAnswer>,
): { answer: TAnswer | undefined } | null {
  if (state !== 'idle') {
    memory.sent ??= { data: memory.idleData };
    return null;
  }
  const sent = memory.sent ?? (data === memory.idleData ? null : { data: memory.idleData });
  memory.idleData = data;
  memory.sent = null;
  if (sent === null) {
    return null;
  }
  return { answer: data === sent.data ? undefined : data };
}

// Calls back once per mutation a fetcher posted, once it settles, with its answer
export function useSettled<TAnswer>(
  fetcher: IFetcherState<TAnswer>,
  onSettled: (answer: TAnswer | undefined) => void,
): void {
  const memoryReference = useRef(createSettleMemory(fetcher.data));
  const onSettledReference = useRef(onSettled);
  onSettledReference.current = onSettled;
  useEffect(() => {
    const settled = settle(memoryReference.current, { state: fetcher.state, data: fetcher.data });
    if (settled !== null) {
      onSettledReference.current(settled.answer);
    }
  }, [fetcher.state, fetcher.data]);
}
