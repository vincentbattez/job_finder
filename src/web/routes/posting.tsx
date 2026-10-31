import { useLoaderData, type LoaderFunctionArgs, type MetaArgs } from 'react-router';

import { localeOf, tFor } from '#/actions/i18n.ts';
import { ACTIONS } from '#/web/acl/actions.server.ts';
import { readCandidate } from '#/web/candidate.server.ts';
import { PostingDetail } from '#/web/components/posting-detail.tsx';
import { ArtifactVersions } from '#/web/containers/artifact-versions.tsx';
import { ArchiveButton, StatusButtons } from '#/web/containers/edition.tsx';
import { ExtractionLaunch } from '#/web/containers/extraction-launch.tsx';
import { Notes } from '#/web/containers/notes.tsx';
import { relayLoader } from '#/web/relay-action.server.ts';

export function loader({ params, request }: LoaderFunctionArgs) {
  return relayLoader(request, async () => {
    const [{ candidate, locale }, detail] = await Promise.all([
      readCandidate(request),
      ACTIONS.readPosting({ reference: params.reference }),
    ]);
    return { candidate, locale, detail };
  });
}

export function meta({ loaderData }: MetaArgs<typeof loader>) {
  const t = tFor(localeOf(loaderData), 'posting');
  return [{ title: t('pageTitle', { postingTitle: loaderData?.detail.posting.title ?? t('unreadPosting') }) }];
}

export default function Posting() {
  const { detail } = useLoaderData<typeof loader>();
  return (
    <main className="container page">
      <PostingDetail detail={detail} isPage>
        <StatusButtons reference={detail.posting.reference} nextStatusList={detail.nextStatusList} />
        <ArchiveButton reference={detail.posting.reference} isArchived={detail.posting.archivedAt !== null} />
        {detail.extraction !== null && <ExtractionLaunch reference={detail.posting.reference} {...detail.extraction} />}
      </PostingDetail>
      <Notes reference={detail.posting.reference} notes={detail.posting.notes} />
      {detail.artifactList.map((artifactVersions) => (
        <ArtifactVersions key={artifactVersions.artifact} reference={detail.posting.reference} {...artifactVersions} />
      ))}
    </main>
  );
}
