import { useId } from 'react';
import { Form, redirect, useActionData, useLoaderData, type ActionFunctionArgs } from 'react-router';

import { messageOf } from '#/actions/index.ts';
import { ACTIONS } from '#/web/acl/actions.server.ts';

export async function loader() {
  return {
    candidateList: await ACTIONS.listCandidates(),
    delaiParDefaut: await ACTIONS.readDelaiParDefaut(),
    obsoleteConfig: await ACTIONS.findObsoleteConfig(),
  };
}

// Any visitor of the front creates or renames a Candidate and sets the Délai par défaut; no Candidate is
// deleted (ADR-0002, ADR-0011). A refusal goes back to the form it concerns, in the words of the action.
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const [intent, candidateId] = ['intent', 'candidateId'].map((name) => {
    const value = formData.get(name);
    return typeof value === 'string' ? value : null;
  });
  try {
    switch (intent) {
      case 'create': {
        await ACTIONS.createCandidate({ id: formData.get('id'), name: formData.get('name') });
        break;
      }
      case 'rename': {
        await ACTIONS.renameCandidate({ candidateId, name: formData.get('name') });
        break;
      }
      case 'delai-par-defaut': {
        await ACTIONS.saveDelaiParDefaut({ months: formData.get('months') });
        break;
      }
    }
  } catch (error) {
    return { refusal: { intent, candidateId, message: messageOf(error) } };
  }
  return redirect('/candidates');
}

export function meta() {
  return [{ title: 'Candidats · Job Finder' }];
}

function Refusal({ message }: Readonly<{ message: string | undefined }>) {
  return message === undefined ? null : <p role="alert">{message}</p>;
}

export default function Candidates() {
  const { candidateList, delaiParDefaut, obsoleteConfig } = useLoaderData<typeof loader>();
  const refusal = useActionData<typeof action>()?.refusal;
  const refusalOf = (intent: string, candidateId?: string) =>
    refusal?.intent === intent && (candidateId === undefined || refusal.candidateId === candidateId)
      ? refusal.message
      : undefined;
  const listHeadingId = useId();
  const creationHeadingId = useId();
  const delayHeadingId = useId();
  return (
    <main className="container page">
      <div className="page__head">
        <h1>Candidats</h1>
        <p>
          Les personnes qui cherchent un emploi avec l’outil. Chacun règle ses Veilles dans son Profil ; un Candidat ne
          se supprime pas.
        </p>
        {obsoleteConfig.path !== null && (
          <p role="note">
            {obsoleteConfig.path} n’est plus lu : son contenu a été importé ici. Le supprimer du Mac mini.
          </p>
        )}
      </div>
      <section className="settings" aria-labelledby={listHeadingId}>
        <h2 id={listHeadingId}>Renommer un Candidat</h2>
        {candidateList.length === 0 && <p>Aucun Candidat pour l’instant : créez le premier plus bas.</p>}
        {candidateList.map(({ id, name }) => (
          <Form key={`${id}:${name}`} method="post">
            <input type="hidden" name="intent" value="rename" />
            <input type="hidden" name="candidateId" value={id} />
            <label className="settings__field">
              {`Nom de ${id}`}
              <input name="name" required defaultValue={name} placeholder="Léa Martin" />
            </label>
            <div className="settings__step">
              <button type="submit" aria-label={`Renommer ${id}`}>
                Renommer
              </button>
              <Refusal message={refusalOf('rename', id)} />
            </div>
          </Form>
        ))}
      </section>
      <section className="settings" aria-labelledby={creationHeadingId}>
        <h2 id={creationHeadingId}>Nouveau Candidat</h2>
        {/* Remounted once a Candidate is created, so the form starts blank again */}
        <Form key={candidateList.length} method="post">
          <input type="hidden" name="intent" value="create" />
          <label className="settings__field">
            Nom
            <input name="name" required placeholder="Léa" />
          </label>
          <label className="settings__field">
            Identifiant, qui nomme son dossier et ses commandes jf : minuscules, chiffres et tirets
            <input name="id" required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="lea" />
          </label>
          <div className="settings__step">
            <button type="submit" className="button--primary">
              Créer le Candidat
            </button>
            <Refusal message={refusalOf('create')} />
          </div>
        </Form>
      </section>
      <section className="settings" aria-labelledby={delayHeadingId}>
        <h2 id={delayHeadingId}>Délai par défaut</h2>
        <p>Une Offre publiée sans Date limite est Expirée ce nombre de mois après sa publication, pour tous.</p>
        <Form key={delaiParDefaut.months} method="post">
          <input type="hidden" name="intent" value="delai-par-defaut" />
          <label className="settings__field">
            Délai par défaut, en mois
            <input
              name="months"
              type="number"
              min={1}
              step={1}
              required
              defaultValue={delaiParDefaut.months}
              placeholder="6"
            />
          </label>
          <div className="settings__step">
            <button type="submit" className="button--primary">
              Enregistrer le Délai par défaut
            </button>
            <Refusal message={refusalOf('delai-par-defaut')} />
          </div>
        </Form>
      </section>
    </main>
  );
}
