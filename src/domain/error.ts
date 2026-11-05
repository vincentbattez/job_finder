import { z } from 'zod/v4';

import type { CLI_EN } from './catalogue/en/cli.ts';
import type { ERROR_EN } from './catalogue/en/error.ts';
import type { NOTIFICATION_EN } from './catalogue/en/notification.ts';

// The keys of an area whose text is a message, as opposed to a group of texts
type MessageKeyOf<Resource> = Extract<
  { [Key in keyof Resource]: Resource[Key] extends string ? Key : never }[keyof Resource],
  string
>;

// The message of a code: an i18next key, namespace first, of the areas that word failures (ADR-0012)
type ErrorMessageKey =
  | `error:${MessageKeyOf<typeof ERROR_EN>}`
  | `cli:${MessageKeyOf<typeof CLI_EN>}`
  | `notification:${MessageKeyOf<typeof NOTIFICATION_EN>}`;

// Every failure the Candidate can read, one code each, so that the front, the CLI, a job and a test
// tell which failure it is whatever its message says (ADR-0015). A code is one line: its meaning in
// the comment, its message key on the right, which the typecheck refuses if en/ or fr/ lacks it.
// A module's failure is worded in its own copy, the only place allowed to name it (ADR-0010): its code
// takes that text as detail.
export const ERROR_CATALOGUE = {
  // Something our code did not foresee threw: a library, the database, the network
  unexpected: 'error:unexpected',
  // An input does not follow the schema of its action
  invalid_input: 'error:invalidInput',
  // A button of the front posts an intent its route does not know: its form is older than the page's code
  unknown_intent: 'error:unknownIntent',

  // The data folder and the config an older jf left
  // An entry of the data folder exists both in the French layout and in the English one
  data_layout_mixed: 'error:dataLayoutMixed',
  // A known entry of the French layout is not of the kind the tool expects, a file for a folder or the reverse
  data_layout_unexpected: 'error:dataLayoutUnexpected',
  // The config an older jf left does not follow the schema it is imported with
  config_invalid: 'error:configInvalid',
  // The config an older jf left holds a French key and its English name at once
  config_keys_mixed: 'error:configKeysMixed',
  // The Job Description of a Posting is no longer in its folder
  missing_job_description: 'error:missingJobDescription',

  // Candidates and Postings
  // No Candidate has this identifier
  unknown_candidate: 'error:unknownCandidate',
  // An identifier a Candidate cannot have
  invalid_candidate_id: 'error:invalidCandidateId',
  // A Candidate's name is empty
  empty_candidate_name: 'error:emptyCandidateName',
  // Another Candidate already has this identifier
  duplicate_candidate_id: 'error:duplicateCandidateId',
  // A Default Deadline Period that is not a whole number of months
  invalid_default_deadline_period: 'error:invalidDefaultDeadlinePeriod',
  // No Posting has this reference
  unknown_posting: 'error:unknownPosting',
  // Several Postings, of different Candidates, have this reference
  ambiguous_posting: 'error:ambiguousPosting',

  // Detections, Watches and Sources
  // A Detection is asked for while another one runs (ADR-0014)
  detection_running: 'error:detectionRunning',
  // A Candidate has no Watch with this identifier
  unknown_watch: 'error:unknownWatch',
  // No Source has this identifier
  unknown_source: 'error:unknownSource',
  // A saved Watch names a Source the registry no longer has
  unknown_source_of_watch: 'error:unknownSourceOfWatch',
  // A saved Watch does not give its Source the Parameters it expects
  watch_parameters: 'error:watchParameters',
  // The Parameters typed for a Source are missing or wrong
  source_parameters: 'error:sourceParameters',
  // The site of a Source does not answer
  source_unreachable: 'error:moduleFailure',
  // The site of a Source answers with an HTTP error
  source_status: 'error:moduleFailure',
  // What a Source answers is no longer in the format its module reads
  source_format_changed: 'error:moduleFailure',
  // A Detection Summary was not sent
  notifications_not_sent: 'error:notificationsNotSent',
  // A notification of a job was not sent
  notification_not_sent: 'notification:notSent',
  // The Detection Summary of a Candidate was not sent
  summary_not_sent: 'notification:summaryNotSent',

  // Statuses
  // A Posting cannot move to this Status from its own
  status_change: 'error:statusChange',
  // A New Posting moves only by being kept or dismissed (ADR-0018)
  new_not_sorted: 'error:newNotSorted',
  // Only a New Posting is kept: one already sorted is not sorted again
  not_new: 'error:notNew',
  // Marking Applied over a Draft Letter takes an answer: validate it, or apply without a Letter (spec #125)
  letter_still_draft: 'error:letterStillDraft',
  // A Hired or Rejected Posting cannot go back to To Apply: only In progress is undone, Archived or not
  to_apply_after_outcome: 'error:toApplyAfterOutcome',
  // An Applied Posting with an Interview cannot go back to To Apply: the Interview proves its Letter was sent
  to_apply_with_interview: 'error:toApplyWithInterview',
  // The Chosen Letter of an Applied Posting is frozen as sent
  letter_frozen: 'error:letterFrozen',

  // Interviews
  // An Interview is added to a To Apply Posting, which has no Application yet
  interview_without_application: 'error:interviewWithoutApplication',
  // The Posting has no Interview with this number
  unknown_interview: 'error:unknownInterview',
  // An Artifact attached to an Interview is named without one
  interview_required: 'error:interviewRequired',
  // An Artifact attached to the Posting is named with an Interview
  interview_not_expected: 'error:interviewNotExpected',

  // Modules, jobs and Versions
  // No module has this name
  unknown_module: 'error:unknownModule',
  // No Artifact has this name
  unknown_artifact: 'error:unknownArtifact',
  // An Artifact the module relies on has no Chosen Version
  missing_artifact: 'error:missingArtifactForCli',
  // A run is asked to read an Input it does not have
  unknown_input: 'error:unknownInput',
  // A run is asked without an Input its Artifact requires
  required_input_unchecked: 'error:requiredInputUnchecked',
  // The extraction is asked for a Posting its Source gave the fields of
  not_imported: 'error:notImported',
  // No job has this number
  unknown_job: 'error:unknownJob',
  // The worker stopped while the job ran
  interrupted_job: 'error:interruptedJob',
  // A job waits or runs while no worker is running to take it
  worker_not_running: 'error:workerNotRunning',
  // A job runs past its maximum duration: the worker that runs it is stuck
  job_overdue: 'error:jobOverdue',
  // The Claude Code session of a job ended on an error
  session_failed: 'error:sessionFailed',
  // A file the module must write is missing
  missing_output: 'error:missingOutput',
  // A file the module must write is empty
  empty_output: 'error:emptyOutput',
  // A file the module wrote does not have its format
  malformed_output: 'error:malformedOutput',
  // An Artifact to edit has no Chosen Version
  no_chosen_version_to_edit: 'error:noChosenVersionToEdit',
  // The Original of a Version is asked to be edited, while it keeps what the AI wrote
  original_not_editable: 'error:originalNotEditable',
  // A Version the Candidate brings has no text
  empty_brought_version: 'error:emptyBroughtVersion',
  // An Artifact has no Version with this number
  unknown_version: 'error:unknownVersion',
  // A failed Version is chosen
  version_failed: 'error:versionFailed',
  // A Version in progress is chosen
  version_running: 'error:versionRunning',
  // A file asked for is not one of the Chosen Version
  not_a_version_file: 'error:notAVersionFile',
  // A Posting has no Chosen Letter to send
  no_chosen_letter: 'error:noChosenLetter',

  // The Profile and its Uploads
  // A name that is not that of a Profile file
  invalid_profile_file_name: 'error:invalidProfileFileName',
  // The Profile has no file with this name
  missing_profile_file: 'error:missingProfileFile',
  // The Profile already has a file with this name
  duplicate_profile_file: 'error:duplicateProfileFile',
  // An Upload was sent without its file
  no_file_received: 'error:noFileReceived',
  // A name that is not that of an Upload
  invalid_upload_name: 'error:invalidUploadName',
  // An Upload that is not a PDF
  not_a_pdf: 'error:notAPdf',
  // An Upload over the size limit
  upload_too_large: 'error:uploadTooLarge',
  // The Profile has no Upload with this name
  missing_upload: 'error:missingUpload',
  // The Upload to convert left the Profile before its conversion
  upload_gone: 'error:uploadGone',
  // The conversion of an Upload wrote no file
  conversion_without_file: 'error:conversionWithoutFile',
  // The conversion of an Upload wrote a file the Profile does not take
  conversion_refused: 'error:conversionRefused',
  // The conversion of an Upload would overwrite a different Profile file
  conversion_overwrite: 'error:conversionOverwrite',

  // The AI sessions and what they write
  // Claude Code could not be launched
  session_not_launched: 'error:sessionNotLaunched',
  // An interactive Claude Code session ended on an error
  interactive_session_failed: 'error:interactiveSessionFailed',
  // A headless Claude Code session ran past its maximum duration, and was stopped
  session_timed_out: 'error:sessionTimedOut',
  // Claude Code refused the session: it is no longer logged in on the machine of the worker
  claude_login_required: 'error:claudeLoginRequired',
  // Claude Code refused the session: its subscription reached its usage limit
  claude_usage_limit: 'error:claudeUsageLimit',
  // A Claude Code session was killed by a signal, from outside or for lack of memory
  session_killed: 'error:sessionKilled',
  // The session converting an Upload failed
  conversion_session_failed: 'error:conversionSessionFailed',
  // The folder of a Posting cannot take the name of its new title: the Posting keeps its title
  posting_folder_not_moved: 'error:postingFolderNotMoved',
  // The session reading the fields of a Job Description failed
  extraction_session_failed: 'error:extractionSessionFailed',
  // The fields read in a Job Description are not valid
  invalid_extraction: 'error:invalidExtraction',

  // API Géo, which places the Postings on the map
  // API Géo does not answer
  api_geo_unreachable: 'error:apiGeoUnreachable',
  // API Géo answers with an HTTP error
  api_geo_status: 'error:apiGeoStatus',
  // API Géo answers something other than its list of communes: its API changed
  api_geo_format_changed: 'error:apiGeoFormatChanged',

  // Modules of a family, their Parameters and the Notification Channels (ADR-0010)
  // A module declares a Parameter without parameter(), a mistake of its author
  parameter_undeclared: 'error:parameterUndeclared',
  // The Parameters of a Notification Channel are missing or wrong
  channel_parameters: 'notification:incompleteChannel',
  // A Notification Channel without a check is tried
  untestable_channel: 'notification:untestableChannel',
  // The choices of a Parameter that has none are asked for
  no_choices: 'notification:noChoices',
  // A Candidate has chosen no Notification Channel
  no_channel: 'notification:noChannel',
  // No Notification Channel has this identifier
  unknown_channel: 'notification:unknownChannel',
  // A Notification Channel lacks the Parameters to reach its service
  channel_not_configured: 'error:moduleFailure',
  // The service of a Notification Channel does not answer
  channel_unreachable: 'error:moduleFailure',
  // The service of a Notification Channel refuses its credentials
  channel_token_refused: 'error:moduleFailure',
  // The service of a Notification Channel refuses the request, such as an HTTP error or an e-mail refused
  channel_status: 'error:moduleFailure',

  // The CLI
  // No command has this name
  unknown_command: 'cli:unknownCommand',
  // A file named on the command line cannot be read
  unreadable_file: 'cli:unreadableFile',
  // The file a command writes in the current folder cannot be written
  file_write_failed: 'cli:fileWriteFailed',
  // The Candidate closed the question without answering
  no_choice: 'cli:noChoice',
  // An answer that is none of the numbers offered
  invalid_choice: 'cli:invalidChoice',
  // There is no Candidate to choose from
  no_candidate: 'cli:noCandidate',
  // The Candidate has no Posting to choose from
  no_posting: 'cli:noPosting',
  // The Posting has no Artifact to choose from
  no_artifact: 'cli:noArtifact',
  // jf instructions gets an operation it does not know
  unknown_operation: 'cli:unknownOperation',
  // The extraction jf import waited for failed
  extraction_failed: 'cli:extractionFailed',
  // The job jf run waited for failed
  run_failed: 'cli:runFailed',
  // A command lacks its arguments: each usage tells which
  import_usage: 'cli:importUsage',
  list_usage: 'cli:listUsage',
  run_usage: 'cli:runUsage',
  recipients_usage: 'cli:recipientsUsage',
  versions_usage: 'cli:versionsUsage',
  validate_usage: 'cli:validateUsage',
  status_usage: 'cli:statusUsage',
  profile_usage: 'cli:profileUsage',
  instructions_usage: 'cli:instructionsUsage',
  notes_usage: 'cli:notesUsage',
  interviews_usage: 'cli:interviewsUsage',
  ical_usage: 'cli:icalUsage',
} satisfies Record<string, ErrorMessageKey>;

export type ErrorCode = keyof typeof ERROR_CATALOGUE;

function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && Object.hasOwn(ERROR_CATALOGUE, value);
}

// The code a failed job keeps, as the database holds it
export const ERROR_CODE_SCHEMA = z.custom<ErrorCode>(isErrorCode);
