import type { ComponentProps, ReactNode } from 'react';
import { useFetcher } from 'react-router';

import { Interviews as InterviewsView } from '#/web/components/interviews.tsx';
import type { IRefusal } from '#/web/failure.ts';

// One fetcher per form, so a refusal comes back to the form that posted it, which keeps what was typed;
// without JS, the form posts on its own and the route brings the Candidate back to the Posting page
function InterviewForm({
  reference,
  renderFieldList,
}: Readonly<{ reference: string; renderFieldList: (error: string | null | undefined) => ReactNode }>) {
  const fetcher = useFetcher<IRefusal>();
  return (
    <fetcher.Form method="post" action={`/postings/${reference}/interviews`} preventScrollReset>
      {renderFieldList(fetcher.data?.error)}
    </fetcher.Form>
  );
}

// The Interviews of a Posting, added, edited and deleted through their action route (ADR-0003)
export function Interviews({
  reference,
  ...properties
}: Readonly<{ reference: string } & Omit<ComponentProps<typeof InterviewsView>, 'renderForm'>>) {
  return (
    <InterviewsView
      {...properties}
      renderForm={(formKey, renderFieldList) => (
        <InterviewForm key={formKey} reference={reference} renderFieldList={renderFieldList} />
      )}
    />
  );
}
