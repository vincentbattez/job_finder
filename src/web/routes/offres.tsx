import { useLoaderData, type LoaderFunctionArgs } from 'react-router';

import { ACTIONS } from '#/web/acl/actions.server.ts';
import { readCandidat } from '#/web/candidat.server.ts';
import { Detection } from '#/web/components/detection.tsx';
import { OffreList } from '#/web/components/offre-list.tsx';

export async function loader({ request }: LoaderFunctionArgs) {
  const { candidat } = await readCandidat(request);
  return { candidat, offreList: candidat === null ? [] : await ACTIONS.listOffres({ candidatId: candidat.id }) };
}

export function meta() {
  return [{ title: 'Offres · Job Finder' }];
}

export default function Offres() {
  const { candidat, offreList } = useLoaderData<typeof loader>();
  if (candidat === null) {
    return (
      <main className="container page">
        <div className="page__head">
          <h1>Qui consulte ses Offres ?</h1>
          <p>Choisissez votre nom dans le menu en haut de la page. Le front s’en souviendra.</p>
        </div>
      </main>
    );
  }
  return (
    <main className="container page">
      <div className="page__head">
        <h1>Offres de {candidat.name}</h1>
        <Detection />
      </div>
      <OffreList offreList={offreList} />
    </main>
  );
}
