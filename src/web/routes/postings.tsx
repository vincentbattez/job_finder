import { useLoaderData, useSearchParams, type LoaderFunctionArgs } from 'react-router';

import { ACTIONS } from '#/web/acl/actions.server.ts';
import { readCandidate } from '#/web/candidate.server.ts';
import { Detection } from '#/web/components/detection.tsx';
import { JobDescriptionImport } from '#/web/components/job-description-import.tsx';
import { filterPostings, PostingFilters } from '#/web/components/posting-filters.tsx';
import { PostingList } from '#/web/components/posting-list.tsx';
import { PostingMap } from '#/web/components/posting-map.tsx';

export async function loader({ request }: LoaderFunctionArgs) {
  const { candidate } = await readCandidate(request);
  return {
    candidate,
    postingList: candidate === null ? [] : await ACTIONS.listPostings({ candidateId: candidate.id }),
  };
}

export function meta() {
  return [{ title: 'Offres · Job Finder' }];
}

export default function Postings() {
  const { candidate, postingList } = useLoaderData<typeof loader>();
  const [searchParameters] = useSearchParams();
  if (candidate === null) {
    return (
      <main className="container page">
        <div className="page__head">
          <h1>Qui consulte ses Offres ?</h1>
          <p>Choisissez votre nom dans le menu en haut de la page. Le front s’en souviendra.</p>
        </div>
      </main>
    );
  }
  const filteredPostingList = filterPostings(postingList, searchParameters);
  return (
    <main className="container page">
      <div className="page__head">
        <h1>Offres de {candidate.name}</h1>
        <Detection />
        <JobDescriptionImport />
        {postingList.length > 0 && <PostingFilters postingList={postingList} />}
      </div>
      {postingList.length > 0 && <PostingMap postingList={filteredPostingList} />}
      {filteredPostingList.length === 0 && postingList.length > 0 ? (
        <p className="empty">Aucune Offre ne répond à ces filtres.</p>
      ) : (
        <PostingList postingList={filteredPostingList} />
      )}
    </main>
  );
}
