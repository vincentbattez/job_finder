import { CalendarIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { Actions } from '#/actions/index.ts';
import { Tabs, TabsList, TabsTrigger } from '#/web/components/ui/tabs.tsx';
import {
  APPLICATION_TAB_LIST,
  countByApplicationTab,
  groupApplications,
  type ApplicationGroupKey,
  type ApplicationTab,
} from '#/web/list-model.ts';

import { MapList, type IMapListFiltering, type ISheetSelection } from './map-list.tsx';
import { StepBadge } from './step-badge.tsx';

// One color per Step, the same on the markers, the group headers, the legend and the Step badges
// (spec #125 « Lists », DESIGN.md « State hues »)
const TONE_CLASS_BY_GROUP: Record<ApplicationGroupKey, string> = {
  interviewed: 'bg-step-interviewed',
  invited: 'bg-step-invited',
  applied: 'bg-step-applied',
  hired: 'bg-validated',
  rejected: 'bg-step-closed',
};

// The groups a tab may show, which its legend names
const GROUP_KEY_LIST_BY_TAB: Record<ApplicationTab, ApplicationGroupKey[]> = {
  in_progress: ['interviewed', 'invited', 'applied'],
  hired: ['hired'],
  rejected: ['rejected'],
};

type Application = Awaited<ReturnType<Actions['listApplications']>>[number];

function ApplicationTabs({
  tab,
  countByTab,
  onTabChange,
}: Readonly<{ tab: ApplicationTab; countByTab: Record<ApplicationTab, number>; onTabChange: (tab: string) => void }>) {
  const { t } = useTranslation('lists');
  return (
    <Tabs value={tab} onValueChange={onTabChange}>
      <TabsList aria-label={t('applications.tabsLabel')} className="w-full">
        {APPLICATION_TAB_LIST.map((value) => (
          <TabsTrigger key={value} value={value} className="gap-1.5 text-label">
            {t(`applications.tab.${value}`)}
            <span className="text-muted-foreground tabular-nums">{countByTab[value]}</span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

// Applications over the map (spec #125 « Lists »): In progress, Hired and Rejected tabs, In progress
// grouped by Step, what needs attention first; each row tells its Step, its next Interview and the day
// it was Applied
export function ApplicationsList({
  itemList,
  tab,
  onTabChange,
  now,
  filtering,
  selectedReference,
  onSelect,
}: Readonly<
  {
    itemList: Application[];
    tab: ApplicationTab;
    onTabChange: (tab: string) => void;
    now: Date;
    filtering?: IMapListFiltering | undefined;
  } & ISheetSelection
>) {
  const { t } = useTranslation('lists');
  const rowList = itemList.map(({ posting, nextInterviewAt, lastInterviewAt }) => ({
    ...posting,
    nextInterviewAt,
    lastInterviewAt,
  }));
  const shortDate = (date: Date) =>
    date.getUTCFullYear() === now.getUTCFullYear() ? t('shortDate', { date }) : t('shortDateWithYear', { date });
  const groupList = groupApplications(rowList, tab).map(({ key, itemList: groupItemList }) => ({
    key,
    label: t(`applications.group.${key}.label`),
    hint: t(`applications.group.${key}.hint`),
    toneClass: TONE_CLASS_BY_GROUP[key],
    itemList: groupItemList,
  }));
  return (
    <MapList
      label={t('applications.heading')}
      groupList={groupList}
      legendList={GROUP_KEY_LIST_BY_TAB[tab].map((key) => ({
        label: t(`applications.group.${key}.label`),
        toneClass: TONE_CLASS_BY_GROUP[key],
      }))}
      controls={<ApplicationTabs tab={tab} countByTab={countByApplicationTab(rowList)} onTabChange={onTabChange} />}
      empty={t(`applications.empty.${tab}`)}
      filtering={filtering}
      selectedReference={selectedReference}
      onSelect={onSelect}
      renderFacts={(row) => (
        <>
          <StepBadge step={row.step} isArchived={row.archivedAt !== null} />
          {row.nextInterviewAt !== null && (
            <span className="flex items-center gap-1 font-medium text-step-invited-foreground tabular-nums">
              <CalendarIcon aria-hidden className="size-3" />
              {t('applications.nextInterview', { date: t('shortDateTime', { date: row.nextInterviewAt }) })}
            </span>
          )}
          {row.appliedAt !== null && (
            <span className="text-muted-foreground tabular-nums">
              {t('applications.appliedOn', { date: shortDate(row.appliedAt) })}
            </span>
          )}
        </>
      )}
    />
  );
}
