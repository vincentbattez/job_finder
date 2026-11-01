// The notifications sent through a Notification Channel, and the failures of the Channels
export const NOTIFICATION_EN = {
  missingJurisdiction: 'Jurisdiction not specified',
  // The Source gives the Deadline as a day, at midnight UTC
  deadline: 'Deadline: {{deadline, datetime(dateStyle: medium; timeZone: UTC)}}',
  noDeadline: 'Deadline: not specified',
  // The Detection Summary: its title and its short message, which fit a phone's notification
  newPostingCount_one: '{{count}} new Posting',
  newPostingCount_other: '{{count}} new Postings',
  postingLine: '• {{title}} — {{jurisdiction}}',
  morePostings_one: '+{{count}} more Posting',
  morePostings_other: '+{{count}} more Postings',
  repostTag: 'Repost',
  repostAppliedTag: 'Repost, already Applied',
  detectionLine: 'Detection of {{startedAt, datetime(dateStyle: short; timeStyle: short; timeZone: Europe/Paris)}}',
  nearMissCount_one: '{{count}} Near Miss',
  nearMissCount_other: '{{count}} Near Misses',
  // Then its sections, which a Channel with room for a page shows in full
  newPostingsHeading_one: 'New Posting',
  newPostingsHeading_other: 'New Postings',
  reference: 'Ref. {{reference}}',
  repostLine: 'Repost of Posting {{repostedReference}}: its Research starts from that of this Posting',
  repostAppliedLine: 'Repost of Posting {{repostedReference}}, Applied: no Research started',
  detectionHeading: 'Detection',
  startedAt: 'Started on {{startedAt, datetime(dateStyle: full; timeStyle: short; timeZone: Europe/Paris)}}',
  originByOrigin: {
    button: 'from the button',
    automation: 'by the daily automation',
    cli: 'by jf detect',
  },
  watchesHeading: 'Watches',
  nearMissesHeading: 'Near Misses',
  testTitle: 'Test notification',
  testMessage: '{{candidateName}}’s Notification Channel works.',
  researchReadyTitle: 'Research ready',
  // The Research the Detection or an extraction queued failed, while no one watched it run
  researchFailedTitle: 'Research failed',
  researchFailedLine: 'Relaunch the Research from the page of Posting {{reference}}.',
  // What the Detection or the worker reports of a notification not sent
  notSent: 'Notification “{{title}}” of Posting {{reference}} not sent: {{reason}}',
  summaryNotSent: 'Detection Summary “{{title}}” not sent: {{reason}}',
  // A label the message quotes
  quote: '“{{text}}”',
  // The contract of the family, whatever the module (ADR-0010)
  incompleteChannel:
    'The {{channelName}} Notification Channel is incomplete: fill in {{labels}} in the Notifications section of the Profile.',
  untestableChannel: 'The {{channelName}} Notification Channel cannot be tried: send a test notification.',
  noChoices: 'The {{parameterLabel}} Parameter of the {{channelName}} Channel has no choices to list.',
  noChannel: 'No Notification Channel for {{candidateName}}: choose one in the Notifications section of their Profile.',
  unknownChannel:
    'Unknown Notification Channel: {{moduleId}}. Choose another one in the Notifications section of the Profile.',
};
