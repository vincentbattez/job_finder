import { z } from 'zod/v4';

// The brand marks a value parsed by a domain schema, so that a raw row cannot pass for one
// (ADR-0005); an enum stays unbranded, so that its literals can be written in the code
export const CANDIDATE_SCHEMA = z.object({ id: z.string(), name: z.string() }).brand<'Domain'>();

export type Candidate = z.infer<typeof CANDIDATE_SCHEMA>;

// The Default Deadline Period every Candidate shares, in months
export const DEFAULT_DEADLINE_PERIOD_SCHEMA = z.object({ months: z.int().positive() }).brand<'Domain'>();

export type DefaultDeadlinePeriod = z.infer<typeof DEFAULT_DEADLINE_PERIOD_SCHEMA>;

// The config an older jf left, imported once and no longer read (ADR-0011): its path, null once
// deleted
export const OBSOLETE_CONFIG_SCHEMA = z.object({ path: z.string().nullable() }).brand<'Domain'>();

export type ObsoleteConfig = z.infer<typeof OBSOLETE_CONFIG_SCHEMA>;

// The Parameters of a module of a family, as JSON: only the module's schema knows their shape (ADR-0010)
export const PARAMETERS_SCHEMA = z.record(z.string(), z.json()).brand<'Domain'>();

export type Parameters = z.infer<typeof PARAMETERS_SCHEMA>;

// A Watch follows one of the Sources, which alone knows its Parameters, its Zone among them
// (ADR-0010). detectedAt stays null until a Detection of the Watch went through: until then, it is
// the first launch.
export const WATCH_SCHEMA = z
  .object({
    id: z.string(),
    candidateId: z.string(),
    source: z.string(),
    parameters: PARAMETERS_SCHEMA,
    detectedAt: z.date().nullable(),
  })
  .brand<'Domain'>();

export type Watch = z.infer<typeof WATCH_SCHEMA>;

// A Posting as a Source lists it, before its detail page is read. An imported Job Description has no
// link, and is published the day it is imported, so that it expires like any Posting.
export const LISTED_POSTING_SCHEMA = z
  .object({ reference: z.string(), title: z.string(), url: z.string().nullable(), publishedAt: z.date() })
  .brand<'Domain'>();

export type ListedPosting = z.infer<typeof LISTED_POSTING_SCHEMA>;

// What the detail page of a Posting says, its fields kept as published, and its Job Description
export const JOB_DESCRIPTION_SCHEMA = z
  .object({
    deadline: z.date().nullable(),
    employer: z.string().nullable(),
    workplace: z.string().nullable(),
    applicationEmail: z.string().nullable(),
    contact1: z.string().nullable(),
    contact2: z.string().nullable(),
    markdown: z.string(),
  })
  .brand<'Domain'>();

export type JobDescription = z.infer<typeof JOB_DESCRIPTION_SCHEMA>;

// The file of the Job Description in the folder of its Posting, where every session runs
export const JOB_DESCRIPTION_FILE_NAME = 'job-description.md';

// Where a Posting is: its city, and the region and coordinates API Géo gives its commune. The city
// stays as read, without region nor coordinates, while API Géo knows no commune by that name.
const LOCATION_SHAPE = {
  city: z.string().nullable(),
  region: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
};

export const LOCATION_SCHEMA = z.object(LOCATION_SHAPE).brand<'Domain'>();

export type Location = z.infer<typeof LOCATION_SCHEMA>;

export const STATUS_SCHEMA = z.enum(['to_apply', 'applied', 'archived']);

export type Status = z.infer<typeof STATUS_SCHEMA>;

// Another Posting of the Candidate, named by its reference
const LINKED_POSTING_SCHEMA = z.object({ reference: z.string() });

export const POSTING_SCHEMA = z
  .object({
    ...LOCATION_SHAPE,
    id: z.int(),
    candidateId: z.string(),
    // Where it comes from: the Source of the Watch that detected it, or the import of its Job Description
    source: z.string(),
    reference: z.string(),
    title: z.string(),
    url: z.string().nullable(),
    publishedAt: z.date().nullable(),
    deadline: z.date().nullable(),
    employer: z.string().nullable(),
    workplace: z.string().nullable(),
    applicationEmail: z.string().nullable(),
    contact1: z.string().nullable(),
    contact2: z.string().nullable(),
    status: STATUS_SCHEMA,
    // When it was first marked Applied, null if never
    appliedAt: z.date().nullable(),
    isInZone: z.boolean(),
    isExpired: z.boolean(),
    // The Posting it publishes again, and the Postings that publish it again
    repostOf: LINKED_POSTING_SCHEMA.nullable(),
    repostList: z.array(LINKED_POSTING_SCHEMA),
  })
  .brand<'Domain'>();

