// PROTOTYPE (branch prototype/v1-ux, never merged). What the three lists (New, To Apply,
// Applications) compute from the Postings, apart from how a variant lays them out: which Postings a
// list shows, its filters, its order, its groups (variant C) and the tone of each Step.
import {
  applicationTabOf,
  daysUntil,
  listOf,
  nextInterviewOf,
  STEP_LABEL,
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

// ——— Groups (variants B and C): attention first, each group in its own order ———

export interface IPostingGroup {
  key: string;
  label: string;
  hint: string;
  postings: IPosting[];
}

type Compare = (first: IPosting, second: IPosting) => number;

interface IGroupRule {
  key: string;
  label: string;
  hint: string;
  isIn: (posting: IPosting, now: Date) => boolean;
  compare: Compare;
}

const daysLeft = (iso: string | null, now: Date) => (iso === null ? null : daysUntil(iso, now));
const byDeadline: Compare = (first, second) => byDate(first.deadline, second.deadline, 1);
const byDeadlineLatest: Compare = (first, second) => byDate(first.deadline, second.deadline, -1);
const byPublished: Compare = (first, second) => byDate(first.publishedAt, second.publishedAt, -1);
const byApplied: Compare = (first, second) => byDate(first.appliedAt, second.appliedAt, -1);
const firstInterviewAt = (posting: IPosting, now: Date) => upcomingInterviewOf(posting, now)?.startAt ?? null;
const lastInterviewAt = (posting: IPosting) =>
  posting.interviews
    .map(({ startAt }) => startAt)
    .toSorted()
    .at(-1) ?? null;

// The Deadline groups of New and To Apply: this week, this month, later, none, passed
function deadlineRuleList(): IGroupRule[] {
  const isWithin = (posting: IPosting, now: Date, from: number, to: number) => {
    const days = daysLeft(posting.deadline, now);
    return days !== null && days >= from && days <= to;
  };
  return [
    {
      key: 'week',
      label: 'Date limite cette semaine',
      hint: '7 jours ou moins',
      isIn: (posting, now) => isWithin(posting, now, 0, 7),
      compare: byDeadline,
    },
    {
      key: 'month',
      label: 'Dans le mois',
      hint: '8 à 31 jours',
      isIn: (posting, now) => isWithin(posting, now, 8, 31),
      compare: byDeadline,
    },
    {
      key: 'later',
      label: 'Plus tard',
      hint: 'Au-delà d’un mois',
      isIn: (posting, now) => (daysLeft(posting.deadline, now) ?? -1) > 31,
      compare: byDeadline,
    },
    {
      key: 'none',
      label: 'Sans date limite',
      hint: '',
      isIn: (posting) => posting.deadline === null,
      compare: byPublished,
    },
    {
      key: 'passed',
      label: 'Date limite passée',
      hint: 'Encore possible ?',
      isIn: () => true,
      compare: byDeadlineLatest,
    },
  ];
}

function groupRulesOf(list: ListName, now: Date): IGroupRule[] {
  if (list === 'new') {
    return [
      {
        key: 'found',
        label: 'Trouvées à l’instant',
        hint: 'Dernière Détection',
        isIn: (posting) => posting.isSynthetic,
        compare: byDeadline,
      },
      ...deadlineRuleList(),
    ];
  }
  if (list === 'to_apply') {
    return deadlineRuleList();
  }
  return [
    {
      key: 'interviewed',
      label: 'Entretien passé',
      hint: 'En attente de réponse',
      isIn: (posting) => posting.step === 'interviewed',
      compare: (first, second) => byDate(lastInterviewAt(first), lastInterviewAt(second), -1),
    },
    {
      key: 'invited',
      label: 'Convoquée',
      hint: 'Un entretien à venir',
      isIn: (posting) => posting.step === 'invited',
      compare: (first, second) => byDate(firstInterviewAt(first, now), firstInterviewAt(second, now), 1),
    },
    {
      key: 'applied',
      label: 'Postulée',
      hint: 'Date limite la plus proche d’abord',
      isIn: (posting) => posting.step === 'applied',
      compare: byDeadline,
    },
    { key: 'hired', label: 'Poste obtenu', hint: '', isIn: (posting) => posting.step === 'hired', compare: byApplied },
    { key: 'rejected', label: 'Refusée', hint: '', isIn: () => true, compare: byApplied },
  ];
}

export function groupPostings(list: ListName, postings: IPosting[], now: Date = new Date()): IPostingGroup[] {
  const ruleList = groupRulesOf(list, now);
  const groupList = ruleList.map(({ key, label, hint }) => ({ key, label, hint, postings: [] as IPosting[] }));
  for (const posting of postings) {
    const index = ruleList.findIndex(({ isIn }) => isIn(posting, now));
    groupList[index]?.postings.push(posting);
  }
  return groupList
    .map((group, index) => ({ ...group, postings: group.postings.toSorted(ruleList[index]?.compare) }))
    .filter((group) => group.postings.length > 0);
}

// The group a Posting falls in, for the color of its point
export function groupKeyOf(list: ListName, posting: IPosting, now: Date = new Date()): string {
  return groupPostings(list, [posting], now)[0]?.key ?? '';
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

// ——— Map tones: the groups of the list as colors (variants B and C) ———

const DEADLINE_GROUP_DOT: Record<string, string> = {
  found: 'bg-primary',
  week: URGENCY_TONE.soon.dot,
  month: URGENCY_TONE.month.dot,
  later: URGENCY_TONE.later.dot,
  none: 'bg-zinc-400',
  passed: 'bg-zinc-400',
};

export function mapToneOf(list: ListName): (posting: IPosting) => string {
  if (list === 'applications') {
    return (posting) => STEP_TONE[posting.step].dot;
  }
  return (posting) => DEADLINE_GROUP_DOT[groupKeyOf(list, posting)] ?? 'bg-zinc-400';
}

export function mapLegendOf(list: ListName): { dot: string; label: string }[] {
  if (list === 'applications') {
    return (['interviewed', 'invited', 'applied', 'hired', 'rejected'] as const).map((step) => ({
      dot: STEP_TONE[step].dot,
      label: STEP_LABEL[step],
    }));
  }
  return [
    ...(list === 'new' ? [{ dot: 'bg-primary', label: 'Trouvées à l’instant' }] : []),
    { dot: URGENCY_TONE.soon.dot, label: '7 jours ou moins' },
    { dot: URGENCY_TONE.month.dot, label: 'Dans le mois' },
    { dot: URGENCY_TONE.later.dot, label: 'Plus tard' },
    { dot: 'bg-zinc-400', label: 'Passée ou sans date' },
  ];
}

// ——— Regions: their extent [[south, west], [north, east]], for the map to show a whole Region ———

export const REGION_BOUNDS: Record<string, [[number, number], [number, number]]> = {
  'Auvergne-Rhône-Alpes': [
    [44.11, 2.06],
    [46.81, 7.19],
  ],
  'Bourgogne-Franche-Comté': [
    [46.15, 2.85],
    [48.4, 7.15],
  ],
  Bretagne: [
    [47.28, -5.14],
    [48.9, -1.01],
  ],
  'Centre-Val de Loire': [
    [46.35, 0.05],
    [48.94, 3.13],
  ],
  Corse: [
    [41.33, 8.53],
    [43.03, 9.56],
  ],
  'Grand Est': [
    [47.42, 3.38],
    [50.17, 8.24],
  ],
  'Hauts-de-France': [
    [48.83, 1.38],
    [51.09, 4.26],
  ],
  'Île-de-France': [
    [48.12, 1.44],
    [49.24, 3.56],
  ],
  Normandie: [
    [48.18, -1.95],
    [50.07, 1.8],
  ],
  'Nouvelle-Aquitaine': [
    [42.78, -1.79],
    [47.18, 2.61],
  ],
  Occitanie: [
    [42.33, -0.33],
    [45.05, 4.85],
  ],
  'Pays de la Loire': [
    [46.27, -2.56],
    [48.57, 0.92],
  ],
  "Provence-Alpes-Côte d'Azur": [
    [42.98, 4.23],
    [45.13, 7.72],
  ],
  Guadeloupe: [
    [15.83, -61.81],
    [16.52, -61.0],
  ],
  Martinique: [
    [14.39, -61.23],
    [14.88, -60.81],
  ],
  Guyane: [
    [2.11, -54.6],
    [5.75, -51.6],
  ],
  'La Réunion': [
    [-21.39, 55.21],
    [-20.87, 55.84],
  ],
  Mayotte: [
    [-13.0, 45.01],
    [-12.63, 45.3],
  ],
  'Nouvelle-Calédonie': [
    [-22.7, 163.5],
    [-19.5, 168.2],
  ],
};

// A Region's extent, with the typographic apostrophe or not
export function regionBoundsOf(region: string | null) {
  return region === null ? undefined : REGION_BOUNDS[region.replaceAll('’', "'")];
}
