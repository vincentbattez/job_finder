import type { Artifact, Locale, Status } from '#/domain/index.ts';

// The copy several screens, the CLI and the messages share, named as GLOSSARY.md names them
export const COMMON_EN = {
  statusLabelByStatus: {
    to_apply: 'To Apply',
    applied: 'Applied',
    archived: 'Archived',
  } satisfies Record<Status, string>,
  // Shown in place of To Apply once the Deadline is past (GLOSSARY.md)
  expired: 'Expired',
  artifactLabelByArtifact: {
    research: 'Research',
    letter: 'Letter',
    interview_brief: 'Interview Brief',
    visualization: 'Visualization',
  } satisfies Record<Artifact, string>,
  // The Candidates live in France: a date is that of Paris, whatever the locale
  date: '{{date, datetime(dateStyle: medium; timeZone: Europe/Paris)}}',
  // A date the Posting does not give
  missingDate: 'Not specified',
  // The Locale Switcher of the top bar (GLOSSARY.md)
  localeSwitcherLabel: 'Language',
  localeLabelByLocale: {
    fr: 'French',
    en: 'English',
  } satisfies Record<Locale, string>,
};
