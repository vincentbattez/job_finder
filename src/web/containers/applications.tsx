import { useTranslation } from 'react-i18next';

import type { Actions } from '#/actions/index.ts';
import { ApplicationList } from '#/web/components/application-list.tsx';
import { renderRowOutcomeSelector } from '#/web/containers/outcome-selector.tsx';

type ApplicationSectionList = Awaited<ReturnType<Actions['listApplications']>>;

// The page's loader calls it and relays what it gives (ADR-0008). It receives the actions rather than
// importing them, since this file also reaches the browser, which never loads a .server module.
export function loadApplications(actions: Actions, candidateId: string): Promise<ApplicationSectionList> {
  return actions.listApplications({ candidateId });
}

// The sections of /applications in their order, each row's outcome selector bringing back to the page
export function Applications({ sectionList }: Readonly<{ sectionList: ApplicationSectionList }>) {
  const { t } = useTranslation('applications');
  return sectionList.map(({ section, applicationList }) => (
    <ApplicationList
      key={section}
      heading={t(`headingBySection.${section}`)}
      emptyText={t(`emptyTextBySection.${section}`)}
      applicationList={applicationList}
      renderOutcomeSelector={renderRowOutcomeSelector('/applications')}
    />
  ));
}
