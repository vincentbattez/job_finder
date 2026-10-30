// The Source gives the Deadline as a day, at midnight UTC
const DEADLINE_FORMAT = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' });

const quote = (text: string) => `“${text}”`;

// The notifications sent through a Notification Channel, and the failures of the Channels
export const NOTIFICATION_EN = {
  missingJurisdiction: 'Jurisdiction not specified',
  deadline: (deadline: Date | null) =>
    `Deadline: ${deadline === null ? 'not specified' : DEADLINE_FORMAT.format(deadline)}`,
  newPostingTitle: 'New Posting in the Zone',
  repostTitle: 'Repost in the Zone',
  repostLine: (repostedReference: string) =>
    `Repost of Posting ${repostedReference}: its Research starts from that of this Posting`,
  repostAppliedTitle: 'Repost of an Applied Posting',
  repostAppliedLine: (repostedReference: string) =>
    `Repost of Posting ${repostedReference}, Applied: no Research started`,
  testTitle: 'Test notification',
  testMessage: (candidateName: string) => `${candidateName}’s Notification Channel works.`,
  researchReadyTitle: 'Research ready',
  // What the Detection or the worker reports of a notification not sent
  notSent: (title: string, reference: string, reason: string) =>
    `Notification “${title}” of Posting ${reference} not sent: ${reason}`,
  // The contract of the family, whatever the module (ADR-0010)
  incompleteChannel: (channelName: string, labelList: string[]) =>
    `The ${channelName} Notification Channel is incomplete: fill in ${labelList.map((label) => quote(label)).join(', ')} in the Notifications section of the Profile.`,
  untestableChannel: (channelName: string) =>
    `The ${channelName} Notification Channel cannot be tried: send a test notification.`,
  noChoices: (parameterLabel: string, channelName: string) =>
    `The ${parameterLabel} Parameter of the ${channelName} Channel has no choices to list.`,
  noChannel: (candidateName: string) =>
    `No Notification Channel for ${candidateName}: choose one in the Notifications section of their Profile.`,
  unknownChannel: (moduleId: string) =>
    `Unknown Notification Channel: ${moduleId}. Choose another one in the Notifications section of the Profile.`,
};
