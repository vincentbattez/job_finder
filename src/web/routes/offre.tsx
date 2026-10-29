import { useLoaderData, type LoaderFunctionArgs } from 'react-router';

import { ACTIONS } from '#/web/acl/actions.server.ts';
import { ArtefactVersions } from '#/web/components/artefact-versions.tsx';
import { StatutButtons } from '#/web/components/edition.tsx';
import { ExtractionLaunch } from '#/web/components/extraction-launch.tsx';
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
      <OffreFiche fiche={fiche} isPage>
        <StatutButtons reference={fiche.offre.reference} nextStatutList={fiche.nextStatutList} />
        {fiche.extraction !== null && <ExtractionLaunch reference={fiche.offre.reference} {...fiche.extraction} />}
      </OffreFiche>
      {fiche.artefactList.map((artefactVersions) => (
        <ArtefactVersions key={artefactVersions.artefact} reference={fiche.offre.reference} {...artefactVersions} />
      ))}
    </main>
  );
}
