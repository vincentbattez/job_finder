// The groups of the lists, attention first (spec #125 « Lists »): a Posting joins the first group that
// takes it, and each group has its own order. Days are counted in Paris time, 0 meaning today.

const DAY_MS = 86_400_000;
// A calendar day in France, as « 2026-11-20 »
const PARIS_DAY_FORMAT = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris' });
// The last day of the week group, then of the month group
const WEEK_LAST_DAY = 7;
const MONTH_LAST_DAY = 31;

export type DeadlineGroupKey = 'week' | 'month' | 'later' | 'none' | 'passed';

// In the order the list shows them
const DEADLINE_GROUP_KEY_LIST: DeadlineGroupKey[] = ['week', 'month', 'later', 'none', 'passed'];

interface IDated {
  deadline: Date | null;
  publishedAt: Date | null;
}

export interface IGroup<T> {
  key: DeadlineGroupKey;
  itemList: T[];
}

// A Deadline is a day, stored at midnight UTC; today is the day it is in Paris
export function daysUntil(day: Date, now: Date): number {
  const today = Date.parse(PARIS_DAY_FORMAT.format(now));
  const target = Date.parse(day.toISOString().slice(0, 'YYYY-MM-DD'.length));
  return Math.round((target - today) / DAY_MS);
}

function deadlineGroupOf({ deadline }: IDated, now: Date): DeadlineGroupKey {
  if (deadline === null) {
    return 'none';
  }
  const days = daysUntil(deadline, now);
  if (days < 0) {
    return 'passed';
  }
  if (days <= WEEK_LAST_DAY) {
    return 'week';
  }
  return days <= MONTH_LAST_DAY ? 'month' : 'later';
}

// A missing date sorts last
function byDate(first: Date | null, second: Date | null, direction: 1 | -1): number {
  return first === null || second === null
    ? Number(first === null) - Number(second === null)
    : (first.getTime() - second.getTime()) * direction;
}

const COMPARE_BY_GROUP: Record<DeadlineGroupKey, (first: IDated, second: IDated) => number> = {
  week: (first, second) => byDate(first.deadline, second.deadline, 1),
  month: (first, second) => byDate(first.deadline, second.deadline, 1),
  later: (first, second) => byDate(first.deadline, second.deadline, 1),
  none: (first, second) => byDate(first.publishedAt, second.publishedAt, -1),
  // « Encore possible ? »: the latest passed first
  passed: (first, second) => byDate(first.deadline, second.deadline, -1),
};

// New and To Apply: this week, within the month, later, no Deadline, then passed; empty groups left out
export function groupByDeadline<T extends IDated>(itemList: T[], now: Date): IGroup<T>[] {
  return DEADLINE_GROUP_KEY_LIST.map((key) => ({
    key,
    itemList: itemList.filter((item) => deadlineGroupOf(item, now) === key).toSorted(COMPARE_BY_GROUP[key]),
  })).filter(({ itemList: groupItemList }) => groupItemList.length > 0);
}

export type NewGroupKey = 'found' | DeadlineGroupKey;

// New: what the last Detection found first, by Deadline, then the others as To Apply groups them
// (spec #125 « Lists »)
export function groupNew<T extends IDated & { isFound: boolean }>(
  itemList: T[],
  now: Date,
): { key: NewGroupKey; itemList: T[] }[] {
  const foundList = itemList.filter(({ isFound }) => isFound).toSorted(COMPARE_BY_GROUP.week);
  const groupList = groupByDeadline(
    itemList.filter(({ isFound }) => !isFound),
    now,
  );
  return foundList.length === 0 ? groupList : [{ key: 'found', itemList: foundList }, ...groupList];
}

// The filters common to every list (spec #125 « Lists »): several Cities, one Region, and Archived,
// which shows the list's Archived Postings instead of the followed ones. They live in the URL.
export interface IListFilters {
  cityList: string[];
  region: string | null;
  isArchived: boolean;
}

const CITY_PARAMETER = 'city';
const REGION_PARAMETER = 'region';
// Any value turns it on: « on » is what the former checkbox sent, which saved links still carry
const ARCHIVED_PARAMETER = 'archived';
const ARCHIVED_VALUE = 'on';

export function readListFilters(searchParameters: URLSearchParams): IListFilters {
  const region = searchParameters.get(REGION_PARAMETER) ?? '';
  return {
    cityList: searchParameters.getAll(CITY_PARAMETER).filter((city) => city !== ''),
    region: region === '' ? null : region,
    isArchived: searchParameters.has(ARCHIVED_PARAMETER),
  };
}

