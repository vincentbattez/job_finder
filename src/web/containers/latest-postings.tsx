import type { Actions } from '#/actions/index.ts';
import { LatestPostings as LatestPostingsView } from '#/web/components/latest-postings.tsx';

export type LatestPostingList = Awaited<ReturnType<Actions['listLatestPostings']>>;

// The page's loader calls it and relays what it gives (ADR-0008). It receives the actions rather than
// importing them, since this file also reaches the browser, which never loads a .server module.
export function loadLatestPostings(actions: Actions, candidateId: string): Promise<LatestPostingList> {
  return actions.listLatestPostings({ candidateId });
}

export function LatestPostings({ postingList }: Readonly<{ postingList: LatestPostingList }>) {
  return <LatestPostingsView postingList={postingList} />;
}
