import { useLoaderData, useSearchParams, type LoaderFunctionArgs, type MetaArgs } from 'react-router';

import { catalogueOf } from '#/actions/catalogue.ts';
import { ACTIONS } from '#/web/acl/actions.server.ts';
import { readCandidate } from '#/web/candidate.server.ts';
import { useCatalogue } from '#/web/catalogue.ts';
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

export function meta({ loaderData }: MetaArgs<typeof loader>) {
  return [{ title: catalogueOf(loaderData?.candidate).postingList.pageTitle }];
}

export default function Postings() {
  const { candidate, postingList } = useLoaderData<typeof loader>();
  const { postingList: copy } = useCatalogue();
  const [searchParameters] = useSearchParams();
  if (candidate === null) {
    return (
      <main className="container page">
        <div className="page__head">
          <h1>{copy.noCandidateHeading}</h1>
          <p>{copy.noCandidateHint}</p>
        </div>
      </main>
    );
  }
  const filteredPostingList = filterPostings(postingList, searchParameters);
  return (
    <main className="container page">
      <div className="page__head">
        <h1>{copy.heading(candidate.name)}</h1>
        <Detection />
        <JobDescriptionImport />
        {postingList.length > 0 && <PostingFilters postingList={postingList} />}
      </div>
      {postingList.length > 0 && <PostingMap postingList={filteredPostingList} />}
      {filteredPostingList.length === 0 && postingList.length > 0 ? (
        <p className="empty">{copy.noFilteredPosting}</p>
      ) : (
        <PostingList postingList={filteredPostingList} />
      )}
    </main>
  );
}