export type Posting = z.infer<typeof POSTING_SCHEMA>;

// What a Detection found for one Watch, and why each notification it could not send failed. On
// the first launch, the Postings already online are imported without triggering anything.
export const DETECTION_SCHEMA = z
  .object({
    watchId: z.string(),
    candidateId: z.string(),
    isFirstLaunch: z.boolean(),
    newPostingList: z.array(POSTING_SCHEMA),
    nearMissList: z.array(LISTED_POSTING_SCHEMA),
    notificationFailureList: z.array(z.string()),
  })
  .brand<'Domain'>();

export type Detection = z.infer<typeof DETECTION_SCHEMA>;

export const ARTEFACT_SCHEMA = z.enum(['recherche', 'lettre', 'fiche_entretien', 'visualisation']);

export type Artefact = z.infer<typeof ARTEFACT_SCHEMA>;

// The fixed part of the prompt is not among the Instructions: no one changes it (ADR-0003)
export const MODULE_INSTRUCTIONS_SCHEMA = z
  .object({ module: ARTEFACT_SCHEMA, defaultInstructions: z.string(), candidateInstructions: z.string().nullable() })
  .brand<'Domain'>();

export type ModuleInstructions = z.infer<typeof MODULE_INSTRUCTIONS_SCHEMA>;

// A Version that another Version read as input, of its own Posting or of another one
const READ_VERSION_SCHEMA = z.object({
  artefact: ARTEFACT_SCHEMA,
  number: z.int(),
  posting: z.object({ reference: z.string() }),
});

// Each launch of a module creates a new Version, which keeps the Instructions it was produced with
// and the Versions it read
export const VERSION_SCHEMA = z
  .object({
    artefact: ARTEFACT_SCHEMA,
    number: z.int(),
    isRetenue: z.boolean(),
    state: z.enum(['running', 'ready', 'failed']),
    instructions: z.string(),
    hasCandidateInstructions: z.boolean(),
    inputList: z.array(READ_VERSION_SCHEMA),
    createdAt: z.date(),
  })
  .brand<'Domain'>();

export type Version = z.infer<typeof VERSION_SCHEMA>;

// An AI module is named after the Artefact it produces; the extraction fills the imported Posting
// itself, without a Version
const MODULE_SCHEMA = z.enum([...ARTEFACT_SCHEMA.options, 'extraction']);

export type Module = z.infer<typeof MODULE_SCHEMA>;

const JOB_STATE_SCHEMA = z.enum(['queued', 'running', 'done', 'failed']);

export const JOB_SCHEMA = z
  .object({
    id: z.int(),
    module: MODULE_SCHEMA,
    posting: POSTING_SCHEMA,
    state: JOB_STATE_SCHEMA,
    log: z.string(),
    sessionId: z.string().nullable(),
    version: VERSION_SCHEMA.nullable(),
  })
  .brand<'Domain'>();

export type Job = z.infer<typeof JOB_SCHEMA>;

// The field of the Posting a recommendation comes from, as published: the mail de candidature or a
// contact
const CONTACT_FIELD_SCHEMA = z.enum(['applicationEmail', 'contact1', 'contact2']);

const ADDRESS_SCHEMA = z.object({ email: z.email(), source: CONTACT_FIELD_SCHEMA });

// Each address and the salutation keep the field they come from, so that none is invented; a
// generic salutation comes from no field
export const RECIPIENTS_SCHEMA = z
  .object({
    to: ADDRESS_SCHEMA.nullable(),
    ccList: z.array(ADDRESS_SCHEMA),
    salutation: z.object({ text: z.string().min(1), source: CONTACT_FIELD_SCHEMA.nullable() }),
    justification: z.string().min(1),
  })
  .brand<'Domain'>();

export type Recipients = z.infer<typeof RECIPIENTS_SCHEMA>;

// A Markdown file of the data folder: of the Profile of a Candidate, such as facts.md or cv.md, or of a
// Version, such as the Brouillon or the Lettre of a Lettre Version
const MARKDOWN_FILE_SHAPE = { fileName: z.string(), markdown: z.string() };

export const MARKDOWN_FILE_SCHEMA = z.object(MARKDOWN_FILE_SHAPE).brand<'Domain'>();

