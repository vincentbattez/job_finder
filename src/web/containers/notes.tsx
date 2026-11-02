import { useTranslation } from 'react-i18next';
import { useFetcher } from 'react-router';

import { Notes as NotesView } from '#/web/components/notes.tsx';
import type { IRefusal } from '#/web/failure.ts';

import { useFeedback } from './use-feedback.ts';

// The Notes of a Posting, saved through their action route (ADR-0003), then shown again by the loaders
// the fetcher revalidates; a refusal ends in its toast, and the form keeps what was typed
export function Notes({ reference, notes }: Readonly<{ reference: string; notes: string }>) {
  const { t } = useTranslation('posting');
  const fetcher = useFetcher<IRefusal | null>();
  useFeedback(fetcher, () => t('notes.saved'));
  return (
    <NotesView
      notes={notes}
      isPending={fetcher.state !== 'idle'}
      renderForm={(fieldList) => (
        <fetcher.Form method="post" action={`/postings/${reference}/notes`} preventScrollReset>
          {fieldList}
        </fetcher.Form>
      )}
    />
  );
}
