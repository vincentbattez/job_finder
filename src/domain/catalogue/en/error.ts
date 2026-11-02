// The messages of the errors a Candidate reads, each saying what to do: the catalogue of the codes
// (src/domain/error.ts) names the key of each, and the texts a message embeds
export const ERROR_EN = {
  // A name the message quotes, such as each label of a list
  quote: '“{{text}}”',
  // Between the Statuses a Posting can move to
  orSeparator: ' or ',

  // What reaches the Candidate of a failure our code did not foresee, or of an input not as expected
  unexpected: 'Unexpected error: {{reason}}\nRun again; if it comes back, report it with this message.',
  invalidInput: 'Invalid input:\n{{problem}}\nCorrect it, then try again.',
  // One input to correct, by its name, and what is wrong with it
  invalidInputIssue: '“{{path}}”: {{message}}',
  // A button whose form is older than the page's code
  unknownIntent: 'This button does nothing: reload the page.',
  // A module's failure, worded in its own copy (ADR-0010)
  moduleFailure: '{{detail}}',

  // The data folder
  dataLayoutMixed:
    'The data folder mixes the old layout and the new one: “{{frenchPath}}” and “{{englishPath}}” both exist. Merge the first into the second by hand, delete it, then start again.',
  dataLayoutUnexpected:
    'The data folder has an unexpected entry: “{{frenchPath}}” is not of the kind the tool knows. Move it out of the data folder, then start again.',
  configInvalid:
    'Invalid config: {{configPath}}\n{{problem}}\nFix it so that it is imported into the database, or delete it: Candidates and their Watches are now set in the front.',
  configKeysMixed:
    'The config {{configPath}} holds both the old key “{{frenchKey}}” and its new name “{{englishKey}}”. Keep only “{{englishKey}}”, merging into it what “{{frenchKey}}” holds, then start again.',

  detectionRunning:
    'A Detection is already running, started on {{startedAt, datetime(dateStyle: medium; timeStyle: short; timeZone: Europe/Paris)}}: wait for its verdict, then run it again if needed.',
  // Stored on a Detection whose process stopped before its end, so that it no longer blocks the next one
  detectionInterrupted: 'Interrupted: the Detection stopped before its end, without a verdict. Run it again.',

  // The data folder
  missingJobDescription:
    'Job Description not found for Posting {{reference}}: {{filePath}}. Put it back there, where the tool reads it.',

  // Candidates, Postings and their lookups
  unknownCandidate: 'Unknown Candidate: {{candidateId}}. “jf candidates” lists the Candidates.',
  invalidCandidateId:
    '“{{candidateId}}” is not a Candidate identifier: lowercase letters without accents and digits, separated by “-”, such as “lea” or “jean-pierre”.',
  emptyCandidateName: 'The Candidate’s name is empty: fill it in.',
  duplicateCandidateId: 'A Candidate already has the identifier {{candidateId}}: choose another one.',
  invalidDefaultDeadlinePeriod: 'The Default Deadline Period is a whole number of months, at least 1.',
  unknownPosting: 'Unknown Posting: {{reference}}. “jf list <candidate>” lists the Postings.',
  ambiguousPosting:
    'Several Postings have the reference {{reference}}, for different Candidates: their Watches follow the same Source, and the tool cannot choose between them yet. Report it so that it tells them apart.',

  // Watches and Sources
  unknownWatch: '{{candidateName}} has no Watch {{watchId}}: reload the page of their Profile.',
  unknownSource: 'Unknown Source: {{sourceId}}. Choose one of {{knownList}} in the Watches of the Profile.',
  unknownSourceOfWatch:
    'Unknown Source for the Watch {{watchId}}: {{sourceId}}. Choose one of {{knownList}} in the Watches of the Profile.',
  watchParameters:
    'The Watch {{watchId}} does not give the {{sourceName}} Source the Parameters it expects: correct {{labels}} in the Profile of its Candidate.',
  sourceParameters: 'The {{sourceName}} Source expects other Parameters: fill in {{labels}}.',
  // Each notification not sent, one per line
  notificationsNotSent: '{{failures}}',

  // Statuses
  notNew: 'Posting {{reference}} is no longer New: it was already sorted.',
  newNotSorted: 'Posting {{reference}} is New: keep it or dismiss it first.',
  statusChange: 'Posting {{reference}} is {{statusLabel}}: it can only move to {{nextLabels}}.',
  toApplyAfterOutcome:
    'Posting {{reference}} has an outcome: mark it Sent again first, only an Applied Posting without an Interview goes back to To Apply.',
  toApplyWithInterview: 'Posting {{reference}} has an Interview: its Letter was sent, it does not go back to To Apply.',
  letterFrozen:
    'Posting {{reference}} was Applied: its Chosen Letter is frozen as sent. It is no longer edited, regenerated or replaced by another Version.',

  // Interviews
  interviewWithoutApplication:
    'Posting {{reference}} is To Apply: mark it Applied first, an Interview belongs to its Application.',
  unknownInterview:
    'Posting {{reference}} has no Interview {{number}}. “jf interviews {{reference}}” lists its Interviews.',
  interviewRequired:
    'The {{artifactLabel}} prepares an Interview: name its number after the other arguments. “jf interviews {{reference}}” lists the Interviews of Posting {{reference}}.',
  interviewNotExpected:
    'The {{artifactLabel}} belongs to Posting {{reference}}, not to one of its Interviews: name no Interview number.',

  // Modules, jobs and Versions
  workerNotRunning:
    'The worker is not running: job {{jobId}} is not moving. Start it: “lpm service worker start -p job_finder”, then read “lpm logs worker -p job_finder” if it stops again.',
  jobOverdue:
    'Job {{jobId}} has been running for over {{minutes}} minutes, past its maximum duration: the worker is stuck. Restart it: “lpm service worker restart -p job_finder”, which fails the job; then run the module again.',
  unknownModule: 'Unknown module: {{name}}. Modules: {{names}}.',
  unknownArtifact: 'Unknown Artifact: {{name}}. Artifacts: {{names}}.',
  // The front shows it beside the button of the missing Artifact, the CLI with the command that lifts it
  missingArtifactForFront:
    'Posting {{reference}} has no Validated {{missingLabel}}, which the {{moduleLabel}} relies on: produce then validate the {{missingLabel}} first.',
  missingArtifactForCli:
    'Posting {{reference}} has no Validated {{missingLabel}}, which the {{moduleLabel}} relies on. Produce it first, “{{command}}”, then validate one of its Versions.',
  unknownInput: 'Posting {{reference}} has no Input “{{key}}” for this run: reopen the panel to see its Inputs.',
  requiredInputUnchecked: 'The Input “{{key}}” of Posting {{reference}} is required: this run cannot leave it out.',
  missingOutput: 'The expected file {{outputPath}} is missing.',
  emptyOutput: 'The expected file {{outputPath}} is empty.',
  malformedOutput: 'The file {{outputPath}} is malformed: {{formatError}}.',
  notImported: 'Posting {{reference}} was not imported: its fields come from its Source, without extraction.',
  unknownJob: 'Unknown job: {{jobId}}. Its number is the one “jf run” or “jf import” printed.',
  interruptedJob: 'Interrupted: the worker stopped during this job. Running the module again creates a new Version.',
  noChosenVersionToEdit:
    'Posting {{reference}} has no Chosen Version of {{artifact}} to edit: “{{command}}” produces one.',
  originalNotEditable:
    "The Original is never edited: it keeps what the AI wrote. Correct the Version's text, on Posting {{reference}}.",
  unknownVersion:
    'Unknown Version: {{artifact}} v{{number}} of Posting {{reference}}. “{{command}}” lists its Versions.',
  versionFailed:
    'Version {{artifact}} v{{number}} of Posting {{reference}} is failed: only a ready Version is validated or corrected.',
  versionRunning:
    'Version {{artifact}} v{{number}} of Posting {{reference}} is in progress: only a ready Version is validated or corrected.',
  notAVersionFile: '“{{fileName}}” is not an editable file of a Version of {{artifact}} of Posting {{reference}}.',
  noChosenLetter: 'Posting {{reference}} has no Chosen Letter. Produce it: jf run letter {{reference}}.',

  // The Profile and its Uploads
  invalidProfileFileName:
    '“{{fileName}}” is not a Profile file name: a name without a folder, in letters, digits, “-”, “_” or “.”, ending with “.md”.',
  missingProfileFile:
    '{{candidateName}}’s Profile has no file “{{fileName}}”. The Profile page or “jf profile {{candidateId}}” creates it.',
  duplicateProfileFile: '{{candidateName}}’s Profile already has a file “{{fileName}}”. Choose another name.',
  noFileReceived: 'No file received. Drop a PDF or choose it, then try again.',
  invalidUploadName:
    '“{{fileName}}” is not an Upload name: a name without a folder, in letters, digits, “-”, “_” or “.”, ending with “.pdf”.',
  notAPdf: '“{{fileName}}” is not a PDF. Export the document as PDF, then drop it again.',
  uploadTooLarge: '“{{fileName}}” exceeds {{maxMegabytes}} MB. Shrink the PDF (fewer images), then drop it again.',
  missingUpload: '{{candidateName}}’s Profile has no Upload “{{fileName}}”.',
  uploadGone: '“{{upload}}” is no longer in {{candidateName}}’s Profile: drop it again to convert it.',
  conversionWithoutFile: 'The conversion of “{{upload}}” wrote no Markdown file.\n{{log}}',
  conversionRefused:
    'The conversion of “{{upload}}” is refused: “{{fileName}}” is neither “cv.md”, nor a letter “letter-<employer>-<year>.md”, nor an Annex “annex-<subject>.md”.',
  conversionOverwrite:
    '“{{upload}}” converts into “{{fileName}}”, which the Profile already has: it is not overwritten. Delete or rename “{{fileName}}”, then run the conversion again.',

  // The AI sessions and what they write
  sessionFailed: 'The Claude Code session failed: its log says why. Run the module again.',
  sessionStopped: 'Claude Code stopped (code {{exitCode}}): {{output}}',
  sessionTimedOut:
    'The Claude Code session ran past its maximum duration ({{minutes}} minutes) and was stopped. Run the module again; if it comes back, “ssh {{host}}”, then run “claude” alone to see what it waits for (login, usage limit, a question).',
  claudeLoginRequired:
    'Claude Code refused the session: it is no longer logged in on {{host}}. Log back in: “ssh {{host}}”, run “claude” then type “/login”, then run the module again.\n{{result}}',
  claudeUsageLimit:
    'Claude Code has reached its usage limit on {{host}}. Run the module again once the limit is lifted, at the time it gives.\n{{result}}',
  sessionKilled:
    'Claude Code was stopped by the signal {{signal}}: its process was killed, or the machine ran out of memory. Try again; if it comes back, “ssh {{host}}”, then run “claude” alone to read its message.',
  sessionNotLaunched: 'Claude Code could not be launched ({{reason}}). Install “claude” and log in to it.',
  interactiveSessionFailed:
    'The Claude Code session stopped on an error (code {{status}}). Run the command again; if the error comes back, run “claude” alone to read its message.',
  conversionSessionFailed: 'Claude Code did not convert the Upload “{{upload}}”: {{log}}',
  extractionSessionFailed: 'Claude Code did not read the fields of the Job Description: {{log}}',
  invalidExtraction: 'The fields read in the Job Description are not valid ({{fileName}}): {{problem}}.',
  extractionNotWritten: 'the session did not write them',
  extractionInvented: 'is not found as is in the Job Description: the session invented it',
  noLevelOneHeading: 'it does not start with a level 1 heading (“#”)',
  noSourcesSection: 'it has no “## Sources” section with at least one link',
  recipientsFormat: 'it does not follow the requested format ({{detail}})',
  inventedAddress: 'the address {{email}} is not in the field {{field}} of the Posting',

  // A mistake of a module's author, never of the Candidate
  parameterUndeclared:
    'The {{parameterName}} Parameter of the {{moduleName}} module is not declared with parameter(): declare it so in the module.',

  // The folder of a Posting kept its name while the extraction read a new title
  postingFolderNotMoved:
    'The folder of Posting {{reference}} could not follow its new title, toward {{to}}: {{reason}}. The Posting keeps its title: free this location, then run the extraction again.',

  // API Géo, which places the Postings on the map
  apiGeoUnreachable: 'API Géo is unreachable ({{url}}): {{reason}}. Check the connection, then run again.',
  apiGeoStatus: 'API Géo answered HTTP {{status}} for {{url}}. Run again later.',
  apiGeoFormatChanged:
    'API Géo answered in an unexpected format for {{url}}: {{problem}}. Its API may have changed: report it, the Postings stay off the map meanwhile.',
  // Stored on a Detection that went on while API Géo was down, which placed nothing on the map
  postingsNotLocated:
    'Postings saved without coordinates, off the map until the next Detection locates them: {{reason}}',
};
