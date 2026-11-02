import { cn } from 'cn';
import { CheckIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { Actions } from '#/actions/index.ts';
import { daysUntil, groupByDeadline, type DeadlineGroupKey } from '#/web/list-model.ts';

import { MapList, type IMapListFiltering, type ISheetSelection } from './map-list.tsx';

// The color of each Deadline group, the same on its markers, its header and the legend (DESIGN.md
// « State hues »): red within the week, amber within the month, then neutral, faded once none or passed
const TONE_CLASS_BY_GROUP: Record<DeadlineGroupKey, string> = {
  week: 'bg-urgency-week',
  month: 'bg-pending',
  later: 'bg-muted-foreground',
  none: 'bg-step-closed/45',
  passed: 'bg-step-closed/45',
};

const COUNTDOWN_CLASS_BY_GROUP: Record<DeadlineGroupKey, string> = {
  week: 'font-medium text-urgency-week-foreground',
  month: 'text-pending-foreground',
  later: 'text-muted-foreground',
  none: 'text-muted-foreground',
  passed: 'text-muted-foreground',
};

const CHIP_CLASS_BY_VALIDATION: Record<Validation, string> = {
  none: 'border-dashed text-muted-foreground',
  draft: 'border-draft/40 bg-draft/10 text-draft-foreground',
  validated: 'border-validated/40 bg-validated/10 text-validated-foreground',
};

type ListItem = Awaited<ReturnType<Actions['listToApply']>>[number];
type Validation = ListItem['research'];

function useShortDate() {
  const { t } = useTranslation('lists');
  return (date: Date, now: Date) =>
    date.getUTCFullYear() === now.getUTCFullYear() ? t('shortDate', { date }) : t('shortDateWithYear', { date });
}

function Countdown({ deadline, group, now }: Readonly<{ deadline: Date; group: DeadlineGroupKey; now: Date }>) {
  const { t } = useTranslation('lists');
  const days = daysUntil(deadline, now);
  let text = t('countdown.today');
  if (days > 0) {
    text = t('countdown.future', { count: days });
  } else if (days < 0) {
    text = t('countdown.past', { count: -days });
  }
  return <span className={cn('tabular-nums', COUNTDOWN_CLASS_BY_GROUP[group])}>{text}</span>;
}

// « R » or « LM », its state told by its tint and in full to assistive technologies
function ValidationChip({
  artifact,
  validation,
}: Readonly<{ artifact: 'research' | 'letter'; validation: Validation }>) {
  const { t } = useTranslation('lists');
  const fullLabel = t(`validationOf.${artifact}`, { state: t(`validation.${validation}`) });
  return (
    <span
      role="img"
      aria-label={fullLabel}
      title={fullLabel}
      className={cn(
        'relative z-[1] inline-flex h-5 items-center gap-1 rounded-full border px-1.5 text-label font-medium',
        CHIP_CLASS_BY_VALIDATION[validation],
      )}
    >
      {validation === 'validated' && <CheckIcon aria-hidden className="size-3" />}
      {validation === 'draft' && <span aria-hidden className="size-1.5 rounded-full bg-draft" />}
      {t(`chip.${artifact}`)}
    </span>
  );
}

function MarkBadge({ children }: Readonly<{ children: string }>) {
  return (
    <span className="rounded-full bg-step-closed/12 px-1.5 py-px text-label font-medium text-step-closed-foreground">
      {children}
    </span>
  );
}

// To Apply over the map (spec #125 « Lists »): grouped by the urgency of the Deadline, each row telling
// its Deadline and countdown, its Start Date, and where its Research and Letter stand
export function ToApplyList({
  itemList,
  now,
  filtering,
  selectedReference,
  onSelect,
}: Readonly<{ itemList: ListItem[]; now: Date; filtering?: IMapListFiltering | undefined } & ISheetSelection>) {
  type Row = ListItem['posting'] & { research: Validation; letter: Validation };
  const { t } = useTranslation('lists');
  const shortDate = useShortDate();
  const rowList: Row[] = itemList.map(({ posting, research, letter }) => ({ ...posting, research, letter }));
  const groupList = groupByDeadline(rowList, now).map(({ key, itemList: groupItemList }) => ({
    key,
    label: t(`deadlineGroup.${key}.label`),
    hint: t(`deadlineGroup.${key}.hint`),
    toneClass: TONE_CLASS_BY_GROUP[key],
    itemList: groupItemList,
  }));
  const groupByReference = new Map(
    groupList.flatMap(({ key, itemList: groupItemList }) => groupItemList.map(({ reference }) => [reference, key])),
  );
  return (
    <MapList
      label={t('toApply.heading')}
      groupList={groupList}
      legendList={[
        { label: t('legend.week'), toneClass: TONE_CLASS_BY_GROUP.week },
        { label: t('legend.month'), toneClass: TONE_CLASS_BY_GROUP.month },
        { label: t('legend.later'), toneClass: TONE_CLASS_BY_GROUP.later },
        { label: t('legend.closed'), toneClass: TONE_CLASS_BY_GROUP.passed },
      ]}
      empty={t('toApply.empty')}
      filtering={filtering}
      selectedReference={selectedReference}
      onSelect={onSelect}
      renderFacts={(row) => (
        <>
          {row.deadline !== null && (
            <span className="flex items-baseline gap-1.5">
              <span className="tabular-nums">{shortDate(row.deadline, now)}</span>
              <Countdown deadline={row.deadline} group={groupByReference.get(row.reference) ?? 'none'} now={now} />
            </span>
          )}
          {row.startDate !== null && (
            <span className="text-muted-foreground">{t('startDate', { date: shortDate(row.startDate, now) })}</span>
          )}
          <span className="flex items-center gap-1">
            <ValidationChip artifact="research" validation={row.research} />
            <ValidationChip artifact="letter" validation={row.letter} />
          </span>
          {row.isExpired && <MarkBadge>{t('expired', { ns: 'common' })}</MarkBadge>}
          {row.unpublishedAt !== null && <MarkBadge>{t('unpublished', { ns: 'common' })}</MarkBadge>}
        </>
      )}
    />
  );
}
