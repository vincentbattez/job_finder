import { redirect, useLoaderData, type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router';

import { ACTIONS } from '#/web/acl/actions.server.ts';
import { readCandidat } from '#/web/candidat.server.ts';
import { ModuleConsignes } from '#/web/components/module-consignes.tsx';

export async function loader({ request }: LoaderFunctionArgs) {
  const { candidat } = await readCandidat(request);
  return { candidat, consignesList: candidat === null ? [] : await ACTIONS.listConsignes({ candidatId: candidat.id }) };
}

// The Candidat is the one of the menu, never one the form names
export async function action({ request }: ActionFunctionArgs) {
  const { candidat } = await readCandidat(request);
  if (candidat === null) {
    return redirect('/consignes');
  }
  const formData = await request.formData();
  const module = formData.get('module');
  if (formData.get('intent') === 'delete') {
    await ACTIONS.deleteConsignes({ candidatId: candidat.id, module });
    return { isSaved: true };
  }
  await ACTIONS.saveConsignes({ candidatId: candidat.id, module, consignes: formData.get('consignes') });
  return { isSaved: true };
}

export function meta() {
  return [{ title: 'Consignes · Job Finder' }];
}

export default function Consignes() {
  const { candidat, consignesList } = useLoaderData<typeof loader>();
  return (
    <main className="container page">
      {candidat === null ? (
        <div className="page__head">
          <h1>Qui consulte ses Consignes ?</h1>
          <p>Choisissez votre nom dans le menu en haut de la page. Le front s’en souviendra.</p>
        </div>
      ) : (
        <>
          <div className="page__head">
            <h1>Consignes de {candidat.name}</h1>
            <p>
              Les Consignes disent à chaque module comment produire son Artefact. Les vôtres remplacent celles par
              défaut pour ses prochaines Versions. Ses règles fixes, comme ne jamais inventer un fait, s’appliquent
              toujours.
            </p>
          </div>
          {consignesList.map((consignes) => (
            <ModuleConsignes key={consignes.module} {...consignes} />
          ))}
        </>
      )}
    </main>
  );
}
