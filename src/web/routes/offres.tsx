import { useLoaderData, useSearchParams, type LoaderFunctionArgs } from 'react-router';

import { ACTIONS } from '#/web/acl/actions.server.ts';
import { readCandidate } from '#/web/candidate.server.ts';
import { Detection } from '#/web/components/detection.tsx';
import { FicheDePosteImport } from '#/web/components/fiche-de-poste-import.tsx';
import { filterOffres, OffreFilters } from '#/web/components/offre-filters.tsx';
import { OffreList } from '#/web/components/offre-list.tsx';
import { OffreMap } from '#/web/components/offre-map.tsx';

export async function loader({ request }: LoaderFunctionArgs) {
  const { candidate } = await readCandidate(request);
  return { candidate, offreList: candidate === null ? [] : await ACTIONS.listOffres({ candidateId: candidate.id }) };
}

export function meta() {
  return [{ title: 'Offres · Job Finder' }];
}

export default function Offres() {
  const { candidate, offreList } = useLoaderData<typeof loader>();
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
  const filteredOffreList = filterOffres(offreList, searchParameters);
  return (
    <main className="container page">
      <div className="page__head">
        <h1>Offres de {candidate.name}</h1>
        <Detection />
        <FicheDePosteImport />
        {offreList.length > 0 && <OffreFilters offreList={offreList} />}
      </div>
      {offreList.length > 0 && <OffreMap offreList={filteredOffreList} />}
      {filteredOffreList.length === 0 && offreList.length > 0 ? (
        <p className="empty">Aucune Offre ne répond à ces filtres.</p>
      ) : (
        <OffreList offreList={filteredOffreList} />
      )}
    </main>
  );
}
