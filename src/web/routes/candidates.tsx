import { useId } from 'react';
import {
  Form,
  redirect,
  useActionData,
  useLoaderData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaArgs,
} from 'react-router';

import { catalogueOf } from '#/actions/catalogue.ts';
import { messageOf } from '#/actions/index.ts';
import { ACTIONS } from '#/web/acl/actions.server.ts';
import { readCandidate } from '#/web/candidate.server.ts';
import { useCatalogue } from '#/web/catalogue.ts';

export async function loader({ request }: LoaderFunctionArgs) {
  const { candidate } = await readCandidate(request);
  return {
    candidate,
    candidateList: await ACTIONS.listCandidates(),
    defaultDeadlinePeriod: await ACTIONS.readDefaultDeadlinePeriod(),
    obsoleteConfig: await ACTIONS.findObsoleteConfig(),
  };
}

// Any visitor of the front creates or renames a Candidate and sets the Default Deadline Period; no Candidate is
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
      case 'default-deadline-period': {
        await ACTIONS.saveDefaultDeadlinePeriod({ months: formData.get('months') });
        break;
      }
    }
  } catch (error) {
    return { refusal: { intent, candidateId, message: messageOf(error) } };
  }
  return redirect('/candidates');
}

export function meta({ loaderData }: MetaArgs<typeof loader>) {
  return [{ title: catalogueOf(loaderData?.candidate).settings.candidates.pageTitle }];
}

function Refusal({ message }: Readonly<{ message: string | undefined }>) {
  return message === undefined ? null : <p role="alert">{message}</p>;
}

export default function Candidates() {
  const { candidateList, defaultDeadlinePeriod, obsoleteConfig } = useLoaderData<typeof loader>();
  const refusal = useActionData<typeof action>()?.refusal;
  const { candidates } = useCatalogue().settings;
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
        <h1>{candidates.heading}</h1>
        <p>{candidates.intro}</p>
        {obsoleteConfig.path !== null && <p role="note">{candidates.obsoleteConfig(obsoleteConfig.path)}</p>}
      </div>
      <section className="settings" aria-labelledby={listHeadingId}>
        <h2 id={listHeadingId}>{candidates.renameHeading}</h2>
        {candidateList.length === 0 && <p>{candidates.noCandidate}</p>}
        {candidateList.map(({ id, name }) => (
          <Form key={`${id}:${name}`} method="post">
            <input type="hidden" name="intent" value="rename" />
            <input type="hidden" name="candidateId" value={id} />
            <label className="settings__field">
              {candidates.nameOf(id)}
              <input name="name" required defaultValue={name} placeholder={candidates.fullNamePlaceholder} />
            </label>
            <div className="settings__step">
              <button type="submit" aria-label={candidates.renameOf(id)}>
                {candidates.rename}
              </button>
              <Refusal message={refusalOf('rename', id)} />
            </div>
          </Form>
        ))}
      </section>
      <section className="settings" aria-labelledby={creationHeadingId}>
        <h2 id={creationHeadingId}>{candidates.creationHeading}</h2>
        {/* Remounted once a Candidate is created, so the form starts blank again */}
        <Form key={candidateList.length} method="post">
          <input type="hidden" name="intent" value="create" />
          <label className="settings__field">
            {candidates.name}
            <input name="name" required placeholder={candidates.namePlaceholder} />
          </label>
          <label className="settings__field">
            {candidates.id}
            <input name="id" required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder={candidates.idPlaceholder} />
          </label>
          <div className="settings__step">
            <button type="submit" className="button--primary">
              {candidates.create}
            </button>
            <Refusal message={refusalOf('create')} />
          </div>
        </Form>
      </section>
      <section className="settings" aria-labelledby={delayHeadingId}>
        <h2 id={delayHeadingId}>{candidates.defaultDeadlinePeriodHeading}</h2>
        <p>{candidates.defaultDeadlinePeriodHint}</p>
        <Form key={defaultDeadlinePeriod.months} method="post">
          <input type="hidden" name="intent" value="default-deadline-period" />
          <label className="settings__field">
            {candidates.defaultDeadlinePeriodMonths}
            <input
              name="months"
              type="number"
              min={1}
              step={1}
              required
              defaultValue={defaultDeadlinePeriod.months}
              placeholder="6"
            />
          </label>
          <div className="settings__step">
            <button type="submit" className="button--primary">
              {candidates.saveDefaultDeadlinePeriod}
            </button>
            <Refusal message={refusalOf('default-deadline-period')} />
          </div>
        </Form>
      </section>
    </main>
  );
}
