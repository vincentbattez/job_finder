// PROTOTYPE (branch prototype/v1-ux, never merged). What the three lists (New, To Apply,
// Applications) compute from the Postings, apart from how a variant lays them out: which Postings a
// list shows, its filters, its order, its groups (variant C) and the tone of each Step.
import {
  applicationTabOf,
  daysUntil,
  listOf,
  nextInterviewOf,
  type IPosting,
  type ListName,
  type Step,
} from '../model.ts';

export type ApplicationTab = 'in_progress' | 'hired' | 'rejected';

export const APPLICATION_TAB_LIST: { key: ApplicationTab; label: string }[] = [
  { key: 'in_progress', label: 'En cours' },
  { key: 'hired', label: 'Poste obtenu' },
  { key: 'rejected', label: 'Refusées' },
];

export function parseApplicationTab(value: string | null): ApplicationTab {
  return APPLICATION_TAB_LIST.find(({ key }) => key === value)?.key ?? 'in_progress';
}

export interface IListFilters {
  cityList: string[];
  region: string | null;
  isArchived: boolean;
}

export const EMPTY_FILTERS: IListFilters = { cityList: [], region: null, isArchived: false };

export function hasFilters({ cityList, region, isArchived }: IListFilters): boolean {
  return cityList.length > 0 || region !== null || isArchived;
}

// The Postings of a list (and of its tab), Archived or not, before the City and Region filters
export function postingsOfList(
  postings: IPosting[],
  list: ListName,
  tab: ApplicationTab,
  isArchived: boolean,
): IPosting[] {
  return postings.filter(
    (posting) =>
      listOf(posting) === list &&
      (list !== 'applications' || applicationTabOf(posting) === tab) &&
      (posting.archivedAt !== null) === isArchived,
  );
}

export function applyFilters(postings: IPosting[], { cityList, region }: IListFilters): IPosting[] {
  return postings.filter(
    (posting) =>
      (cityList.length === 0 || (posting.city !== null && cityList.includes(posting.city))) &&
      (region === null || posting.region === region),
  );
}

// The values a filter offers, with how many Postings each holds, the most frequent first
export function countBy(postings: IPosting[], key: 'city' | 'region'): { value: string; count: number }[] {
  const countByValue = new Map<string, number>();
  for (const posting of postings) {
    const value = posting[key];
    if (value !== null) {
      countByValue.set(value, (countByValue.get(value) ?? 0) + 1);
    }
  }
  return [...countByValue]
    .map(([value, count]) => ({ value, count }))
    .toSorted((first, second) => second.count - first.count || first.value.localeCompare(second.value, 'fr'));
}

function byDate(first: string | null, second: string | null, direction: 1 | -1): number {
  if (first === second) {
    return 0;
  }
  if (first === null) {
    return 1;
  }
  if (second === null) {
    return -1;
  }
  return first.localeCompare(second) * direction;
}

// New: the latest found first (a Detection's on top); To Apply: the closest Deadline first, the
// passed ones last; Applications: the latest Applied first
export function sortPostings(list: ListName, postings: IPosting[], now: Date = new Date()): IPosting[] {
  if (list === 'new') {
    return postings.toSorted(
      (first, second) =>
        Number(second.isSynthetic) - Number(first.isSynthetic) || byDate(first.publishedAt, second.publishedAt, -1),
    );
  }
  if (list === 'to_apply') {
    const isPassed = (posting: IPosting) => posting.deadline !== null && daysUntil(posting.deadline, now) < 0;
    return postings.toSorted(
      (first, second) =>
        Number(isPassed(first)) - Number(isPassed(second)) || byDate(first.deadline, second.deadline, 1),
    );
  }
  return postings.toSorted((first, second) => byDate(first.appliedAt, second.appliedAt, -1));
}

// ——— Groups (variant C): the order of work rather than a flat list ———

export interface IPostingGroup {
  key: string;
  label: string;
  hint: string;
  postings: IPosting[];
}

interface IGroupRule {
  key: string;
  label: string;
  hint: string;
  isIn: (posting: IPosting, now: Date) => boolean;
}

const daysSince = (iso: string | null, now: Date) => (iso === null ? Infinity : -daysUntil(iso, now));
const daysLeft = (iso: string | null, now: Date) => (iso === null ? null : daysUntil(iso, now));

