import {
  Link,
  redirect,
  useActionData,
  useLoaderData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from 'react-router';

import { messageOf } from '#/actions/index.ts';
import { ACTIONS } from '#/web/acl/actions.server.ts';
import { readCandidat } from '#/web/candidat.server.ts';
import { CanalNotificationForm } from '#/web/components/canal-notification.tsx';
import { CopyCommand } from '#/web/components/copy-command.tsx';
import { FaitsForm } from '#/web/components/faits-form.tsx';
import { Pieces } from '#/web/components/pieces.tsx';
import { ProfilFile, ProfilFileCreation } from '#/web/components/profil-file.tsx';
import { Veilles } from '#/web/components/veilles.tsx';

export async function loader({ request }: LoaderFunctionArgs) {
  const { candidat } = await readCandidat(request);
  return {
    candidat,
    profilFileList: candidat === null ? [] : await ACTIONS.listProfilFiles({ candidatId: candidat.id }),
    pieceList: candidat === null ? [] : await ACTIONS.listPieces({ candidatId: candidat.id }),
    rubriqueList: candidat === null ? [] : await ACTIONS.readFaits({ candidatId: candidat.id }),
    canal: candidat === null ? null : await ACTIONS.readCanalNotification({ candidatId: candidat.id }),
    canalModuleList: await ACTIONS.listCanauxNotification(),
    veilleList: candidat === null ? [] : await ACTIONS.listVeilles({ candidatId: candidat.id }),
    sourceList: await ACTIONS.listSources(),
  };
}

// The Candidat is the one of the menu, never one the form names; a refusal goes back to the file
// it concerns, in the words of the action
export async function action({ request }: ActionFunctionArgs) {
  const { candidat } = await readCandidat(request);
  if (candidat === null) {
    return redirect('/profil');
  }
  const formData = await request.formData();
  const intent = formData.get('intent');
  const fileName = formData.get('fileName');
  const formInput = { candidatId: candidat.id, fileName, markdown: formData.get('markdown') };
  try {
    switch (intent) {
      case 'create': {
        await ACTIONS.createProfilFile(formInput);
        break;
      }
      case 'delete': {
        await ACTIONS.deleteProfilFile(formInput);
        break;
      }
      case 'save': {
        await ACTIONS.saveProfilFile(formInput);
        break;
      }
      case 'piece': {
        // No file at all is refused by the action, like a file that is not a PDF
        const piece = formData.get('piece');
        const file = piece instanceof File ? piece : new File([], '');
        await ACTIONS.savePiece({
          candidatId: candidat.id,
          fileName: file.name,
          content: new Uint8Array(await file.arrayBuffer()),
        });
        break;
      }
      case 'deletePiece': {
        await ACTIONS.deletePiece(formInput);
        break;
      }
      case 'convertPiece': {
        await ACTIONS.convertPiece(formInput);
        break;
      }
      case 'faits': {
        // Each field is named after its rubrique, one per entry of a list rubrique
        const titleList = [...new Set(formData.keys())].filter((name) => name !== 'intent');
        await ACTIONS.saveFaits({
          candidatId: candidat.id,
          entryListByTitle: Object.fromEntries(titleList.map((title) => [title, formData.getAll(title)])),
        });
        break;
      }
    }
  } catch (error) {
    return { refusal: { isCreation: intent === 'create', fileName, message: messageOf(error) } };
  }
  // The Pièces are sent by a fetcher, which revalidates the page by itself and keeps what it receives
  return intent === 'piece' || intent === 'deletePiece' || intent === 'convertPiece'
    ? { refusal: null }
    : redirect('/profil');
}

export function meta() {
  return [{ title: 'Profil · Job Finder' }];
}

export default function Profil() {
  const { candidat, profilFileList, pieceList, rubriqueList, canal, canalModuleList, veilleList, sourceList } =
    useLoaderData<typeof loader>();
  const refusal = useActionData<typeof action>()?.refusal ?? null;
  return (
    <main className="container page">
      {candidat === null ? (
        <div className="page__head">
          <h1>Qui consulte son Profil ?</h1>
          <p>
            Choisissez votre nom dans le menu en haut de la page. Le front s’en souviendra. Pas encore dans le menu ? La
            page <Link to="/candidats">Candidats</Link> vous y ajoute.
          </p>
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
          {/* Keyed by their content, so that a save of one shows in the other */}
          <FaitsForm key={JSON.stringify(rubriqueList)} rubriqueList={rubriqueList} />
          <Pieces pieceList={pieceList} />
          {profilFileList.length === 0 ? (
            <div className="empty">
              <p>
                Votre Profil est vide pour l’instant. Cette commande le remplit avec Claude Code, qui vous interroge :
              </p>
              <CopyCommand command={`jf profil ${candidat.id}`} />
              <p>Vous pouvez aussi créer vos fichiers vous-même, plus bas.</p>
            </div>
          ) : (
            profilFileList.map(({ fileName, markdown }) => (
              <ProfilFile
                key={`${fileName}:${markdown}`}
                fileName={fileName}
                markdown={markdown}
                error={
                  refusal !== null && !refusal.isCreation && refusal.fileName === fileName ? refusal.message : null
                }
              />
            ))
          )}
          {/* Remounted once the files change, so a created file leaves an empty form behind */}
          <ProfilFileCreation
            key={profilFileList.map(({ fileName }) => fileName).join('/')}
            error={refusal?.isCreation === true ? refusal.message : null}
          />
          <Veilles veilleList={veilleList} sourceList={sourceList} />
          {canal !== null && <CanalNotificationForm canal={canal} moduleList={canalModuleList} />}
        </>
      )}
    </main>
  );
}
