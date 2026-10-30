// The messages of the errors a Candidate reads, each saying what to do. Those of a coded error
// (src/domain/error.ts) are keyed by its code, in camelCase; #39 keys the others once their codes exist.
export const ERROR_EN = {
  // A name the message quotes, such as each label of a list
  quote: '“{{text}}”',
  // Between the Statuses a Posting can move to
  orSeparator: ' or ',

  // The coded errors
  dataLayoutMixed:
    'The data folder mixes the old layout and the new one: “{{frenchPath}}” and “{{englishPath}}” both exist. Merge the first into the second by hand, delete it, then start again.',
  dataLayoutUnexpected:
    'The data folder has an unexpected entry: “{{frenchPath}}” is not of the kind the tool knows. Move it out of the data folder, then start again.',
  configInvalid:
    'Invalid config: {{configPath}}\n{{problem}}\nFix it so that it is imported into the database, or delete it: Candidates and their Watches are now set in the front.',
  configKeysMixed:
    'The config {{configPath}} holds both the old key “{{frenchKey}}” and its new name “{{englishKey}}”. Keep only “{{englishKey}}”, merging into it what “{{frenchKey}}” holds, then start again.',

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

  // Statuses
  statusChange: 'Posting {{reference}} is {{statusLabel}}: it can only move to {{nextLabels}}.',
  statusChangeAfterApplied:
    'Posting {{reference}} is {{statusLabel}}: it can only move to {{nextLabels}}, since Applied is never undone: its Chosen Letter is the one sent.',
  letterFrozen:
    'Posting {{reference}} was Applied: its Chosen Letter is frozen as sent. It is no longer edited, regenerated or replaced by another Version.',

  // Modules, jobs and Versions
  unknownModule: 'Unknown module: {{name}}. Modules: {{names}}.',
  unknownArtifact: 'Unknown Artifact: {{name}}. Artifacts: {{names}}.',
  // The front shows it beside the button of the missing Artifact, the CLI with the command that lifts it
  missingArtifactForFront:
    'Posting {{reference}} has no Chosen {{missingLabel}}, which the {{moduleLabel}} relies on: start the {{missingLabel}} first.',
  missingArtifactForCli:
    'Posting {{reference}} has no Chosen {{missingLabel}}, which the {{moduleLabel}} relies on. Produce it first: jf run {{missingArtifact}} {{reference}}.',
  missingOutput: 'The expected file {{outputPath}} is missing.',
  emptyOutput: 'The expected file {{outputPath}} is empty.',
  malformedOutput: 'The file {{outputPath}} is malformed: {{formatError}}.',
  notImported: 'Posting {{reference}} was not imported: its fields come from its Source, without extraction.',
  unknownJob: 'Unknown job: {{jobId}}. Its number is the one “jf run” or “jf import” printed.',
  interruptedJob: 'Interrupted: the worker stopped during this job. Running the module again creates a new Version.',
  visualizationNotEditable:
    'The Visualization is not edited by hand: it follows the Chosen Interview Brief. Correct that one, then run the Visualization of Posting {{reference}} again.',
  noChosenVersionToEdit:
    'Posting {{reference}} has no Chosen Version of {{artifact}} to edit: “jf run {{artifact}} {{reference}}” produces one.',
  draftNotEditable:
    'The Draft is never edited: it keeps what the AI wrote. Correct the Letter of Posting {{reference}}.',
  unknownVersion:
    'Unknown Version: {{artifact}} v{{number}} of Posting {{reference}}. “jf versions {{reference}} {{artifact}}” lists its Versions.',
  versionFailed:
    'Version {{artifact}} v{{number}} of Posting {{reference}} is failed: only a ready Version can be chosen.',
  versionRunning:
    'Version {{artifact}} v{{number}} of Posting {{reference}} is in progress: only a ready Version can be chosen.',
  notAVersionFile: '“{{fileName}}” is not a file of the Chosen Version of {{artifact}} of Posting {{reference}}.',
  visualizationWithoutPage:
    'Visualization v{{number}} of Posting {{reference}} has no page: run the Visualization again.',
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
    'The conversion of “{{upload}}” is refused: “{{fileName}}” is neither “cv.md” nor a letter “letter-<employer>-<year>.md”.',
  conversionOverwrite:
    '“{{upload}}” converts into “{{fileName}}”, which the Profile already has: it is not overwritten. Delete or rename “{{fileName}}”, then run the conversion again.',

  // The AI sessions and what they write
  sessionStopped: 'Claude Code stopped (code {{exitCode}}): {{output}}',
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
  notACompletePage: 'it is not a complete HTML page, from “<!DOCTYPE html>” to “</html>”',
  hasScript: 'it holds a script, which the front does not run',
  recipientsFormat: 'it does not follow the requested format ({{detail}})',
  inventedAddress: 'the address {{email}} is not in the field {{field}} of the Posting',

  // API Géo, which places the Postings on the map
  apiGeoUnreachable: 'API Géo is unreachable ({{url}}): {{reason}}. Check the connection, then run again.',
  apiGeoStatus: 'API Géo answered HTTP {{status}} for {{url}}. Run again later.',
};
