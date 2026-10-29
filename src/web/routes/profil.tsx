import { redirect, useLoaderData, type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router';

import { ACTIONS } from '#/web/acl/actions.server.ts';
import { readCandidat } from '#/web/candidat.server.ts';
import { CopyCommand } from '#/web/components/copy-command.tsx';
import { ProfilFile } from '#/web/components/profil-file.tsx';

export async function loader({ request }: LoaderFunctionArgs) {
  const { candidat } = await readCandidat(request);
  return {
    candidat,
    profilFileList: candidat === null ? [] : await ACTIONS.listProfilFiles({ candidatId: candidat.id }),
  };
}

// The Candidat is the one of the menu, never one the form names
export async function action({ request }: ActionFunctionArgs) {
  const { candidat } = await readCandidat(request);
  if (candidat === null) {
    return redirect('/profil');
  }
  const formData = await request.formData();
  const fileName = formData.get('fileName');
  await ACTIONS.saveProfilFile({ candidatId: candidat.id, fileName, markdown: formData.get('markdown') });
  return { isSaved: true };
}

export function meta() {
  return [{ title: 'Profil · Job Finder' }];
}

export default function Profil() {
  const { candidat, profilFileList } = useLoaderData<typeof loader>();
  return (
    <main className="container page">
      {candidat === null ? (
        <div className="page__head">
          <h1>Qui consulte son Profil ?</h1>
          <p>Choisissez votre nom dans le menu en haut de la page. Le front s’en souviendra.</p>
        </div>
      ) : (
        <>
          <div className="page__head">
            <h1>Profil de {candidat.name}</h1>
            <p>
              Ce que l’outil sait de vous pour écrire à votre place : vos faits validés, votre CV et vos lettres
              passées.
            </p>
          </div>
          {profilFileList.length === 0 ? (
            <div className="empty">
              <p>
                Votre Profil est vide pour l’instant. Cette commande le remplit avec Claude Code, qui vous interroge :
              </p>
              <CopyCommand command={`jf profil ${candidat.id}`} />
            </div>
          ) : (
            profilFileList.map(({ fileName, markdown }) => (
              <ProfilFile key={fileName} fileName={fileName} markdown={markdown} />
            ))
          )}
        </>
      )}
    </main>
  );
}
