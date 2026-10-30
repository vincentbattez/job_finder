import { useLoaderData, type LoaderFunctionArgs, type MetaArgs } from 'react-router';

import { catalogueOf } from '#/actions/catalogue.ts';
import { ACTIONS } from '#/web/acl/actions.server.ts';
import { readCandidate } from '#/web/candidate.server.ts';
import { ArtifactVersions } from '#/web/components/artifact-versions.tsx';
import { StatusButtons } from '#/web/components/edition.tsx';
import { ExtractionLaunch } from '#/web/components/extraction-launch.tsx';
import { PostingDetail } from '#/web/components/posting-detail.tsx';

export async function loader({ params, request }: LoaderFunctionArgs) {
  const [{ candidate, locale }, detail] = await Promise.all([
    readCandidate(request),
    ACTIONS.readPosting({ reference: params.reference }),
  ]);
  return { candidate, locale, detail };
}

export function meta({ loaderData }: MetaArgs<typeof loader>) {
  const { posting: copy } = catalogueOf(loaderData);
  return [{ title: copy.pageTitle(loaderData?.detail.posting.title ?? copy.unreadPosting) }];
}

export default function Posting() {
  const { detail } = useLoaderData<typeof loader>();
  return (
    <main className="container page">
      <PostingDetail detail={detail} isPage>
        <StatusButtons reference={detail.posting.reference} nextStatusList={detail.nextStatusList} />
        {detail.extraction !== null && <ExtractionLaunch reference={detail.posting.reference} {...detail.extraction} />}
      </PostingDetail>
      {detail.artifactList.map((artifactVersions) => (
        <ArtifactVersions key={artifactVersions.artifact} reference={detail.posting.reference} {...artifactVersions} />
      ))}
    </main>
  );
}
