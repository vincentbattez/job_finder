import type { Artifact, Status } from '#/domain/index.ts';

// The Candidates live in France: a date is that of Paris, whatever the locale
const DATE_FORMAT = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'Europe/Paris' });

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
  formatDate: (date: Date) => DATE_FORMAT.format(date),
  // A date the Posting does not give
  missingDate: 'Not specified',
};