// The URL's parameters with these filters, its others kept, such as the open Sheet
export function writeListFilters(searchParameters: URLSearchParams, filters: IListFilters): URLSearchParams {
  const written = new URLSearchParams(searchParameters);
  for (const name of [CITY_PARAMETER, REGION_PARAMETER, ARCHIVED_PARAMETER]) {
    written.delete(name);
  }
  for (const city of filters.cityList) {
    written.append(CITY_PARAMETER, city);
  }
  if (filters.region !== null) {
    written.set(REGION_PARAMETER, filters.region);
  }
  if (filters.isArchived) {
    written.set(ARCHIVED_PARAMETER, ARCHIVED_VALUE);
  }
  return written;
}

interface IPlaced {
  city: string | null;
  region: string | null;
}

// Whether a Posting is in one of the chosen Cities, if any, and in the chosen Region, if any
export function isInPlace({ city, region }: IPlaced, filters: Pick<IListFilters, 'cityList' | 'region'>): boolean {
  return (
    (filters.cityList.length === 0 || (city !== null && filters.cityList.includes(city))) &&
    (filters.region === null || region === filters.region)
  );
}

// Whether a move from one URL to the other changes only the City or the Region: the list filters what it
// holds, without asking the server again
export function isPlaceChangeOnly(currentUrl: URL, nextUrl: URL): boolean {
  const withoutPlace = (url: URL) => {
    const parameters = new URLSearchParams(url.search);
    parameters.delete(CITY_PARAMETER);
    parameters.delete(REGION_PARAMETER);
    return `${url.pathname}?${parameters.toString()}`;
  };
  return currentUrl.search !== nextUrl.search && withoutPlace(currentUrl) === withoutPlace(nextUrl);
}

// The values a filter offers, each with how many Postings hold it, the most frequent first, then
// alphabetically; an unknown value left out
export function tally(valueList: (string | null)[]): { value: string; count: number }[] {
  const countByValue = new Map<string, number>();
  for (const value of valueList) {
    if (value !== null) {
      countByValue.set(value, (countByValue.get(value) ?? 0) + 1);
    }
  }
  return [...countByValue]
    .map(([value, count]) => ({ value, count }))
    .toSorted((first, second) => second.count - first.count || first.value.localeCompare(second.value, 'fr'));
}

// The Applications tabs: Hired and Rejected by their Status, everything else In progress (spec #125)
export type ApplicationTab = 'in_progress' | 'hired' | 'rejected';

export const APPLICATION_TAB_LIST: ApplicationTab[] = ['in_progress', 'hired', 'rejected'];

export type ApplicationGroupKey = 'interviewed' | 'invited' | 'applied' | 'hired' | 'rejected';

interface IApplicationDated {
  step: string;
  status: string;
  deadline: Date | null;
  appliedAt: Date | null;
  nextInterviewAt: Date | null;
  lastInterviewAt: Date | null;
}

type CompareApplications = (first: IApplicationDated, second: IApplicationDated) => number;

// The latest Applied first
const BY_APPLIED_AT: CompareApplications = (first, second) => byDate(first.appliedAt, second.appliedAt, -1);

// The groups of each tab in order, a group being a Step, each with its own sort: In progress puts what
// needs attention first
const APPLICATION_GROUP_LIST_BY_TAB: Record<
  ApplicationTab,
  { key: ApplicationGroupKey; compare: CompareApplications }[]
> = {
  in_progress: [
    { key: 'interviewed', compare: (first, second) => byDate(first.lastInterviewAt, second.lastInterviewAt, -1) },
    { key: 'invited', compare: (first, second) => byDate(first.nextInterviewAt, second.nextInterviewAt, 1) },
    { key: 'applied', compare: (first, second) => byDate(first.deadline, second.deadline, 1) },
  ],
  hired: [{ key: 'hired', compare: BY_APPLIED_AT }],
  rejected: [{ key: 'rejected', compare: BY_APPLIED_AT }],
};

// The tab an Application sits in
function applicationTabOf({ status }: Pick<IApplicationDated, 'status'>): ApplicationTab {
  return status === 'hired' || status === 'rejected' ? status : 'in_progress';
}

// The Applications of a tab by groups; empty groups left out
export function groupApplications<T extends IApplicationDated>(
  itemList: T[],
  tab: ApplicationTab,
): { key: ApplicationGroupKey; itemList: T[] }[] {
  return APPLICATION_GROUP_LIST_BY_TAB[tab]
    .map(({ key, compare }) => ({ key, itemList: itemList.filter(({ step }) => step === key).toSorted(compare) }))
    .filter(({ itemList: groupItemList }) => groupItemList.length > 0);
}

export function countByApplicationTab(itemList: Pick<IApplicationDated, 'status'>[]): Record<ApplicationTab, number> {
  const countOf = (tab: ApplicationTab) => itemList.filter((item) => applicationTabOf(item) === tab).length;
  return { in_progress: countOf('in_progress'), hired: countOf('hired'), rejected: countOf('rejected') };
}
