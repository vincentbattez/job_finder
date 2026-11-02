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
    queued: 'Queued',
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

  // The outcome selector: Applied on a To Apply Posting, then the outcomes of its Application
  markApplied: 'Mark as Applied',
  outcomeLabel: 'Outcome of the Application',
  outcomeLabelByStatus: {
    hired: 'Hired',
    rejected: 'Rejected',
  } satisfies Record<Exclude<Status, 'to_apply' | 'applied'>, string>,
  backInProgress: 'Put back in progress',
  // The Archived mark, beside the outcome selector (ADR-0007)
  archive: 'Archive',
  unarchive: 'Unarchive',
  confirmApplied: 'Confirm: Applied',
  cancel: 'Cancel',
  appliedFreezesLetter: 'Once Applied, the Chosen Letter no longer changes: it is the one sent.',
  // Applied undone on an Application In progress whose Letter was never sent
  markNotSent: 'Not sent yet',
  confirmToApply: 'Confirm: To Apply',
  toApplyFreesLetter: 'The Posting goes back to To Apply and its Chosen Letter can change again.',

  // The launch of a module or of the extraction
  // The context is the Artifact: French names some of them in the masculine, such as the Portrait
  launchArtifact: 'Run the {{artifactLabel}}',
  relaunchArtifact: 'Run the {{artifactLabel}} again',
  launchArtifact_portrait: 'Run the {{artifactLabel}}',
  relaunchArtifact_portrait: 'Run the {{artifactLabel}} again',
  extractionLabel: 'Fields read by Claude',
  relaunchExtraction: 'Run the extraction again',

  // The Versions of an Artifact
  versionNumber: 'v{{versionNumber}}',
  noVersion: 'No Version yet.',
  chosenBadge: 'Chosen',
  versionInstructions: 'Instructions of this Version',
  noFile: 'No file in this Version.',
  chooseVersion: 'Choose this Version',

  // The Prompt a run started now would receive, beside the title of its Artifact
  prompt: {
    toggle: 'Prompt',
    fixedPart: 'Fixed Part',
    instructions: 'Instructions',
    readVersions: 'Artifacts this Prompt reads',
    noReadVersion: 'None: it reads only the Job Description and, for some, the Profile.',
    readVersion: '{{reference}} · {{artifactLabel}} v{{versionNumber}}',
    readVersionOfInterview: '{{reference}} · Interview {{interviewNumber}} · {{artifactLabel}} v{{versionNumber}}',
  },

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

  // The Notes of the Posting, whatever its Status
  notes: {
    heading: 'Notes',
    label: 'Notes in Markdown',
    placeholder:
      '# Call to the department\n\nWhat you learn about this Posting: a call, the feedback from an interview…',
    save: 'Save the Notes',
  },

  // The Interviews of an Application, one per round, by date
  interviews: {
    heading: 'Interviews',
    applyFirst: 'An Interview belongs to an Application: mark the Posting Applied to add one.',
    noInterview: 'No Interview yet.',
    title: 'Interview {{number}}',
    start: 'Start',
    duration: 'Duration (minutes)',
    minutes: '{{minutes}} min',
    place: 'Place',
    interviewers: 'Interviewers',
    interviewersPlaceholder: 'Name, role, what you know about them',
    startPlaceholder: '2026-11-19T14:00',
    placePlaceholder: 'Room 3 of the court, or by video',
    newInterview: 'New Interview',
    add: 'Add the Interview',
    edit: 'Edit Interview {{number}}',
    save: 'Save the Interview',
    delete: 'Delete Interview {{number}}',
    deleteForGood: 'Delete Interview {{number}} for good',
    ical: 'Add to calendar (iCal)',
    next: 'Next Interview',
    last: 'Last Interview',
    count_one: '{{count}} Interview',
    count_other: '{{count}} Interviews',
  },

  // An Application row, on the home and on /applications
  applicationRow: {
    lastChangeAt: 'Last change',
    notesExcerpt: 'Notes',
  },

  // The iCal file of an Interview: the event in the calendar and the links its description gives
  ical: {
    summary: 'Interview · {{title}} · {{employer}}',
    summaryWithoutEmployer: 'Interview · {{title}}',
    officialAd: 'Official ad',
    postingPage: 'Job Finder page',
    link: '{{label}}: {{url}}',
  },

  // The tools of the Posting list: the Detection, the import, the filters and the map
  // The Detection beside the name of the list: the last one, then its progress while one runs (#63)
  detection: {
    run: 'Run a Detection',
    runAgain: 'Run it again',
    starting: 'Starting the Detection…',
    runningHeading: 'Detection in progress',
    // How long the running Detection has taken so far
    elapsed: '{{minutes}} min {{seconds}} s elapsed',
    elapsedHours: '{{hours}} h {{minutes}} min elapsed',
    // Another Candidate’s Detection holds the lock: one at a time
    otherCandidate: 'A Detection is searching the Watches of another Candidate: run yours once it is over.',
    stepByStep: {
      waiting: 'Waiting for its turn',
      searching: 'Searching the Source',
      reading: 'Reading the Job Descriptions',
      notifying: 'Sending the notifications',
      done: 'Done',
    },
    readCount: '{{readCount}} / {{readTotal}}',
    // The polite live region: the run, its key steps and the verdict, without the counters
    announceRunning: 'Detection in progress: {{step}}',
    never: 'Last Detection: never run. Your Postings appear here once one has gone through.',
    lastHeading: 'Last Detection',
    // When it ended: relative, then absolute, in the time of Paris
    when: '{{relative}} · {{date, datetime(weekday: long; day: numeric; month: long; hour: 2-digit; minute: 2-digit; timeZone: Europe/Paris)}}',
    originByOrigin: {
      button: 'started from the button',
      automation: 'started by the daily automation',
      cli: 'started by jf detect',
    },
    failedHeading: 'The Detection failed',
    nothingNewHeading: 'No new Posting',
    newHeading_one: '{{count}} new Posting',
    newHeading_other: '{{count}} new Postings',
    firstLaunchHeading_one: '{{count}} Posting imported',
    firstLaunchHeading_other: '{{count}} Postings imported',
    // One line per Watch, named by its label
    nothingNew_zero: '{{label}}: the Source listed no Posting.',
    nothingNew_one: '{{label}}: the Source listed {{count}} Posting, already known.',
    nothingNew_other: '{{label}}: the Source listed {{count}} Postings, all already known.',
    newPostings_one: '{{label}}: {{count}} new Posting.',
    newPostings_other: '{{label}}: {{count}} new Postings.',
    firstLaunch_zero: '{{label}}: first launch, nothing to import.',
    firstLaunch_one: '{{label}}: first launch, {{count}} Posting imported, no Research or notification started.',
    firstLaunch_other: '{{label}}: first launch, {{count}} Postings imported, no Research or notification started.',
    notReached: '{{label}}: not reached before the failure.',
    failedWatch_zero:
      '{{label}}: stopped at “{{step}}”, Job Descriptions read: {{readCount}}. No new Posting saved before.',
    failedWatch_one:
      '{{label}}: stopped at “{{step}}”, Job Descriptions read: {{readCount}}. {{count}} new Posting saved before.',
    failedWatch_other:
      '{{label}}: stopped at “{{step}}”, Job Descriptions read: {{readCount}}. {{count}} new Postings saved before.',
    seeNewPostings: 'See them in the list, marked “New”',
    nearMissSummary_one: '{{count}} title narrowly left out',
    nearMissSummary_other: '{{count}} titles narrowly left out',
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
  unlocatedPostings_one: '{{count}} Posting without coordinates is not on the map.',
  unlocatedPostings_other: '{{count}} Postings without coordinates are not on the map.',
};
