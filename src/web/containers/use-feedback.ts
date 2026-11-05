import { useRef } from 'react';
import { toast } from 'sonner';

import type { IRefusal } from '#/web/failure.ts';

import { useSettled } from './use-settled.ts';

interface IFetcherState {
  state: 'idle' | 'loading' | 'submitting';
  data: IRefusal | undefined;
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
  const successMessageReference = useRef(successMessage);
  successMessageReference.current = successMessage;
  const actionReference = useRef(action);
  actionReference.current = action;
  useSettled(fetcher, (answer) => {
    if (typeof answer?.error === 'string') {
      toast.error(answer.error);
    } else {
      toast.success(successMessageReference.current(), { action: actionReference.current?.() });
    }
  });
}
