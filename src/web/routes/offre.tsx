import { useLoaderData, type LoaderFunctionArgs } from 'react-router';

import { ACTIONS } from '#/web/acl/actions.server.ts';
import { ArtefactVersions } from '#/web/components/artefact-versions.tsx';
import { OffreFiche } from '#/web/components/offre-fiche.tsx';

export function loader({ params }: LoaderFunctionArgs) {
  return ACTIONS.readOffre({ reference: params.reference });
}

export function meta({ data }: { data: Awaited<ReturnType<typeof loader>> | undefined }) {
  return [{ title: `${data?.offre.title ?? 'Offre'} · Job Finder` }];
}

export default function Offre() {
  const fiche = useLoaderData<typeof loader>();
  return (
    <main className="container page">
      <OffreFiche fiche={fiche} isPage />
      {fiche.artefactList.map((artefactVersions) => (
        <ArtefactVersions key={artefactVersions.artefact} reference={fiche.offre.reference} {...artefactVersions} />
      ))}
    </main>
  );
}
