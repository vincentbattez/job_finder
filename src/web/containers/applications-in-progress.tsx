import { useTranslation } from 'react-i18next';

import type { Actions } from '#/actions/index.ts';
import { ApplicationList } from '#/web/components/application-list.tsx';
import type { Application } from '#/web/components/application-row.tsx';
import { renderRowOutcomeSelector } from '#/web/containers/outcome-selector.tsx';

// The first ones only, as many as one row of the home holds; /applications lists them all
const SHOWN_APPLICATION_COUNT = 3;

// The page's loader calls it and relays what it gives (ADR-0008). It receives the actions rather than
// importing them, since this file also reaches the browser, which never loads a .server module.
export async function loadApplicationsInProgress(actions: Actions, candidateId: string): Promise<Application[]> {
  const applicationList = await actions.listApplicationsInProgress({ candidateId });
  return applicationList.slice(0, SHOWN_APPLICATION_COUNT);
}

// The top of the home: each row gets its outcome selector, which brings back to the home, JS or not
export function ApplicationsInProgress({ applicationList }: Readonly<{ applicationList: Application[] }>) {
  const { t } = useTranslation('home');
  return (
    <ApplicationList
      heading={t('inProgressHeading')}
      link={{ to: '/applications', label: t('allApplicationsLink') }}
      emptyText={t('noApplicationInProgress')}
      applicationList={applicationList}
      renderOutcomeSelector={renderRowOutcomeSelector('/')}
    />
  );
}
