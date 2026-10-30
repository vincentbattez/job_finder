// The notifications sent through a Notification Channel, and the failures of the Channels
export const NOTIFICATION_EN = {
  missingJurisdiction: 'Jurisdiction not specified',
  // The Source gives the Deadline as a day, at midnight UTC
  deadline: 'Deadline: {{deadline, datetime(dateStyle: medium; timeZone: UTC)}}',
  noDeadline: 'Deadline: not specified',
  newPostingTitle: 'New Posting in the Zone',
  repostTitle: 'Repost in the Zone',
  repostLine: 'Repost of Posting {{repostedReference}}: its Research starts from that of this Posting',
  repostAppliedTitle: 'Repost of an Applied Posting',
  repostAppliedLine: 'Repost of Posting {{repostedReference}}, Applied: no Research started',
  testTitle: 'Test notification',
  testMessage: '{{candidateName}}’s Notification Channel works.',
  researchReadyTitle: 'Research ready',
  // What the Detection or the worker reports of a notification not sent
  notSent: 'Notification “{{title}}” of Posting {{reference}} not sent: {{reason}}',
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
