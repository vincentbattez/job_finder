import { useTranslation } from 'react-i18next';
import {
  Form,
  redirect,
  useActionData,
  useLoaderData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaArgs,
} from 'react-router';

import { localeOf, tFor } from '#/actions/i18n.ts';
import { messageOf } from '#/actions/index.ts';
import { ACTIONS } from '#/web/acl/actions.server.ts';
import { readCandidate } from '#/web/candidate.server.ts';
import { SettingsPanel, SettingsStep } from '#/web/components/settings-panel.tsx';

export async function loader({ request }: LoaderFunctionArgs) {
  const { candidate, locale } = await readCandidate(request);
  return {
    candidate,
    locale,
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
  return [{ title: tFor(localeOf(loaderData), 'settings')('candidates.pageTitle') }];
}

function Refusal({ message }: Readonly<{ message: string | undefined }>) {
  return message === undefined ? null : <p role="alert">{message}</p>;
}

export default function Candidates() {
  const { candidateList, defaultDeadlinePeriod, obsoleteConfig } = useLoaderData<typeof loader>();
  const refusal = useActionData<typeof action>()?.refusal;
  const { t } = useTranslation('settings');
  const refusalOf = (intent: string, candidateId?: string) =>
    refusal?.intent === intent && (candidateId === undefined || refusal.candidateId === candidateId)
      ? refusal.message
      : undefined;
  return (
    <main className="container page">
      <div className="page__head">
        <h1>{t('candidates.heading')}</h1>
        <p>{t('candidates.intro')}</p>
        {obsoleteConfig.path !== null && (
          <p role="note">{t('candidates.obsoleteConfig', { path: obsoleteConfig.path })}</p>
        )}
      </div>
      <SettingsPanel heading={t('candidates.renameHeading')}>
        {candidateList.length === 0 && <p>{t('candidates.noCandidate')}</p>}
        {candidateList.map(({ id, name }) => (
          <Form key={`${id}:${name}`} method="post">
            <input type="hidden" name="intent" value="rename" />
            <input type="hidden" name="candidateId" value={id} />
            <label className="field">
              {t('candidates.nameOf', { candidateId: id })}
              <input name="name" required defaultValue={name} placeholder={t('candidates.fullNamePlaceholder')} />
            </label>
            <SettingsStep>
              <button className="button" type="submit" aria-label={t('candidates.renameOf', { candidateId: id })}>
                {t('candidates.rename')}
              </button>
              <Refusal message={refusalOf('rename', id)} />
            </SettingsStep>
          </Form>
        ))}
      </SettingsPanel>
      <SettingsPanel heading={t('candidates.creationHeading')}>
        {/* Remounted once a Candidate is created, so the form starts blank again */}
        <Form key={candidateList.length} method="post">
          <input type="hidden" name="intent" value="create" />
          <label className="field">
            {t('candidates.name')}
            <input name="name" required placeholder={t('candidates.namePlaceholder')} />
          </label>
          <label className="field">
            {t('candidates.id')}
            <input name="id" required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder={t('candidates.idPlaceholder')} />
          </label>
          <SettingsStep>
            <button type="submit" className="button button--primary">
              {t('candidates.create')}
            </button>
            <Refusal message={refusalOf('create')} />
          </SettingsStep>
        </Form>
      </SettingsPanel>
      <SettingsPanel heading={t('candidates.defaultDeadlinePeriodHeading')}>
        <p>{t('candidates.defaultDeadlinePeriodHint')}</p>
        <Form key={defaultDeadlinePeriod.months} method="post">
          <input type="hidden" name="intent" value="default-deadline-period" />
          <label className="field">
            {t('candidates.defaultDeadlinePeriodMonths')}
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
          <SettingsStep>
            <button type="submit" className="button button--primary">
              {t('candidates.saveDefaultDeadlinePeriod')}
            </button>
            <Refusal message={refusalOf('default-deadline-period')} />
          </SettingsStep>
        </Form>
      </SettingsPanel>
    </main>
  );
}
