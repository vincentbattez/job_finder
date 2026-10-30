import type { State, Status } from '#/domain/index.ts';

type ContactField = 'applicationEmail' | 'contact1' | 'contact2';

// The Posting page and its parts: the map, the filters, the Status, the Versions, the editor, the
// Repost, the import of a Job Description and the launch of a Detection (#72)
export const POSTING_EN = {
  pageTitle: '{{postingTitle}} · Job Finder',
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
  launchArtifact: 'Run the {{artifactLabel}}',
  relaunchArtifact: 'Run the {{artifactLabel}} again',
  extractionLabel: 'Fields read by Claude',
  relaunchExtraction: 'Run the extraction again',

  // The Versions of an Artifact
  versionNumber: 'v{{versionNumber}}',
  noVersion: 'No Version yet.',
  chosenBadge: 'Chosen',
  versionInstructions: 'Instructions of this Version',
  noFile: 'No file in this Version.',
  visualizationFrameTitle: 'Visualization v{{versionNumber}}',
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
  // Counted by `count`, the new Postings of the Watch
  detectionSummary_zero: 'Watch {{watchId}}: no new Posting',
  detectionSummary_one: 'Watch {{watchId}}: {{count}} new Posting',
  detectionSummary_other: 'Watch {{watchId}}: {{count}} new Postings',
  firstLaunchDetectionSummary_zero:
    'Watch {{watchId}}: no new Posting, first launch: imported without triggering anything',
  firstLaunchDetectionSummary_one:
    'Watch {{watchId}}: {{count}} new Posting, first launch: imported without triggering anything',
  firstLaunchDetectionSummary_other:
    'Watch {{watchId}}: {{count}} new Postings, first launch: imported without triggering anything',
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
  unlocatedPostings_one: '{{count}} Posting without coordinates is not on the map.',
  unlocatedPostings_other: '{{count}} Postings without coordinates are not on the map.',
};
