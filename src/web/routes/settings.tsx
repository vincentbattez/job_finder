import { useTranslation } from 'react-i18next';
import { useLoaderData, type ActionFunctionArgs, type LoaderFunctionArgs, type MetaArgs } from 'react-router';

import { localeOf, tFor } from '#/actions/i18n.ts';
import { codedError } from '#/actions/index.ts';
import { ACTIONS } from '#/web/acl/actions.server.ts';
import { readCandidate } from '#/web/candidate.server.ts';
import { PageHeader } from '#/web/components/page-header.tsx';
import { Candidates } from '#/web/containers/candidates.tsx';
import { DefaultDeadlinePeriod } from '#/web/containers/default-deadline-period.tsx';
import { InstructionsSection } from '#/web/containers/instructions.tsx';
import { NotificationChannelForm } from '#/web/containers/notification-channel.tsx';
import { translateParameters } from '#/web/parameters.server.ts';
import { relayAction, relayLoader } from '#/web/relay-action.server.ts';

export function loader({ request }: LoaderFunctionArgs) {
  return relayLoader(request, async () => {
    const { candidate, locale } = await readCandidate(request);
    return {
      // meta runs outside React: it translates in the locale the loader gives it (ADR-0012)
      locale,
      channel: candidate === null ? null : await ACTIONS.readNotificationChannel({ candidateId: candidate.id }),
      instructionsList: candidate === null ? [] : await ACTIONS.listInstructions({ candidateId: candidate.id }),
      channelModuleList: translateParameters(await ACTIONS.listNotificationChannels(), locale),
      candidateList: await ACTIONS.listCandidates(),
      defaultDeadlinePeriod: await ACTIONS.readDefaultDeadlinePeriod(),
      obsoleteConfig: await ACTIONS.findObsoleteConfig(),
    };
  });
}

// The operator's forms post here through their fetchers: any visitor of the front creates or renames a
// Candidate and sets the Default Deadline Period; no Candidate is deleted (ADR-0002, ADR-0011). The
// Instructions editor posts here too, from the Settings and from the generation panel, for the Candidate
// of the menu, never one the form names. A refusal goes back to its fetcher's toast, in the words of the action.
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  return relayAction(request, async () => {
    switch (formData.get('intent')) {
      case 'save-instructions': {
        const { candidate } = await readCandidate(request);
        await ACTIONS.saveInstructions({
          candidateId: candidate?.id,
          module: formData.get('module'),
          instructions: formData.get('instructions'),
        });
        return null;
      }
      case 'restore-instructions': {
        const { candidate } = await readCandidate(request);
        await ACTIONS.deleteInstructions({ candidateId: candidate?.id, module: formData.get('module') });
        return null;
      }
      case 'create': {
        await ACTIONS.createCandidate({ id: formData.get('id'), name: formData.get('name') });
        return null;
      }
      case 'rename': {
        await ACTIONS.renameCandidate({ candidateId: formData.get('candidateId'), name: formData.get('name') });
        return null;
      }
      case 'default-deadline-period': {
        await ACTIONS.saveDefaultDeadlinePeriod({ months: formData.get('months') });
        return null;
      }
    }
    const { locale } = await readCandidate(request);
    throw codedError('unknown_intent', {}, { locale });
  });
}

export function meta({ loaderData }: MetaArgs<typeof loader>) {
  return [{ title: tFor(localeOf(loaderData), 'settings')('settingsPage.pageTitle') }];
}

// The Settings (spec #125 « Profile, Watches, Settings »): plain forms, the Candidate's Notification
// Channel and Instructions first, the latter with the generation panel's editor, then what the operator
// sets for every Candidate.
export default function Settings() {
  const { channel, instructionsList, channelModuleList, candidateList, defaultDeadlinePeriod, obsoleteConfig } =
    useLoaderData<typeof loader>();
  const { t } = useTranslation('settings');
  return (
    <main>
      <PageHeader title={t('settingsPage.heading')} description={t('settingsPage.description')} />
      <div className="mx-auto grid max-w-3xl gap-6 px-4 pt-6 pb-24 sm:px-6 lg:px-8">
        {channel !== null && <NotificationChannelForm channel={channel} moduleList={channelModuleList} />}
        {instructionsList.length > 0 && <InstructionsSection instructionsList={instructionsList} />}
        <Candidates candidateList={candidateList} obsoleteConfigPath={obsoleteConfig.path} />
        <DefaultDeadlinePeriod months={defaultDeadlinePeriod.months} />
      </div>
    </main>
  );
}
