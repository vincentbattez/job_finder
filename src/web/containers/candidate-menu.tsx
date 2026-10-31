import type { ComponentProps } from 'react';
import { useFetcher } from 'react-router';

import { CandidateMenu as CandidateMenuView } from '#/web/components/candidate-menu.tsx';
import type { IRefusal } from '#/web/failure.ts';

// A plain form, so the choice also works before React hydrates the page; a refusal shows beside it
export function CandidateMenu(properties: Readonly<Omit<ComponentProps<typeof CandidateMenuView>, 'error'>>) {
  const fetcher = useFetcher<IRefusal>();
  return (
    <fetcher.Form method="post" action="/candidate">
      <CandidateMenuView {...properties} error={fetcher.data?.error} />
    </fetcher.Form>
  );
}
