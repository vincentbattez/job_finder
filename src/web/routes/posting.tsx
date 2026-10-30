import { useLoaderData, type LoaderFunctionArgs } from 'react-router';

import { ACTIONS } from '#/web/acl/actions.server.ts';
import { ArtefactVersions } from '#/web/components/artefact-versions.tsx';
import { StatusButtons } from '#/web/components/edition.tsx';
import { ExtractionLaunch } from '#/web/components/extraction-launch.tsx';
import { PostingDetail } from '#/web/components/posting-detail.tsx';

export function loader({ params }: LoaderFunctionArgs) {
  return ACTIONS.readPosting({ reference: params.reference });
}

export function meta({ data }: { data: Awaited<ReturnType<typeof loader>> | undefined }) {
  return [{ title: `${data?.posting.title ?? 'Offre'} · Job Finder` }];
}

export default function Posting() {
  const detail = useLoaderData<typeof loader>();
  return (
    <main className="container page">
      <PostingDetail detail={detail} isPage>
        <StatusButtons reference={detail.posting.reference} nextStatusList={detail.nextStatusList} />
        {detail.extraction !== null && <ExtractionLaunch reference={detail.posting.reference} {...detail.extraction} />}
      </PostingDetail>
      {detail.artefactList.map((artefactVersions) => (
        <ArtefactVersions key={artefactVersions.artefact} reference={detail.posting.reference} {...artefactVersions} />
      ))}
    </main>
  );
}
