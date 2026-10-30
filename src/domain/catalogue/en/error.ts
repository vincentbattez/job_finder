import type { Artifact } from '#/domain/index.ts';

const quote = (text: string) => `“${text}”`;

// The messages of the errors a Candidate reads, each saying what to do. Those of a coded error
// (src/domain/error.ts) are keyed by its code, in camelCase; #39 keys the others once their codes exist.
export const ERROR_EN = {
  // The coded errors
  dataLayoutMixed: (frenchPath: string, englishPath: string) =>
    `The data folder mixes the old layout and the new one: ${quote(frenchPath)} and ${quote(englishPath)} both exist. Merge the first into the second by hand, delete it, then start again.`,
  dataLayoutUnexpected: (frenchPath: string) =>
    `The data folder has an unexpected entry: ${quote(frenchPath)} is not of the kind the tool knows. Move it out of the data folder, then start again.`,

  // The data folder
  invalidConfig: (configPath: string, problem: string) =>
    `Invalid config: ${configPath}\n${problem}\nFix it so that it is imported into the database, or delete it: Candidates and their Watches are now set in the front.`,
  missingJobDescription: (reference: string, filePath: string) =>
    `Job Description not found for Posting ${reference}: ${filePath}. Put it back there, where the tool reads it.`,

  // Candidates, Postings and their lookups
  unknownCandidate: (candidateId: string) => `Unknown Candidate: ${candidateId}. “jf candidates” lists the Candidates.`,
  invalidCandidateId: (candidateId: string) =>
    `${quote(candidateId)} is not a Candidate identifier: lowercase letters without accents and digits, separated by “-”, such as “lea” or “jean-pierre”.`,
  emptyCandidateName: 'The Candidate’s name is empty: fill it in.',
  duplicateCandidateId: (candidateId: string) =>
    `A Candidate already has the identifier ${candidateId}: choose another one.`,
  invalidDefaultDeadlinePeriod: 'The Default Deadline Period is a whole number of months, at least 1.',
  unknownPosting: (reference: string) => `Unknown Posting: ${reference}. “jf list <candidate>” lists the Postings.`,
  ambiguousPosting: (reference: string) =>
    `Several Postings have the reference ${reference}, for different Candidates: their Watches follow the same Source, and the tool cannot choose between them yet. Report it so that it tells them apart.`,

  // Watches and Sources
  unknownWatch: (candidateName: string, watchId: string) =>
    `${candidateName} has no Watch ${watchId}: reload the page of their Profile.`,
  unknownSource: (sourceId: string, knownList: string, watchId: string | undefined) => {
    const ofWatch = watchId === undefined ? '' : ` for the Watch ${watchId}`;
    return `Unknown Source${ofWatch}: ${sourceId}. Choose one of ${knownList} in the Watches of the Profile.`;
  },
  watchParameters: (watchId: string, sourceName: string, labelList: string[]) =>
    `The Watch ${watchId} does not give the ${sourceName} Source the Parameters it expects: correct ${labelList.map((label) => quote(label)).join(', ')} in the Profile of its Candidate.`,
  sourceParameters: (sourceName: string, labelList: string[]) =>
    `The ${sourceName} Source expects other Parameters: fill in ${labelList.map((label) => quote(label)).join(', ')}.`,

  // Statuses
  statusChange: (reference: string, statusLabel: string, nextLabelList: string[], hasBeenApplied: boolean) =>
    `Posting ${reference} is ${statusLabel}: it can only move to ${nextLabelList.join(' or ')}${hasBeenApplied ? ', since Applied is never undone: its Chosen Letter is the one sent' : ''}.`,
  letterFrozen: (reference: string) =>
    `Posting ${reference} was Applied: its Chosen Letter is frozen as sent. It is no longer edited, regenerated or replaced by another Version.`,

  // Modules, jobs and Versions
  unknownModule: (name: string, nameList: string[]) => `Unknown module: ${name}. Modules: ${nameList.join(', ')}.`,
  unknownArtifact: (name: string, nameList: string[]) =>
    `Unknown Artifact: ${name}. Artifacts: ${nameList.join(', ')}.`,
  // The front shows it beside the button of the missing Artifact, the CLI with the command that lifts it
  missingArtifactForFront: (reference: string, missingLabel: string, moduleLabel: string) =>
    `Posting ${reference} has no Chosen ${missingLabel}, which the ${moduleLabel} relies on: start the ${missingLabel} first.`,
  missingArtifactForCli: (reference: string, missingLabel: string, moduleLabel: string, missingArtifact: Artifact) =>
    `Posting ${reference} has no Chosen ${missingLabel}, which the ${moduleLabel} relies on. Produce it first: jf run ${missingArtifact} ${reference}.`,
  missingOutput: (outputPath: string) => `The expected file ${outputPath} is missing.`,
  emptyOutput: (outputPath: string) => `The expected file ${outputPath} is empty.`,
  malformedOutput: (outputPath: string, formatError: string) => `The file ${outputPath} is malformed: ${formatError}.`,
  notImported: (reference: string) =>
    `Posting ${reference} was not imported: its fields come from its Source, without extraction.`,
  unknownJob: (jobId: number) =>
    `Unknown job: ${String(jobId)}. Its number is the one “jf run” or “jf import” printed.`,
  interruptedJob: 'Interrupted: the worker stopped during this job. Running the module again creates a new Version.',
  visualizationNotEditable: (reference: string) =>
    `The Visualization is not edited by hand: it follows the Chosen Interview Brief. Correct that one, then run the Visualization of Posting ${reference} again.`,
  noChosenVersionToEdit: (reference: string, artifact: string) =>
    `Posting ${reference} has no Chosen Version of ${artifact} to edit: “jf run ${artifact} ${reference}” produces one.`,
  draftNotEditable: (reference: string) =>
    `The Draft is never edited: it keeps what the AI wrote. Correct the Letter of Posting ${reference}.`,
  unknownVersion: (reference: string, artifact: string, number: number) =>
    `Unknown Version: ${artifact} v${String(number)} of Posting ${reference}. “jf versions ${reference} ${artifact}” lists its Versions.`,
  versionNotReady: (reference: string, artifact: string, number: number, isFailed: boolean) =>
    `Version ${artifact} v${String(number)} of Posting ${reference} is ${isFailed ? 'failed' : 'in progress'}: only a ready Version can be chosen.`,
  notAVersionFile: (fileName: string, artifact: string, reference: string) =>
    `${quote(fileName)} is not a file of the Chosen Version of ${artifact} of Posting ${reference}.`,
  visualizationWithoutPage: (reference: string, number: number) =>
    `Visualization v${String(number)} of Posting ${reference} has no page: run the Visualization again.`,
  noChosenLetter: (reference: string) =>
    `Posting ${reference} has no Chosen Letter. Produce it: jf run letter ${reference}.`,

  // The Profile and its Uploads
  invalidProfileFileName: (fileName: string) =>
    `${quote(fileName)} is not a Profile file name: a name without a folder, in letters, digits, “-”, “_” or “.”, ending with “.md”.`,
  missingProfileFile: (candidateName: string, fileName: string, candidateId: string) =>
    `${candidateName}’s Profile has no file ${quote(fileName)}. The Profile page or “jf profile ${candidateId}” creates it.`,
  duplicateProfileFile: (candidateName: string, fileName: string) =>
    `${candidateName}’s Profile already has a file ${quote(fileName)}. Choose another name.`,
  noFileReceived: 'No file received. Drop a PDF or choose it, then try again.',
  invalidUploadName: (fileName: string) =>
    `${quote(fileName)} is not an Upload name: a name without a folder, in letters, digits, “-”, “_” or “.”, ending with “.pdf”.`,
  notAPdf: (fileName: string) => `${quote(fileName)} is not a PDF. Export the document as PDF, then drop it again.`,
  uploadTooLarge: (fileName: string, maxMegabytes: number) =>
    `${quote(fileName)} exceeds ${String(maxMegabytes)} MB. Shrink the PDF (fewer images), then drop it again.`,
  missingUpload: (candidateName: string, fileName: string) =>
    `${candidateName}’s Profile has no Upload ${quote(fileName)}.`,
  uploadGone: (upload: string, candidateName: string) =>
    `${quote(upload)} is no longer in ${candidateName}’s Profile: drop it again to convert it.`,
  conversionWithoutFile: (upload: string, log: string) =>
    `The conversion of ${quote(upload)} wrote no Markdown file.\n${log}`,
  conversionRefused: (upload: string, fileName: string) =>
    `The conversion of ${quote(upload)} is refused: ${quote(fileName)} is neither “cv.md” nor a letter “letter-<employer>-<year>.md”.`,
  conversionOverwrite: (upload: string, fileName: string) =>
    `${quote(upload)} converts into ${quote(fileName)}, which the Profile already has: it is not overwritten. Delete or rename ${quote(fileName)}, then run the conversion again.`,
};
