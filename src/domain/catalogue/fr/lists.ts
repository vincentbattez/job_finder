import type { LISTS_EN } from '#/domain/catalogue/en/lists.ts';

export const LISTS_FR: typeof LISTS_EN = {
  toApply: {
    pageTitle: 'À traiter · Job Finder',
    heading: 'À traiter',
    empty: 'Rien à traiter pour l’instant. Les Offres que tu gardes arrivent ici.',
  },
  count: '{{label}} · {{count}}',
  fold: 'Replier la liste',
  showOnMap: 'Voir sur la carte',
  mapLabel: 'Carte des Offres',
  legendLabel: 'Légende',
  unlocated_one: '{{count}} Offre sans lieu connu',
  unlocated_other: '{{count}} Offres sans lieu connu',
  unknownCity: 'Lieu inconnu',
  deadlineGroup: {
    week: { label: 'Cette semaine', hint: '7 jours ou moins' },
    month: { label: 'Dans le mois', hint: '8 à 31 jours' },
    later: { label: 'Plus tard', hint: 'Au-delà d’un mois' },
    none: { label: 'Sans date limite', hint: 'Les plus récentes d’abord' },
    passed: { label: 'Encore possible ?', hint: 'Date limite passée' },
  },
  legend: {
    week: 'Cette semaine',
    month: 'Dans le mois',
    later: 'Plus tard',
    closed: 'Sans date ou passée',
  },
  shortDate: '{{date, datetime(day: numeric; month: short; timeZone: Europe/Paris)}}',
  shortDateWithYear: '{{date, datetime(day: numeric; month: short; year: numeric; timeZone: Europe/Paris)}}',
  countdown: {
    today: 'aujourd’hui',
    future_one: 'dans {{count}} j',
    future_other: 'dans {{count}} j',
    past_one: 'il y a {{count}} j',
    past_other: 'il y a {{count}} j',
  },
  startDate: 'Prise de poste {{date}}',
  chip: { research: 'R', letter: 'LM' },
  validationOf: {
    research: 'Recherche : {{state}}',
    letter: 'Lettre de motivation : {{state}}',
  },
  validation: { none: 'pas encore', draft: 'Brouillon', validated: 'Validée' },
};
