// The lists over the map: To Apply for now, New and Applications next (spec #125 « Lists »)
export const LISTS_EN = {
  toApply: {
    pageTitle: 'To Apply · Job Finder',
    heading: 'To Apply',
    empty: 'Nothing to apply to for now. The Postings you keep land here.',
  },
  count: '{{label}} · {{count}}',
  fold: 'Fold the list',
  showOnMap: 'Show on the map',
  mapLabel: 'Map of the Postings',
  legendLabel: 'Legend',
  unlocated_one: '{{count}} Posting without a known place',
  unlocated_other: '{{count}} Postings without a known place',
  unknownCity: 'Unknown place',
  deadlineGroup: {
    week: { label: 'This week', hint: '7 days or less' },
    month: { label: 'Within the month', hint: '8 to 31 days' },
    later: { label: 'Later', hint: 'Beyond a month' },
    none: { label: 'No Deadline', hint: 'Latest published first' },
    passed: { label: 'Still possible?', hint: 'Deadline passed' },
  },
  legend: {
    week: 'This week',
    month: 'Within the month',
    later: 'Later',
    closed: 'No Deadline or passed',
  },
  // A day without its year when it is this year's, « Nov 20 », else with it
  shortDate: '{{date, datetime(day: numeric; month: short; timeZone: Europe/Paris)}}',
  shortDateWithYear: '{{date, datetime(day: numeric; month: short; year: numeric; timeZone: Europe/Paris)}}',
  countdown: {
    today: 'today',
    future_one: 'in {{count}} d',
    future_other: 'in {{count}} d',
    past_one: '{{count}} d ago',
    past_other: '{{count}} d ago',
  },
  startDate: 'Starts {{date}}',
  // The Research and the Letter of a row, as a short chip and its full state
  chip: { research: 'R', letter: 'L' },
  validationOf: {
    research: 'Research: {{state}}',
    letter: 'Letter: {{state}}',
  },
  validation: { none: 'none yet', draft: 'Draft', validated: 'Validated' },
};
