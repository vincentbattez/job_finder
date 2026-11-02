const INSTRUCTIONS_USAGE =
  'Usage: jf instructions <candidate> [<module> [default|replace|delete]], for example jf instructions lea letter.';

// What jf writes: its help, its prompts and the results of its commands, and what the worker logs
export const CLI_EN = {
  help: {
    title: 'jf: Posting watch and application preparation',
    usage: 'Usage: jf <command>',
    commandsHeading: 'Commands:',
    help: 'Shows this help',
  },
  unknownCommand: 'Unknown command: {{commandName}}. “jf help” lists the commands.',
  obsoleteConfig:
    '{{configPath}} is no longer read: its content is in the database, and the Candidates, their Watches and the Default Deadline Period are now set in the front. Delete it.',
  unreadableFile: 'Cannot read the file {{filePath}} ({{reason}}). Check its path.',
  fileWriteFailed: 'Cannot write the file {{filePath}} ({{reason}}). Check that its folder is writable.',

  // A Posting on one line. The Source gives the Deadline as a day, at midnight UTC.
  deadline: '{{deadline, datetime(timeZone: UTC)}}',
  startDate: 'Start Date {{startDate, datetime(timeZone: UTC)}}',
  repostOf: 'Repost of {{reference}}',
  repostedAs: 'Reposted as {{reference}}',

  // The choices on the terminal
  answered: '{{question}}: {{label}}\n',
  ask: '{{question}} (1 to {{itemCount}}): ',
  noChoice: 'Abandoned: no choice.',
  invalidChoice: 'Invalid choice: {{answer}}. Run the command again.',
  candidateQuestion: 'Candidate',
  noCandidate: 'No Candidate: create one in the Candidates page of the front.',
  postingQuestion: 'Posting to edit',
  noPosting: 'No Posting for {{candidateName}}: “jf detect” looks for new Postings.',
  artifactQuestion: 'Artifact to edit',
  chosenVersionLabel: '{{artifactLabel}} (v{{number}}, chosen)',
  chosenInterviewVersionLabel: '{{artifactLabel}} of Interview {{interviewNumber}} (v{{number}}, chosen)',
  noArtifact: 'Posting {{reference}} has no Artifact to edit: “jf run research {{reference}}” produces its Research.',

  // jf candidates, jf list
  candidatesDescription: 'Lists the Candidates, which the Candidates page of the front creates and renames',
  listDescription: 'Lists the Postings of a Candidate: jf list <candidate>',
  listUsage: 'Usage: jf list <candidate>. “jf candidates” lists the Candidates.',

  // jf detect
  detectDescription:
    'Looks for the new Postings of each Watch; --automation marks the daily one: jf detect [--automation]',
  detectionSummary: 'Watch {{watchId}} ({{candidateId}}): {{newPostings}}{{firstLaunch}}\n',
  noNewPosting: 'no new Posting',
  newPostings: '{{newCount}} new Postings',
  firstLaunch: ', first launch: imported without triggering anything',
  nearMissHeading: 'Titles narrowly left out:\n',

  // jf import
  importDescription:
    'Imports a Job Description in Markdown found elsewhere: the worker reads its fields with Claude Code, then queues its Research; Candidate offered if missing, --wait waits for the extraction: jf import <file> [<candidate>] [--wait]',
  importUsage: 'Usage: jf import <file> [<candidate>] [--wait], for example jf import court-clerk.md lea.',
  imported: 'Posting {{reference}} imported, extraction of its fields queued (job {{jobId}}).\n',
  importQueued: 'The worker starts it, then queues its Research. “jf list {{candidateId}}” shows it.\n',
  extractionWaiting: 'Waiting for the worker (lpm worker service): Claude Code reads the fields…\n',
  extractionFailed:
    'Extraction of the fields of Posting {{reference}} failed ({{errorCode}}):\n{{log}}\nRun it again: jf run extraction {{reference}}',
  extracted: '{{postingLine}}\nIts Research is queued: “jf versions {{reference}} research” follows it.\n',

  // jf run
  runDescription:
    'Queues a new Version of an Artifact, which the worker produces with Claude Code; --wait waits for the end: jf run research|letter|portrait|brief <posting> [<interview>] [--wait]',
  runUsage:
    'Usage: jf run <module> <posting> [<interview>] [--wait], for example jf run research 2026-2445600, or jf run brief 2026-2445600 1 for the Interview Brief of Interview 1.',
  queued: '{{module}} of Posting {{reference}} queued (job {{jobId}}).\n',
  runQueued: 'The worker will produce it. “{{versionsCommand}}” follows its Versions.\n',
  runWaiting: 'Waiting for the worker (lpm worker service): Claude Code may take several minutes…\n',
  runFailed: '{{name}} failed ({{errorCode}}):\n{{log}}\nRun it again: {{command}}',
  runReady: '{{name}} ready, as a Draft until validated. “{{versionsCommand}}” lists its Versions.\n',

  // jf recipients
  recipientsDescription:
    'Shows whom to send the application to, according to the Chosen Letter: jf recipients <posting>',
  recipientsUsage: 'Usage: jf recipients <posting>, for example jf recipients 2026-2445600.',
  fieldLabelBySource: { applicationEmail: 'application email', contact1: 'contact 1', contact2: 'contact 2' },
  recipient: 'To: {{address}}',
  noRecipientAddress: 'no address in the Posting',
  ccList: 'Cc: {{addresses}}',
  noCc: 'none',
  salutation: 'Salutation: {{text}}',
  justification: 'Justification: {{text}}',

  // jf versions, jf validate
  versionsDescription:
    'Lists the Versions of an Artifact: jf versions <posting> research, or jf versions <posting> brief <interview> for an Artifact of an Interview',
  versionsUsage:
    'Usage: jf versions <posting> <artifact> [<interview>], for example jf versions 2026-2445600 research, or jf versions 2026-2445600 brief 1.',
  versionStateLabelByState: { running: 'in progress', ready: 'ready', failed: 'failed' },
  lastJobFailed: 'Last launch failed ({{errorCode}}):\n{{log}}\n',
  lastJobStalled: 'Last launch not moving ({{errorCode}}):\n{{message}}\n',
  validationLabelByValidation: { draft: 'Draft', validated: 'Validated' },
  chosenVersion: 'chosen',
  candidateInstructions: 'Candidate’s Instructions',
  defaultInstructions: 'Default Instructions',
  createdAt: '{{createdAt, datetime(dateStyle: short; timeStyle: medium; timeZone: Europe/Paris)}}',
  validateDescription:
    'Validates a Version of an Artifact, which becomes its Chosen Version: jf validate <posting> research <version>, or jf validate <posting> brief <version> <interview>',
  validateUsage:
    'Usage: jf validate <posting> <artifact> <version> [<interview>], for example jf validate 2026-2445600 research 2, or jf validate 2026-2445600 brief 2 1.',
  versionValidated: '{{artifact}} {{version}} validated and chosen for Posting {{reference}}.\n',

  // jf apply, jf hired, jf rejected, jf in-progress, jf archive, jf unarchive
  statusCommandDescription: '{{description}}: jf {{name}} <posting>',
  statusUsage: 'Usage: jf {{name}} <posting>. “jf list <candidate>” lists the Postings.',
  statusChanged: '{{reference}}: {{statusLabel}}\n',
  applyDescription: 'Moves a Posting to Applied, with or without a Letter, which freezes its Letter',
  toApplyDescription:
    'Puts an Applied Posting whose Letter was never sent, without an Interview, back to To Apply, its Letter free again',
  hiredDescription: 'Marks an Application Hired: the Candidate gets the job',
  rejectedDescription: 'Marks an Application Rejected: the employer did not pick the Candidate',
  inProgressDescription: 'Puts a Hired or Rejected Application back In progress, which is Applied',
  archiveDescription: 'Archives a Posting, whatever its Status, which it keeps',
  unarchiveDescription: 'Unarchives a Posting, which finds its Status as it was',
  postingArchived: '{{reference}}: Archived\n',
  postingUnarchived: '{{reference}}: no longer Archived\n',

  // jf profile, jf edit
  profileDescription: 'Completes the Profile of a Candidate with Claude Code: jf profile <candidate>',
  profileUsage: 'Usage: jf profile <candidate>. “jf candidates” lists the Candidates.',
  editDescription:
    'Edits an Artifact with Claude Code, Posting and Artifact offered if missing: jf edit [<posting> [<artifact> [<interview>]]]',

  // jf instructions
  instructionsDescription:
    'Shows, replaces (read on the standard input) or deletes the Instructions of a module: jf instructions <candidate> [<module> [default|replace|delete]]',
  instructionsUsage: `${INSTRUCTIONS_USAGE} “jf candidates” lists the Candidates.`,
  unknownOperation: `Unknown operation: {{operation}}. ${INSTRUCTIONS_USAGE}`,
  candidateInstructionsHeading: 'Candidate’s Instructions of {{module}}:\n',
  defaultInstructionsHeading: 'Default Instructions of {{module}}:\n',
  typeInstructions: 'Type or paste the Instructions, then Ctrl-D:\n',
  instructionsReplaced: '{{module}} will follow these Candidate’s Instructions in its next Versions.\n',
  instructionsDeleted: '{{module}} goes back to its default Instructions.\n',

  // jf notes
  notesDescription:
    'Shows or replaces (read on the standard input) the Notes of a Posting, whatever its Status: jf notes <posting> [replace]',
  notesUsage: 'Usage: jf notes <posting> [replace]. “jf list <candidate>” lists the Postings.',
  typeNotes: 'Type or paste the Notes in Markdown, then Ctrl-D:\n',
  notesReplaced: 'Notes of {{reference}} saved.\n',
  // jf interviews
  interviewsDescription:
    'Lists the Interviews of an Application by date, or adds, edits or deletes one, the start in Paris time: jf interviews <posting> [add | edit <number> | delete <number>] [--start 2026-11-19T14:00] [--duration <minutes>] [--place <place>] [--interviewers <text>]',
  interviewsUsage:
    'Usage: jf interviews <posting> [add --start 2026-11-19T14:00 | edit <number> | delete <number>] [--duration <minutes>] [--place <place>] [--interviewers <text>]. “jf interviews <posting>” lists the numbers.',
  noInterview: 'No Interview for {{reference}}.\n',
  interviewMinutes: '{{minutes}} min',
  interviewAdded: 'Interview added to {{reference}}.\n',
  interviewEdited: 'Interview {{number}} of {{reference}} saved.\n',
  interviewDeleted: 'Interview {{number}} of {{reference}} deleted.\n',
  // jf ical
  icalDescription:
    'Writes the iCal file of an Interview in the current folder, its links on the address of the front: jf ical <posting> <interview> [--origin http://mac-mini.local:5180]',
  icalUsage:
    'Usage: jf ical <posting> <interview> [--origin <address of the front>]. “jf interviews <posting>” lists the numbers.',
  icalWritten: 'iCal file written: {{filePath}}\n',

  // The worker, in lpm logs worker
  workerReady: 'Worker ready: it runs the queued jobs, one at a time.\n',
  jobFailed: 'failed: {{firstLine}}',
  conversionDone: 'stored in the Profile',
  conversionJob: 'job {{jobId}}, conversion of Upload {{upload}} of {{candidateId}}: {{outcome}}\n',
  artifactDone: 'ready, as a Draft',
  artifactJob: 'job {{jobId}}, {{artifact}} of Posting {{reference}}: {{outcome}}\n',
  // The first message of an interactive session, which Claude answers in the language of the Candidate
  sessionGreeting: 'Hello!',
};
