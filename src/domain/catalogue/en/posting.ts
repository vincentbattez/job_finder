import type { State, Status } from '#/domain/index.ts';

type ContactField = 'applicationEmail' | 'contact1' | 'contact2';

function countNewPostings(count: number): string {
  if (count === 0) {
    return 'no new Posting';
  }
  return count === 1 ? '1 new Posting' : `${String(count)} new Postings`;
}

// The Posting page and its parts: the map, the filters, the Status, the Versions, the editor, the
// Repost, the import of a Job Description and the launch of a Detection (#72)
export const POSTING_EN = {
  pageTitle: (postingTitle: string) => `${postingTitle} · Job Finder`,
  // The page title when the Posting could not be read
  unreadPosting: 'Posting',
  stateLabelByState: {
    absent: 'Absent',
    in_progress: 'In progress',
    ready: 'Ready',
    failed: 'Failed',
  } satisfies Record<State, string>,

  // The facts and parts of the Posting
  referenceTerm: 'Reference',
  publishedAtTerm: 'Published',
  deadlineTerm: 'Deadline',
  repostOfTerm: 'Repost of',
  repostedAsTerm: 'Reposted as',
  artifactsHeading: 'Artifacts',
  contactsHeading: 'Contacts',
  contactLabelByField: {
    applicationEmail: 'Application email',
    contact1: 'Contact 1',
    contact2: 'Contact 2',
  } satisfies Record<ContactField, string>,
  missingContact: 'Not specified',
  recipientsHeading: 'Recommended recipients',
  noRecipients: 'The Letter recommends them, once written.',
  jobDescriptionHeading: 'Job Description',
  readJobDescription: 'Read the Job Description',

  // What the Chosen Letter recommends
  recipientTerm: 'Recipient',
  noRecipientAddress: 'No address in the Posting',
  ccTerm: 'Cc',
  noCc: 'None',
  salutationTerm: 'Salutation',

  // The Status buttons
  statusButtonLabelByStatus: {
    to_apply: 'Back to To Apply',
    applied: 'Mark as Applied',
    archived: 'Archive',
  } satisfies Record<Status, string>,
  confirmApplied: 'Confirm: Applied',
  cancel: 'Cancel',
  appliedFreezesLetter: 'Once Applied, the Chosen Letter no longer changes: it is the one sent.',

  // The launch of a module or of the extraction
  launchArtifact: (artifactLabel: string) => `Run the ${artifactLabel}`,
  relaunchArtifact: (artifactLabel: string) => `Run the ${artifactLabel} again`,
  extractionLabel: 'Fields read by Claude',
  relaunchExtraction: 'Run the extraction again',

  // The Versions of an Artifact
  versionNumber: (versionNumber: number) => `v${String(versionNumber)}`,
  noVersion: 'No Version yet.',
  chosenBadge: 'Chosen',
  versionInstructions: 'Instructions of this Version',
  candidateInstructions: 'Candidate’s Instructions',
  defaultInstructions: 'Default Instructions',
  noFile: 'No file in this Version.',
  visualizationFrameTitle: (versionNumber: number) => `Visualization v${String(versionNumber)}`,
  chooseVersion: 'Choose this Version',

  // The editor of a file of the Chosen Version
  documentLabel: 'Markdown',
  documentPlaceholder: '# Title\n\nThe text of the document, in Markdown',
  save: 'Save',
  unsavedChanges: 'Unsaved changes',
  preview: 'Preview',
  copy: 'Copy',
  copiedCommand: 'Copied',
  copyMarkdown: 'Copy the Markdown',
  copiedMarkdown: 'Copied',

  // The tools of the Posting list: the Detection, the import, the filters and the map
  runDetection: 'Run a Detection',
  detectionRunning: 'Detection running…',
  detectionSummary: (watchId: string, newPostingCount: number, isFirstLaunch: boolean) => {
    const found = countNewPostings(newPostingCount);
    const summary = isFirstLaunch ? `${found}, first launch: imported without triggering anything` : found;
    return `Watch ${watchId}: ${summary}`;
  },
  importIntro: 'Drop here a Job Description in Markdown found elsewhere: it becomes one of your Postings.',
  importLabel: 'Import a Job Description',
  importedPosting: 'Posting imported:',
  importedPostingNext: 'The worker reads its fields with Claude, then runs its Research.',
  filtersLabel: 'Filters',
  cityFilter: 'City',
  regionFilter: 'Region',
  allChoices: 'All',
  showArchived: 'Show the Archived',
  filter: 'Filter',
  mapLabel: 'Map of the Postings',
  unlocatedPostings: (count: number) =>
    count === 1
      ? '1 Posting without coordinates is not on the map.'
      : `${String(count)} Postings without coordinates are not on the map.`,
};
