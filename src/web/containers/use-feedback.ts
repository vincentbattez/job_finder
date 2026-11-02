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
// read once the mutation settles, so a switch of Locale words it in the new one. A success that acts at
// once, such as archiving, offers its undo as the toast's action (spec #125, « Front »).
export function useFeedback(
  fetcher: IFetcherState,
  successMessage: () => string,
  undo?: () => { label: string; onClick: () => void },
): void {
  const sentReference = useRef<{ data: unknown } | null>(null);
  const successMessageReference = useRef(successMessage);
  successMessageReference.current = successMessage;
  const undoReference = useRef(undo);
  undoReference.current = undo;
  useEffect(() => {
    if (fetcher.state !== 'idle') {
      sentReference.current ??= { data: fetcher.data };
      return;
    }
    const sent = sentReference.current;
    if (sent === null) {
      return;
    }
    sentReference.current = null;
    // The answer of this mutation, never the refusal a previous one left on the fetcher
    const error = fetcher.data === sent.data ? null : fetcher.data?.error;
    if (typeof error === 'string') {
      toast.error(error);
    } else {
      toast.success(successMessageReference.current(), { action: undoReference.current?.() });
    }
  }, [fetcher.state, fetcher.data]);
}