export type MarkdownFile = z.infer<typeof MARKDOWN_FILE_SCHEMA>;

// The name of a file of the Profile, which the front chooses: a single segment of safe characters
// ending in .md, so no name leads out of the Profile folder
export const PROFILE_FILE_NAME_SCHEMA = z
  .string()
  .regex(/^[\p{L}\p{N}][\p{L}\p{N}_.-]*\.md$/u)
  .brand<'Domain'>();

export type ProfileFileName = z.infer<typeof PROFILE_FILE_NAME_SCHEMA>;

// The name of an Upload, under the same guard as a file of the Profile, ending in .pdf
export const UPLOAD_FILE_NAME_SCHEMA = z
  .string()
  .regex(/^[\p{L}\p{N}][\p{L}\p{N}_.-]*\.pdf$/iu)
  .brand<'Domain'>();

export type UploadFileName = z.infer<typeof UPLOAD_FILE_NAME_SCHEMA>;

// A PDF the Candidate dropped into their Profile, such as a CV or a past lettre, kept as is
export const UPLOAD_SCHEMA = z.object({ fileName: UPLOAD_FILE_NAME_SCHEMA, savedAt: z.date() }).brand<'Domain'>();

export type Upload = z.infer<typeof UPLOAD_SCHEMA>;

// A section of the Facts, such as Diplômes, as the form edits it: a list section has one entry per
// item of facts.md, a text section a single one. Its example shows in an empty field what to write.
export const SECTION_SCHEMA = z
  .object({ title: z.string(), isList: z.boolean(), example: z.string(), entryList: z.array(z.string()) })
  .brand<'Domain'>();

export type Section = z.infer<typeof SECTION_SCHEMA>;

// A Markdown file of a Version, and whether the Candidate may correct it by hand
const DOCUMENT_SCHEMA = z.object({ ...MARKDOWN_FILE_SHAPE, isModifiable: z.boolean() });

// isRetenable: whether the Candidate may make it the Version retenue
const VERSION_DOCUMENTS_SCHEMA = z.object({
  version: VERSION_SCHEMA,
  isRetenable: z.boolean(),
  documentList: z.array(DOCUMENT_SCHEMA),
});

// What the front shows of an Artefact at a glance
const ETAT_SCHEMA = z.enum(['absent', 'en_cours', 'pret', 'en_echec']);

const ARTEFACT_VERSIONS_SCHEMA = z.object({
  artefact: ARTEFACT_SCHEMA,
  // En cours from the moment its job is queued, then that of its latest Version; absent before any
  etat: ETAT_SCHEMA,
  // The module that produces it: why it cannot run now, null when it can
  module: z.object({ refusal: z.string().nullable() }),
  // Whether jf edit opens it now: it has a Version retenue, and is neither a Visualisation nor the
  // Lettre of an Applied Posting
  isEditable: z.boolean(),
  versionList: z.array(VERSION_DOCUMENTS_SCHEMA),
});

// What the Posting page shows: the Posting with its raw contacts, its Job Description, every
// Version of each Artefact with its files, and the recipients its Lettre retenue recommends
export const POSTING_DETAIL_SCHEMA = z
  .object({
    posting: POSTING_SCHEMA,
    // The statuses the Posting can move to, a button each
    nextStatusList: z.array(STATUS_SCHEMA),
    jobDescription: z.string(),
    artefactList: z.array(ARTEFACT_VERSIONS_SCHEMA),
    recipients: RECIPIENTS_SCHEMA.nullable(),
    // That of its latest extraction job, null for a Posting that was not imported; the log says why
    // it failed
    extraction: z.object({ etat: ETAT_SCHEMA, log: z.string() }).nullable(),
  })
  .brand<'Domain'>();

export type PostingDetail = z.infer<typeof POSTING_DETAIL_SCHEMA>;

// A job of the Profile of a Candidate rather than of a Posting: the conversion of an Upload into Markdown
export const PROFILE_JOB_SCHEMA = z
  .object({
    id: z.int(),
    module: z.literal('conversion'),
    candidateId: z.string(),
    upload: UPLOAD_FILE_NAME_SCHEMA,
    state: JOB_STATE_SCHEMA,
    log: z.string(),
    sessionId: z.string().nullable(),
  })
  .brand<'Domain'>();

export type ProfileJob = z.infer<typeof PROFILE_JOB_SCHEMA>;

// What the worker runs: a job of a Posting or of a Profile, a single queue for both (ADR-0003)
export const QUEUED_JOB_SCHEMA = z.union([JOB_SCHEMA, PROFILE_JOB_SCHEMA]);

