import { redirect, useLoaderData, type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router';

import { ACTIONS } from '#/web/acl/actions.server.ts';
import { readCandidate } from '#/web/candidate.server.ts';
import { ModuleInstructions } from '#/web/components/module-instructions.tsx';

export async function loader({ request }: LoaderFunctionArgs) {
  const { candidate } = await readCandidate(request);
  return {
    candidate,
    instructionsList: candidate === null ? [] : await ACTIONS.listInstructions({ candidateId: candidate.id }),
  };
}

// The Candidate is the one of the menu, never one the form names
export async function action({ request }: ActionFunctionArgs) {
  const { candidate } = await readCandidate(request);
  if (candidate === null) {
    return redirect('/instructions');
  }
  const formData = await request.formData();
  const module = formData.get('module');
  if (formData.get('intent') === 'delete') {
    await ACTIONS.deleteInstructions({ candidateId: candidate.id, module });
  } else {
    await ACTIONS.saveInstructions({ candidateId: candidate.id, module, instructions: formData.get('instructions') });
  }
  return redirect('/instructions');
}

export function meta() {
  return [{ title: 'Consignes · Job Finder' }];
}

export default function Instructions() {
  const { candidate, instructionsList } = useLoaderData<typeof loader>();
  return (
    <main className="container page">
      {candidate === null ? (
        <div className="page__head">
          <h1>Qui consulte ses Consignes ?</h1>
          <p>Choisissez votre nom dans le menu en haut de la page. Le front s’en souviendra.</p>
        </div>
      ) : (
        <>
          <div className="page__head">
            <h1>Consignes de {candidate.name}</h1>
            <p>
              Les Consignes disent à chaque module comment produire son Artefact. Les vôtres remplacent celles par
              défaut pour ses prochaines Versions. Ses règles fixes, comme ne jamais inventer un fait, s’appliquent
              toujours.
            </p>
          </div>
          {instructionsList.map((instructions) => (
            <ModuleInstructions
              key={`${instructions.module}-${instructions.candidateInstructions === null ? 'defaut' : 'candidate'}`}
              {...instructions}
            />
          ))}
        </>
      )}
    </main>
  );
}