const GROUP_RULE_BY_LIST: Record<ListName, IGroupRule[]> = {
  new: [
    { key: 'found', label: 'Trouvées à l’instant', hint: 'Dernière Détection', isIn: (posting) => posting.isSynthetic },
    {
      key: 'week',
      label: 'Cette semaine',
      hint: 'Publiées depuis 7 jours',
      isIn: (posting, now) => daysSince(posting.publishedAt, now) <= 7,
    },
    {
      key: 'month',
      label: 'Ce mois-ci',
      hint: 'Publiées depuis 31 jours',
      isIn: (posting, now) => daysSince(posting.publishedAt, now) <= 31,
    },
    { key: 'older', label: 'Plus anciennes', hint: 'À trier sans tarder', isIn: () => true },
  ],
  to_apply: [
    {
      key: 'week',
      label: 'Date limite cette semaine',
      hint: 'Moins de 7 jours',
      isIn: (posting, now) => {
        const days = daysLeft(posting.deadline, now);
        return days !== null && days >= 0 && days <= 7;
      },
    },
    {
      key: 'month',
      label: 'Dans le mois',
      hint: '8 à 31 jours',
      isIn: (posting, now) => {
        const days = daysLeft(posting.deadline, now);
        return days !== null && days >= 0 && days <= 31;
      },
    },
    {
      key: 'later',
      label: 'Plus tard',
      hint: 'Au-delà d’un mois',
      isIn: (posting, now) => (daysLeft(posting.deadline, now) ?? -1) > 31,
    },
    { key: 'none', label: 'Sans date limite', hint: '', isIn: (posting) => posting.deadline === null },
    { key: 'passed', label: 'Date limite passée', hint: 'Encore possible ?', isIn: () => true },
  ],
  applications: [
    {
      key: 'invited',
      label: 'Convoquée',
      hint: 'Un entretien à venir',
      isIn: (posting) => posting.step === 'invited',
    },
    {
      key: 'interviewed',
      label: 'Entretien passé',
      hint: 'En attente de réponse',
      isIn: (posting) => posting.step === 'interviewed',
    },
    { key: 'applied', label: 'Postulée', hint: 'Sans nouvelles', isIn: (posting) => posting.step === 'applied' },
    { key: 'hired', label: 'Poste obtenu', hint: '', isIn: (posting) => posting.step === 'hired' },
    { key: 'rejected', label: 'Refusée', hint: '', isIn: () => true },
  ],
};

export function groupPostings(list: ListName, postings: IPosting[], now: Date = new Date()): IPostingGroup[] {
  const groupList = GROUP_RULE_BY_LIST[list].map(({ key, label, hint }) => ({
    key,
    label,
    hint,
    postings: [] as IPosting[],
  }));
  for (const posting of postings) {
    const index = GROUP_RULE_BY_LIST[list].findIndex(({ isIn }) => isIn(posting, now));
    groupList[index]?.postings.push(posting);
  }
  return groupList.filter((group) => group.postings.length > 0);
}

// ——— Tones: one color per Step, the same on the badges and the map ———

export const STEP_TONE: Record<Step, { dot: string; badge: string }> = {
  new: { dot: 'bg-primary', badge: 'bg-primary/10 text-primary' },
  to_apply: { dot: 'bg-amber-500', badge: 'bg-amber-500/12 text-amber-700 dark:text-amber-300' },
  applied: { dot: 'bg-sky-500', badge: 'bg-sky-500/12 text-sky-700 dark:text-sky-300' },
  invited: { dot: 'bg-violet-500', badge: 'bg-violet-500/12 text-violet-700 dark:text-violet-300' },
  interviewed: { dot: 'bg-indigo-500', badge: 'bg-indigo-500/12 text-indigo-700 dark:text-indigo-300' },
  hired: { dot: 'bg-emerald-500', badge: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300' },
  rejected: { dot: 'bg-zinc-500', badge: 'bg-muted text-muted-foreground' },
};

// How pressing a Deadline is: passed, within 7 days, within a month, later
export type Urgency = 'passed' | 'soon' | 'month' | 'later' | 'none';

export function urgencyOf(deadline: string | null, now: Date = new Date()): Urgency {
  if (deadline === null) {
    return 'none';
  }
  const days = daysUntil(deadline, now);
  if (days < 0) {
    return 'passed';
  }
  if (days <= 7) {
    return 'soon';
  }
  return days <= 31 ? 'month' : 'later';
}

export const URGENCY_TONE: Record<Urgency, { dot: string; text: string; label: string }> = {
  soon: { dot: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400', label: '7 jours ou moins' },
  month: { dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400', label: 'Dans le mois' },
  later: { dot: 'bg-emerald-500', text: 'text-muted-foreground', label: 'Plus tard' },
  none: { dot: 'bg-zinc-400', text: 'text-muted-foreground', label: 'Sans date' },
  passed: { dot: 'bg-zinc-400', text: 'text-muted-foreground line-through', label: 'Passée' },
};

// ——— Formatting ———

const SHORT_DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' });
const SHORT_DATE_YEAR = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Europe/Paris',
});
const YEAR = new Intl.DateTimeFormat('fr-FR', { year: 'numeric', timeZone: 'Europe/Paris' });

// « 20 nov. », with the year when it is not this one: « 31 déc. 2025 »
export function formatShortDate(iso: string | null, now: Date = new Date()): string {
  if (iso === null) {
    return '—';
  }
  const date = new Date(iso);
  return YEAR.format(date) === YEAR.format(now) ? SHORT_DATE.format(date) : SHORT_DATE_YEAR.format(date);
}

// « 3e publication », « 2e »
export function ordinal(number: number): string {
  return number === 1 ? '1re' : `${String(number)}e`;
}

// The next Interview of an Application, null when it has none to come
export function upcomingInterviewOf(posting: IPosting, now: Date = new Date()) {
  const interview = nextInterviewOf(posting.interviews, now);
  return interview !== null && new Date(interview.startAt) > now ? interview : null;
}

// The titles of the snapshot all start alike (« Attaché(e) de justice - … »): what follows says more
export function distinctivePartOf(title: string): string {
  const match = /^attach[ée](?:\(e\)|\.e|e)?\s+de\s+justice\s*[-–:,]?\s*/iu.exec(title);
  const rest = match === null ? title : title.slice(match[0].length);
  return rest.trim() === '' ? title : rest.charAt(0).toUpperCase() + rest.slice(1);
}
