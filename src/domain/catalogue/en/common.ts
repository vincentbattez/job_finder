import type { Artifact, Locale, Step } from '#/domain/index.ts';

// The copy several screens, the CLI and the messages share, named as GLOSSARY.md names them
export const COMMON_EN = {
  statusLabelByStatus: {
    new: 'New',
    to_apply: 'To Apply',
    applied: 'Applied',
    invited: 'Invited',
    interviewed: 'Interviewed',
    hired: 'Hired',
    rejected: 'Rejected',
  } satisfies Record<Step, string>,
  // A mark beside the Status, which the Posting keeps (ADR-0007)
  archived: 'Archived',
  // A Step beside its Archived mark, which keeps it (ADR-0007)
  stepArchived: '{{stepLabel}} · archived',
  // A mark beside the Status, while the Source no longer publishes the Posting (GLOSSARY.md)
  unpublished: 'Unpublished',
  // Shown in place of To Apply once the Deadline is past (GLOSSARY.md)
  expired: 'Expired',
  artifactLabelByArtifact: {
    research: 'Research',
    letter: 'Letter',
    portrait: 'Portrait',
    interview_brief: 'Interview Brief',
  } satisfies Record<Artifact, string>,
  // The Candidates live in France: a date is that of Paris, whatever the locale
  date: '{{date, datetime(dateStyle: medium; timeZone: Europe/Paris)}}',
  // A date and its time, such as the start of an Interview, in Paris as well
  dateTime: '{{date, datetime(dateStyle: medium; timeStyle: short; timeZone: Europe/Paris)}}',
  // A date the Posting does not give
  missingDate: 'Not specified',
  // The Locale Switcher of the top bar (GLOSSARY.md)
  close: 'Close',
  localeSwitcherLabel: 'Language',
  localeLabelByLocale: {
    fr: 'French',
    en: 'English',
  } satisfies Record<Locale, string>,
};
