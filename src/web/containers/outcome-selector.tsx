import { useFetcher } from 'react-router';

import type { Application } from '#/web/components/application-row.tsx';
import type { Status } from '#/web/components/badge.tsx';
import { OutcomeSelector as OutcomeSelectorView } from '#/web/components/outcome-selector.tsx';
import type { IRefusal } from '#/web/failure.ts';

interface IOutcomeSelector {
  reference: string;
  status: Status;
  statusChoiceList: Status[];
  // The page the route brings back to, an Application row's own; the Posting page without it
  returnTo?: string;
}

// The one action Container that changes the Status, for the Posting page and the Application rows
// (ADR-0008). Its route relays to the action, which refuses what the Posting cannot move to; a
// plain form, so it also posts without JS.
export function OutcomeSelector({ reference, status, statusChoiceList, returnTo }: Readonly<IOutcomeSelector>) {
  const fetcher = useFetcher<IRefusal>();
  return (
    <fetcher.Form method="post" action={`/postings/${reference}/status`} preventScrollReset>
      {returnTo !== undefined && <input type="hidden" name="returnTo" value={returnTo} />}
      <OutcomeSelectorView status={status} statusChoiceList={statusChoiceList} error={fetcher.data?.error} />
    </fetcher.Form>
  );
}

// The selector of each Application row, which brings back to the page of the row, JS or not
export function renderRowOutcomeSelector(returnTo: string) {
  return ({ posting, statusChoiceList }: Application) => (
    <OutcomeSelector
      reference={posting.reference}
      status={posting.status}
      statusChoiceList={statusChoiceList}
      returnTo={returnTo}
    />
  );
}
