import { useFetcher } from 'react-router';

import { Notes as NotesView } from '#/web/components/notes.tsx';
import type { IRefusal } from '#/web/failure.ts';

// The Notes of a Posting, saved through their action route, which brings the Candidate back to the
// Posting page (ADR-0003). Through a fetcher, a refusal comes back to the form, which keeps what was
// typed; without JS, the form posts on its own.
export function Notes({ reference, notes }: Readonly<{ reference: string; notes: string }>) {
  const fetcher = useFetcher<IRefusal>();
  return (
    <NotesView
      notes={notes}
      error={fetcher.data?.error}
      renderForm={(fieldList) => (
        <fetcher.Form method="post" action={`/postings/${reference}/notes`} preventScrollReset>
          {fieldList}
        </fetcher.Form>
      )}
    />
  );
}