export type QueuedJob = z.infer<typeof QUEUED_JOB_SCHEMA>;

// An Upload and its conversion: the état of its latest conversion job, absent before any, and its log,
// which says why it failed
export const UPLOAD_CONVERSION_SCHEMA = z
  .object({
    fileName: UPLOAD_FILE_NAME_SCHEMA,
    savedAt: z.date(),
    conversion: z.object({ etat: ETAT_SCHEMA, log: z.string() }),
  })
  .brand<'Domain'>();

export type UploadConversion = z.infer<typeof UPLOAD_CONVERSION_SCHEMA>;

// How a headless AI session ended: its id, to resume it, and what it said, kept as the job's log
export const SESSION_RESULT_SCHEMA = z
  .object({ isSuccess: z.boolean(), sessionId: z.string().nullable(), log: z.string() })
  .brand<'Domain'>();

export type SessionResult = z.infer<typeof SESSION_RESULT_SCHEMA>;

// The fields an AI session read in an imported Job Description: its title and its city, null when it
// gives none, and its Job Description
export const EXTRACTION_SCHEMA = z
  .object({ title: z.string().nullable(), city: z.string().nullable(), jobDescription: JOB_DESCRIPTION_SCHEMA })
  .brand<'Domain'>();

export type Extraction = z.infer<typeof EXTRACTION_SCHEMA>;

// The HTML page of a Visualisation Version, which the front shows in a sandboxed frame
export const VISUALISATION_SCHEMA = z.object({ html: z.string() }).brand<'Domain'>();

export type Visualisation = z.infer<typeof VISUALISATION_SCHEMA>;

// A Parameter as the front builds its field: typed in, a list of values, secret, or chosen among what
// the module lists
export const PARAMETER_SCHEMA = z
  .object({
    name: z.string(),
    label: z.string(),
    placeholder: z.string().nullable(),
    type: z.enum(['text', 'url', 'list']),
    isRequired: z.boolean(),
    isSecret: z.boolean(),
    hasChoices: z.boolean(),
  })
  .brand<'Domain'>();

export type Parameter = z.infer<typeof PARAMETER_SCHEMA>;

// A module of a family of interchangeable modules, as its descriptor presents it to the Candidate: the
// form asks for its Parameters (ADR-0010)
const MODULE_DESCRIPTION_SHAPE = { id: z.string(), name: z.string(), parameterList: z.array(PARAMETER_SCHEMA) };

// A Notification Channel may also be tested
export const NOTIFICATION_CHANNEL_MODULE_SCHEMA = z
  .object({ ...MODULE_DESCRIPTION_SHAPE, isTestable: z.boolean() })
  .brand<'Domain'>();

export type NotificationChannelModule = z.infer<typeof NOTIFICATION_CHANNEL_MODULE_SCHEMA>;

// A Source a Watch follows
export const SOURCE_MODULE_SCHEMA = z.object(MODULE_DESCRIPTION_SHAPE).brand<'Domain'>();

export type SourceModule = z.infer<typeof SOURCE_MODULE_SCHEMA>;

// A Candidate's Notification Channel as the actions return it: its module, null until chosen, and its
// Parameters, each secret one reduced to whether it is configured, since it is write-only (ADR-0006)
export const NOTIFICATION_CHANNEL_SCHEMA = z
  .object({ module: z.string().nullable(), parameters: PARAMETERS_SCHEMA, configuredSecretList: z.array(z.string()) })
  .brand<'Domain'>();

export type NotificationChannel = z.infer<typeof NOTIFICATION_CHANNEL_SCHEMA>;

// A Candidate's Notification Channel as saved, secret Parameters included. Its own brand keeps it out
// of the values an action may return (src/actions/index.ts, ADR-0006).
export const SAVED_NOTIFICATION_CHANNEL_SCHEMA = z
  .object({ candidateName: z.string(), module: z.string().nullable(), parameters: PARAMETERS_SCHEMA })
  .brand<'Secret'>();

export type SavedNotificationChannel = z.infer<typeof SAVED_NOTIFICATION_CHANNEL_SCHEMA>;

// One of the values a module offers for a Parameter, with what the Candidate reads
export const PARAMETER_CHOICE_SCHEMA = z.object({ value: z.string(), label: z.string() }).brand<'Domain'>();

export type ParameterChoice = z.infer<typeof PARAMETER_CHOICE_SCHEMA>;

export type DomainValue = z.$brand<'Domain'>;
