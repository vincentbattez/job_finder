import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

import type { IRefusal } from '#/web/failure.ts';

interface IFetcherState {
  state: 'idle' | 'loading' | 'submitting';
  data: IRefusal | null | undefined;
}

// The front's one feedback convention (spec #125, DESIGN.md « Feedback »): every mutation a fetcher
// posts ends in a toast, its success's message or, when relayAction refused it, the message of its
// Error Code. Its button shows isPending meanwhile: fetcher.state !== 'idle'. The success message is
// read once the mutation settles, so a switch of Locale words it in the new one. A success may offer an
// action in its toast, such as the undo of an archiving, which acts at once (spec #125, « Front »).
export function useFeedback(
  fetcher: IFetcherState,
  successMessage: () => string,
  action?: () => { label: string; onClick: () => void },
): void {
  const sentReference = useRef<{ data: unknown } | null>(null);
  // What the fetcher held before its mutation: under load React may skip the submitting render and
  // first show the fetcher loading, its answer already in, so the answer cannot be read off then
  const idleDataReference = useRef<unknown>(fetcher.data);
  const successMessageReference = useRef(successMessage);
  successMessageReference.current = successMessage;
  const actionReference = useRef(action);
  actionReference.current = action;
  useEffect(() => {
    if (fetcher.state !== 'idle') {
      sentReference.current ??= { data: idleDataReference.current };
      return;
    }
    // React may even skip every render of the mutation, its updates being transitions: an answer the
    // fetcher did not hold before then tells that it settled
    const sent =
      sentReference.current ??
      (fetcher.data === idleDataReference.current ? null : { data: idleDataReference.current });
    idleDataReference.current = fetcher.data;
    if (sent === null) {
      return;
    }
    sentReference.current = null;
    // The answer of this mutation, never the refusal a previous one left on the fetcher
    const error = fetcher.data === sent.data ? null : fetcher.data?.error;
    if (typeof error === 'string') {
      toast.error(error);
    } else {
      toast.success(successMessageReference.current(), { action: actionReference.current?.() });
    }
  }, [fetcher.state, fetcher.data]);
}
