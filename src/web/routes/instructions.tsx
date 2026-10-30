import { redirect, useLoaderData, type ActionFunctionArgs, type LoaderFunctionArgs, type MetaArgs } from 'react-router';

import { catalogueOf } from '#/actions/catalogue.ts';
import { ACTIONS } from '#/web/acl/actions.server.ts';
import { readCandidate } from '#/web/candidate.server.ts';
import { useCatalogue } from '#/web/catalogue.ts';
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

export function meta({ loaderData }: MetaArgs<typeof loader>) {
  return [{ title: catalogueOf(loaderData?.candidate).settings.instructions.pageTitle }];
}

export default function Instructions() {
  const { candidate, instructionsList } = useLoaderData<typeof loader>();
  const { instructions: copy } = useCatalogue().settings;
  return (
    <main className="container page">
      {candidate === null ? (
        <div className="page__head">
          <h1>{copy.noCandidateHeading}</h1>
          <p>{copy.noCandidateHint}</p>
        </div>
      ) : (
        <>
          <div className="page__head">
            <h1>{copy.heading(candidate.name)}</h1>
            <p>{copy.intro}</p>
          </div>
          {instructionsList.map((instructions) => (
            <ModuleInstructions
              key={`${instructions.module}-${instructions.candidateInstructions === null ? 'default' : 'candidate'}`}
              {...instructions}
            />
          ))}
        </>
      )}
    </main>
  );
}
