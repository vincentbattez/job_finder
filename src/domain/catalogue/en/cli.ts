// The Candidates live in France: a date is that of Paris, the Deadline a day at midnight UTC
const DEADLINE_FORMAT = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC' });
const CREATED_AT_FORMAT = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'short',
  timeStyle: 'medium',
  timeZone: 'Europe/Paris',
});

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
  unknownCommand: (commandName: string) => `Unknown command: ${commandName}. “jf help” lists the commands.`,
  obsoleteConfig: (configPath: string) =>
    `${configPath} is no longer read: its content is in the database, and the Candidates, their Watches and the Default Deadline Period are now set in the front. Delete it.`,
  unreadableFile: (filePath: string, reason: string) => `Cannot read the file ${filePath} (${reason}). Check its path.`,

  // A Posting on one line
  formatDeadline: (deadline: Date) => DEADLINE_FORMAT.format(deadline),
  inZone: 'Zone',
  outOfZone: 'out of Zone',
  repostOf: (reference: string) => `Repost of ${reference}`,
  repostedAs: (reference: string) => `Reposted as ${reference}`,

  // The choices on the terminal
  answered: (question: string, label: string) => `${question}: ${label}\n`,
  ask: (question: string, count: number) => `${question} (1 to ${String(count)}): `,
  noChoice: 'Abandoned: no choice.',
  invalidChoice: (answer: string) => `Invalid choice: ${answer}. Run the command again.`,
  candidateQuestion: 'Candidate',
  noCandidate: 'No Candidate: create one in the Candidates page of the front.',
  postingQuestion: 'Posting to edit',
  noPosting: (candidateName: string) => `No Posting for ${candidateName}: “jf detect” looks for new Postings.`,
  artifactQuestion: 'Artifact to edit',
  chosenVersionLabel: (artifactLabel: string, number: number) => `${artifactLabel} (v${String(number)}, chosen)`,
  noArtifact: (reference: string) =>
    `Posting ${reference} has no Artifact to edit: “jf run research ${reference}” produces its Research.`,

  // jf candidates, jf list
  candidatesDescription: 'Lists the Candidates, which the Candidates page of the front creates and renames',
  listDescription: 'Lists the Postings of a Candidate: jf list <candidate>',
  listUsage: 'Usage: jf list <candidate>. “jf candidates” lists the Candidates.',

  // jf detect
  detectDescription: 'Looks for the new Postings of each Watch',
  detectionSummary: (watchId: string, candidateId: string, newCount: number, isFirstLaunch: boolean) =>
    `Watch ${watchId} (${candidateId}): ${newCount === 0 ? 'no new Posting' : String(newCount) + ' new Postings'}${isFirstLaunch ? ', first launch: imported without triggering anything' : ''}\n`,
  nearMissHeading: 'Titles narrowly left out:\n',

  // jf import
  importDescription:
    'Imports a Job Description in Markdown found elsewhere: the worker reads its fields with Claude Code, then queues its Research; Candidate offered if missing, --wait waits for the extraction: jf import <file> [<candidate>] [--wait]',
  importUsage: 'Usage: jf import <file> [<candidate>] [--wait], for example jf import court-clerk.md lea.',
  imported: (reference: string, jobId: number) =>
    `Posting ${reference} imported, extraction of its fields queued (job ${String(jobId)}).\n`,
  importQueued: (candidateId: string) =>
    `The worker starts it, then queues its Research. “jf list ${candidateId}” shows it.\n`,
  extractionWaiting: 'Waiting for the worker (lpm worker service): Claude Code reads the fields…\n',
  extractionFailed: (reference: string, log: string) =>
    `Extraction of the fields of Posting ${reference} failed:\n${log}\nRun it again: jf run extraction ${reference}`,
  extracted: (postingLine: string, reference: string) =>
    `${postingLine}\nIts Research is queued: “jf versions ${reference} research” follows it.\n`,

  // jf run
  runDescription:
    'Queues a new Version of an Artifact, which the worker produces with Claude Code; --wait waits for the end: jf run research|letter|brief|visualization <posting> [--wait]',
  runUsage: 'Usage: jf run <module> <posting> [--wait], for example jf run research 2026-2445600.',
  queued: (module: string, reference: string, jobId: number) =>
    `${module} of Posting ${reference} queued (job ${String(jobId)}).\n`,
  runQueued: (versionsCommand: string) => `The worker will produce it. “${versionsCommand}” follows its Versions.\n`,
  runWaiting: 'Waiting for the worker (lpm worker service): Claude Code may take several minutes…\n',
  runFailed: (name: string, log: string, module: string, reference: string) =>
    `${name} failed:\n${log}\nRun it again: jf run ${module} ${reference}`,
  runReady: (name: string, versionsCommand: string) =>
    `${name} ready and chosen. “${versionsCommand}” lists its Versions.\n`,

  // jf recipients
  recipientsDescription:
    'Shows whom to send the application to, according to the Chosen Letter: jf recipients <posting>',
  recipientsUsage: 'Usage: jf recipients <posting>, for example jf recipients 2026-2445600.',
  fieldLabelBySource: { applicationEmail: 'application email', contact1: 'contact 1', contact2: 'contact 2' },
  recipient: (address: string | null) => `To: ${address ?? 'no address in the Posting'}`,
  ccList: (addressList: string[]) => `Cc: ${addressList.length === 0 ? 'none' : addressList.join(', ')}`,
  salutation: (text: string) => `Salutation: ${text}`,
  justification: (text: string) => `Justification: ${text}`,

  // jf versions, jf choose
  versionsDescription: 'Lists the Versions of an Artifact: jf versions <posting> research',
  versionsUsage: 'Usage: jf versions <posting> <artifact>, for example jf versions 2026-2445600 research.',
  versionStateLabelByState: { running: 'in progress', ready: 'ready', failed: 'failed' },
  chosenVersion: 'chosen',
  candidateInstructions: 'Candidate’s Instructions',
  defaultInstructions: 'Default Instructions',
  formatCreatedAt: (createdAt: Date) => CREATED_AT_FORMAT.format(createdAt),
  chooseDescription: 'Changes the Chosen Version of an Artifact: jf choose <posting> research <version>',
  chooseUsage: 'Usage: jf choose <posting> <artifact> <version>, for example jf choose 2026-2445600 research 2.',
  versionChosen: (artifact: string, version: string, reference: string) =>
    `${artifact} ${version} chosen for Posting ${reference}.\n`,

  // jf apply, jf archive, jf to-apply
  statusCommandDescription: (description: string, name: string) => `${description}: jf ${name} <posting>`,
  statusUsage: (name: string) => `Usage: jf ${name} <posting>. “jf list <candidate>” lists the Postings.`,
  statusChanged: (reference: string, statusLabel: string) => `${reference}: ${statusLabel}\n`,
  applyDescription:
    'Moves a Posting to Applied, with or without a Letter, which freezes its Letter for good; moves an Applied then Archived Posting back to Applied',
  archiveDescription: 'Moves a Posting to Archived, Applied or not',
  toApplyDescription: 'Moves an Archived Posting that was never Applied back to To Apply',

  // jf profile, jf edit
  profileDescription: 'Completes the Profile of a Candidate with Claude Code: jf profile <candidate>',
  profileUsage: 'Usage: jf profile <candidate>. “jf candidates” lists the Candidates.',
  editDescription:
    'Edits an Artifact with Claude Code, Posting and Artifact offered if missing: jf edit [<posting> [<artifact>]]',

  // jf instructions
  instructionsDescription:
    'Shows, replaces (read on the standard input) or deletes the Instructions of a module: jf instructions <candidate> [<module> [default|replace|delete]]',
  instructionsUsage: `${INSTRUCTIONS_USAGE} “jf candidates” lists the Candidates.`,
  unknownOperation: (operation: string) => `Unknown operation: ${operation}. ${INSTRUCTIONS_USAGE}`,
  instructionsHeading: (module: string, isCandidate: boolean) =>
    `${isCandidate ? 'Candidate’s' : 'Default'} Instructions of ${module}:\n`,
  typeInstructions: 'Type or paste the Instructions, then Ctrl-D:\n',
  instructionsReplaced: (module: string) =>
    `${module} will follow these Candidate’s Instructions in its next Versions.\n`,
  instructionsDeleted: (module: string) => `${module} goes back to its default Instructions.\n`,

  // The worker, in lpm logs worker
  workerReady: 'Worker ready: it runs the queued jobs, one at a time.\n',
  jobFailed: (firstLine: string) => `failed: ${firstLine}`,
  conversionDone: 'stored in the Profile',
  conversionJob: (jobId: number, upload: string, candidateId: string, outcome: string) =>
    `job ${String(jobId)}, conversion of Upload ${upload} of ${candidateId}: ${outcome}\n`,
  artifactDone: 'ready and chosen',
  artifactJob: (jobId: number, artifact: string, reference: string, outcome: string) =>
    `job ${String(jobId)}, ${artifact} of Posting ${reference}: ${outcome}\n`,
};
