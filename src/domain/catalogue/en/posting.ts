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
  contactsHeading: 'Contacts',
  contactLabelByField: {
    applicationEmail: 'Application email',
    contact1: 'Contact 1',
    contact2: 'Contact 2',
  } satisfies Record<ContactField, string>,
  recipientsHeading: 'Recommended recipients',
  jobDescriptionHeading: 'Job Description',

  // What the Chosen Letter recommends
  recipientTerm: 'Recipient',
  noRecipientAddress: 'No address in the Posting',
  ccTerm: 'Cc',
  noCc: 'None',
  salutationTerm: 'Salutation',

  // The outcome selector: Applied on a To Apply Posting, then the outcomes of its Application
  markApplied: 'Mark as Applied',
  outcomeLabelByStatus: {
    hired: 'Hired',
    rejected: 'Rejected',
  } satisfies Record<Exclude<Status, 'new' | 'to_apply' | 'applied'>, string>,
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

  // The Posting page (spec #125): its header, its primary action by Step and its ⋯ menu, its tabs
  page: {
    deadline: 'Deadline {{date, datetime(dateStyle: short; timeZone: Europe/Paris)}}',
    tabLabelByTab: {
      posting: 'Posting',
      research: 'Research',
      letter: 'Letter',
      interviews: 'Interviews',
      notes: 'Notes',
    },
    tabState: ' ({{stateLabel}})',
    tabStateLabelBySummary: { none: 'None', draft: 'Draft', validated: 'Validated', pending: 'In progress' },
    markApplied: 'Mark Applied',
    addInterview: 'Add an Interview',
    seeInterview: 'See Interview {{number}}',
    recordOutcome: 'Record the outcome',
    backToApply: 'Put back To Apply (not sent)',
    openOnSource: 'Open on its Source',
    repostOf: 'Earlier Posting: {{reference}}',
    repostedAs: 'Reposted as {{reference}}',
    moreActions: 'More actions',
    statusChanged: 'Posting moved to “{{statusLabel}}”',
    archived: 'Posting archived',
    keep: 'Keep',
    dismiss: 'Dismiss',
    kept: 'Posting kept: its Research starts',
    dismissed: 'Posting dismissed',
    unarchived: 'Posting unarchived',
    undo: 'Undo',
    factsHeading: 'Key facts',
    startDateTerm: 'Start date',
    appliedAtTerm: 'Applied on',
    noContact: 'No contact in the Posting.',
    repostHeading: 'Repost',
    publicationCount_one: 'Published {{count}} time',
    publicationCount_other: 'Published {{count}} times',
    publicationCountSince_one:
      'Published {{count}} time since {{date, datetime(dateStyle: short; timeZone: Europe/Paris)}}',
    publicationCountSince_other:
      'Published {{count}} times since {{date, datetime(dateStyle: short; timeZone: Europe/Paris)}}',
    earlierApplication: 'You applied on {{date, datetime(dateStyle: short; timeZone: Europe/Paris)}} · {{stepLabel}}',
    earlierApplicationUndated: 'You applied · {{stepLabel}}',
  },

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
  validationLabelByValidation: { draft: 'Draft', validated: 'Validated' },

  // The Artifact view of the Research and Letter tabs (spec #125, « Versions: Draft, Validated, Original »)
  artifactView: {
    versionSelect: 'Version',
    versionValue: 'Version {{number}} · {{stateLabel}}',
    versionNumber: 'Version {{number}}',
    versionOption: '{{stateLabel}} · {{originLabel}} · {{date, datetime(dateStyle: short; timeZone: Europe/Paris)}}',
    versionOptionChosen:
      '{{stateLabel}} · chosen · {{originLabel}} · {{date, datetime(dateStyle: short; timeZone: Europe/Paris)}}',
    stateLabelByState: { draft: 'Draft', validated: 'Validated', running: 'In progress', failed: 'Failed' },
    originLabelByOrigin: { ai: 'AI', candidate: 'you' },
    chosenBadge: 'Validated · chosen',
    draftHeading: 'Version {{number}} is a Draft: read it, then validate it',
    draftNoteLetter: 'Only the Chosen Version goes to the employer.',
    draftNote: 'Until it is validated, no other Artifact reads it.',
    draftChosenNote: 'Meanwhile, Version {{number}} stays the Chosen Version.',
    draftNoChosenNote: 'No Version is chosen yet.',
    validate: 'Validate Version {{number}}',
    validated: 'Version {{number}} validated and chosen',
    olderVersion: 'An older Version. The Chosen Version is Version {{number}}.',
    seeChosen: 'See it',
    chooseAgain: 'Choose it again',
    frozen: 'The Posting is Applied: this Letter is frozen as it was sent.',
    running: 'Generating',
    queued: 'Waiting for the worker',
    runningNote: 'The new Version will arrive as a Draft; the Chosen Version stays the same until then.',
    runningVersion: 'This Version is being generated.',
    failedVersion: 'This Version failed: it has no text to read.',
    emptyHeading: 'No {{artifactLabel}} yet',
    emptyPitchByArtifact: {
      research:
        'The Research establishes, with its sources, what the recruiters expect for this Posting and in what context.',
      letter: 'The Letter of this Posting. It needs a Validated Research; its Chosen Version is the one sent.',
      portrait: 'The Portrait establishes what is publicly known of the Interviewers of this Interview.',
      interview_brief: 'The Interview Brief prepares this Interview: what to tell them, what to revise, how to train.',
    },
    modes: 'Mode',
    modeRead: 'Read',
    modeEdit: 'Edit',
    producedOn: 'Produced by the AI on {{date, datetime(dateStyle: long; timeZone: Europe/Paris)}}',
    broughtOn: 'Brought by you on {{date, datetime(dateStyle: long; timeZone: Europe/Paris)}} · no Original',
    textLabel: 'Text of Version {{number}}',
    instructionsSummary: '{{originLabel}} · Instructions of this Version',
    save: 'Save',
    cancel: 'Cancel',
    saved: 'Version {{number}} saved',
  },

  // Marking Applied while the Letter is not validated (spec #125, « The Posting page »)
  appliedDialog: {
    title: 'Mark the Posting Applied?',
    draftDescription:
      'Your Letter is still a Draft (Version {{number}}). Validate it so the Letter you sent is the one recorded.',
    noLetterDescription: 'This Posting has no Validated Letter. Mark it Applied anyway if you applied another way.',
    validateAndApply: 'Validate the Letter and mark Applied',
    applyWithoutLetter: 'Mark Applied without a Letter',
    cancel: 'Cancel',
  },

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
  save: 'Save',
  unsavedChanges: 'Unsaved changes',
  preview: 'Preview',
  copy: 'Copy',
  copiedCommand: 'Copied',

  // The Sheet a list opens on a Posting (spec #125 « The Sheet »)
  sheet: {
    noEmployer: 'Employer not given',
    deadline: 'Deadline {{date, datetime(dateStyle: medium; timeZone: Europe/Paris)}}',
    noDeadline: 'No Deadline',
    startDate: 'Starts {{date, datetime(dateStyle: medium; timeZone: Europe/Paris)}}',
    noStartDate: 'Start date not given',
    publication_ordinal_one: '{{count}}st publication of this Position',
    publication_ordinal_two: '{{count}}nd publication of this Position',
    publication_ordinal_few: '{{count}}rd publication of this Position',
    publication_ordinal_other: '{{count}}th publication of this Position',
    publicationSince_ordinal_one:
      '{{count}}st publication of this Position since {{date, datetime(dateStyle: short; timeZone: Europe/Paris)}}',
    publicationSince_ordinal_two:
      '{{count}}nd publication of this Position since {{date, datetime(dateStyle: short; timeZone: Europe/Paris)}}',
    publicationSince_ordinal_few:
      '{{count}}rd publication of this Position since {{date, datetime(dateStyle: short; timeZone: Europe/Paris)}}',
    publicationSince_ordinal_other:
      '{{count}}th publication of this Position since {{date, datetime(dateStyle: short; timeZone: Europe/Paris)}}',
    documentsHeading: 'Documents',
    artifactState: {
      running: 'Being written',
      draft: 'Draft · to validate',
      validated: 'Validated',
      failed: 'Failed',
      none: 'Not yet',
    },
    interviewCount_one: '{{count}} Interview',
    interviewCount_other: '{{count}} Interviews',
    openPage: 'Open the full page',
  },

  // The Notes of the Posting, whatever its Status
  notes: {
    heading: 'Notes',
    label: 'Notes in Markdown',
    placeholder:
      '# Call to the department\n\nWhat you learn about this Posting: a call, the feedback from an interview…',
    save: 'Save the Notes',
    intro: 'Your notes on this Posting: a call, an impression, what not to forget.',
    saved: 'Notes saved',
  },

  // The Interviews tab (spec #125, « Interviews »): the Interviews by date beside the selected one, its
  // Interview Brief and Portrait as tabs, added and edited in a Dialog, deleted after confirming
  interviews: {
    heading: 'Interviews',
    listLabel: 'Interviews of the Application',
    count_one: '{{count}} Interview',
    count_other: '{{count}} Interviews',
    applyFirst: 'An Interview belongs to an Application: mark the Posting Applied to add one.',
    emptyTitle: 'No Interview yet',
    emptyDescription:
      'When the employer invites you, add the Interview: its Portrait and its Interview Brief are prepared here.',
    add: 'Add an Interview',
    addShort: 'Add',
    title: 'Interview {{number}}',
    when: '{{date, datetime(dateStyle: full; timeStyle: short; timeZone: Europe/Paris)}}',
    shortWhen: '{{date, datetime(dateStyle: medium; timeStyle: short; timeZone: Europe/Paris)}}',
    facts: 'Interview {{number}} · {{minutes}} min',
    minutes: '{{minutes}} min',
    past: 'Past',
    documents: 'Documents of Interview {{number}}',
    day: 'Day',
    time: 'Time (Paris)',
    duration: 'Duration (min)',
    place: 'Place',
    interviewers: 'Interviewers',
    placePlaceholder: 'Room 3 of the court, or by video',
    interviewersPlaceholder: 'Name, role, all you know about them: the Portrait starts from there.',
    dialogDescription: 'The Application is Invited while an Interview is to come, then Interviewed.',
    editTitle: 'Edit Interview {{number}}',
    submitAdd: 'Add the Interview',
    submitEdit: 'Save',
    cancel: 'Cancel',
    addedToast: 'Interview {{number}} added',
    savedToast: 'Interview {{number}} saved',
    deletedToast: 'Interview {{number}} deleted',
    addedTitle: 'Interview added',
    addedDescription:
      'Add it to your calendar: the iCal file opens in Calendar, Google Calendar or Outlook, with a reminder the day before and an hour before.',
    downloadIcal: 'Download the iCal file (.ics)',
    later: 'Later',
    seeInterview: 'See the Interview',
    edit: 'Edit Interview {{number}}',
    delete: 'Delete Interview {{number}}',
    ical: 'Add to calendar (iCal)',
    deleteTitle: 'Delete Interview {{number}}?',
    deleteDescription:
      'Its Portrait and its Interview Brief go with it. The Application is Applied again if no Interview is left.',
    keep: 'Keep',
    confirmDelete: 'Delete',
  },

  // The iCal file of an Interview: the event in the calendar and the links its description gives
  ical: {
    summary: 'Interview · {{title}} · {{employer}}',
    summaryWithoutEmployer: 'Interview · {{title}}',
    officialAd: 'Official ad',
    postingPage: 'Job Finder page',
    interviewers: 'Interviewers: {{interviewers}}',
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
  mapLabel: 'Map of the Postings',
  unlocatedPostings_one: '{{count}} Posting without coordinates is not on the map.',
  unlocatedPostings_other: '{{count}} Postings without coordinates are not on the map.',
};
