import { CheckIcon, RepeatIcon, XIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type { Actions } from '#/actions/index.ts';
import { Button } from '#/web/components/ui/button.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '#/web/components/ui/tooltip.tsx';
import { groupNew, type NewGroupKey } from '#/web/list-model.ts';

import { MapList } from './map-list.tsx';

export type NewItem = Awaited<ReturnType<Actions['listNew']>>[number];
type Row = NewItem['posting'] & { isFound: boolean };

// The color of each group, on its markers, its header and the legend (DESIGN.md « State hues »): the
// blue of what awaits the Candidate for what the last Detection found, then the Deadline's urgency
const TONE_CLASS_BY_GROUP: Record<NewGroupKey, string> = {
  found: 'bg-primary',
  week: 'bg-urgency-week',
  month: 'bg-pending',
  later: 'bg-muted-foreground',
  none: 'bg-step-closed/45',
  passed: 'bg-step-closed/45',
};

export type SortDecision = 'keep' | 'dismiss';

function useShortDate() {
  const { t } = useTranslation('lists');
  return (date: Date, now: Date) =>
    date.getUTCFullYear() === now.getUTCFullYear() ? t('shortDate', { date }) : t('shortDateWithYear', { date });
}

// Dismiss then Keep on a New row (DESIGN.md « Map-first list »): an outline cross and the
// primary check, each named for assistive technologies and in its tooltip
export function SortButtons({ onSort }: Readonly<{ onSort: (decision: SortDecision) => void }>) {
  const { t } = useTranslation('lists');
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon-sm"
            variant="outline"
            aria-label={t('new.dismiss')}
            onClick={() => {
              onSort('dismiss');
            }}
          >
            <XIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('new.dismiss')}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon-sm"
            aria-label={t('new.keep')}
            onClick={() => {
              onSort('keep');
            }}
          >
            <CheckIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('new.keepHint')}</TooltipContent>
      </Tooltip>
    </>
  );
}

// New over the map (spec #125 « Lists »): what the last Detection found first, then by the urgency of the
// Deadline, each row telling its publication date, its Deadline and whether it is a Repost. Its sorting
// comes from its Container, through renderActions.
export function NewList({
  itemList,
  now,
  renderActions,
}: Readonly<{ itemList: NewItem[]; now: Date; renderActions: (row: Row) => ReactNode }>) {
  const { t } = useTranslation('lists');
  const shortDate = useShortDate();
  const rowList: Row[] = itemList.map(({ posting, isFound }) => ({ ...posting, isFound }));
  const groupList = groupNew(rowList, now).map(({ key, itemList: groupItemList }) => ({
    key,
    label: key === 'found' ? t('new.found.label') : t(`deadlineGroup.${key}.label`),
    hint: key === 'found' ? t('new.found.hint') : t(`deadlineGroup.${key}.hint`),
    toneClass: TONE_CLASS_BY_GROUP[key],
    itemList: groupItemList,
  }));
  return (
    <MapList
      label={t('new.heading')}
      groupList={groupList}
      legendList={[
        // Named only while the last Detection's Postings are left to sort
        ...(groupList.some(({ key }) => key === 'found')
          ? [{ label: t('new.legendFound'), toneClass: TONE_CLASS_BY_GROUP.found }]
          : []),
        { label: t('legend.week'), toneClass: TONE_CLASS_BY_GROUP.week },
        { label: t('legend.month'), toneClass: TONE_CLASS_BY_GROUP.month },
        { label: t('legend.later'), toneClass: TONE_CLASS_BY_GROUP.later },
        { label: t('legend.closed'), toneClass: TONE_CLASS_BY_GROUP.passed },
      ]}
      empty={t('new.empty')}
      renderFacts={(row) => (
        <>
          {row.publishedAt !== null && (
            <span className="text-muted-foreground tabular-nums">
              {t('new.published', { date: shortDate(row.publishedAt, now) })}
            </span>
          )}
          {row.deadline !== null && (
            <span className="tabular-nums">{t('new.deadline', { date: shortDate(row.deadline, now) })}</span>
          )}
          {row.repostOf !== null && (
            <span
              title={t('new.repostOf', { reference: row.repostOf.reference })}
              className="inline-flex items-center gap-1 rounded-full border px-1.5 py-px font-medium text-muted-foreground"
            >
              <RepeatIcon aria-hidden className="size-3" />
              {t('new.repost')}
            </span>
          )}
        </>
      )}
      renderActions={renderActions}
    />
  );
}
