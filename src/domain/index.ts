import { z } from 'zod/v4';

// The brand marks a value parsed by a domain schema, so that a raw row cannot pass for one
// (ADR-0005); an enum stays unbranded, so that its literals can be written in the code
export const CANDIDAT_SCHEMA = z.object({ id: z.string(), name: z.string() }).brand<'Domain'>();

export type Candidat = z.infer<typeof CANDIDAT_SCHEMA>;

// What every Candidat shares: the Délai par défaut, in months. obsoleteConfigPath names the config an
// older jf left, imported once and no longer read (ADR-0011), null once deleted.
export const SETTINGS_SCHEMA = z
  .object({ defaultDelayMonths: z.int().positive(), obsoleteConfigPath: z.string().nullable() })
  .brand<'Domain'>();

export type Settings = z.infer<typeof SETTINGS_SCHEMA>;

// The Paramètres of a module of a family, as JSON: only the module's schema knows their shape (ADR-0010)
export const PARAMETRES_SCHEMA = z.record(z.string(), z.json());

export type Parametres = z.infer<typeof PARAMETRES_SCHEMA>;

// A Veille follows one of the Sources, which alone knows its Paramètres, its Zone among them
// (ADR-0010). detectedAt stays null until a Détection of the Veille went through: until then, it is
// the first launch.
export const VEILLE_SCHEMA = z
  .object({
    id: z.string(),
    candidatId: z.string(),
    source: z.string(),
    parametres: PARAMETRES_SCHEMA,
    detectedAt: z.date().nullable(),
  })
  .brand<'Domain'>();

export type Veille = z.infer<typeof VEILLE_SCHEMA>;

// An Offre as a Source lists it, before its detail page is read. An imported Fiche de poste has no
// link, and is published the day it is imported, so that it expires like any Offre.
export const LISTED_OFFRE_SCHEMA = z
  .object({ reference: z.string(), title: z.string(), url: z.string().nullable(), publishedAt: z.date() })
  .brand<'Domain'>();

export type ListedOffre = z.infer<typeof LISTED_OFFRE_SCHEMA>;

// What the detail page of an Offre says, its fields kept as published, and its Fiche de poste
export const FICHE_DE_POSTE_SCHEMA = z
  .object({
    dateLimite: z.date().nullable(),
    employer: z.string().nullable(),
    workplace: z.string().nullable(),
    applicationEmail: z.string().nullable(),
    contact1: z.string().nullable(),
    contact2: z.string().nullable(),
    markdown: z.string(),
  })
  .brand<'Domain'>();

export type FicheDePoste = z.infer<typeof FICHE_DE_POSTE_SCHEMA>;

// The file of the Fiche de poste in the folder of its Offre, where every session runs
export const FICHE_DE_POSTE_FILE_NAME = 'fiche-de-poste.md';

// Where an Offre is: its ville, and the région and coordinates API Géo gives its commune. The ville
// stays as read, without région nor coordinates, while API Géo knows no commune by that name.
const LIEU_SHAPE = {
  city: z.string().nullable(),
  region: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
};

export const LIEU_SCHEMA = z.object(LIEU_SHAPE).brand<'Domain'>();

export type Lieu = z.infer<typeof LIEU_SCHEMA>;

export const STATUT_SCHEMA = z.enum(['a_traiter', 'postulee', 'archivee']);

export type Statut = z.infer<typeof STATUT_SCHEMA>;

// Another Offre of the Candidat, named by its reference
const LINKED_OFFRE_SCHEMA = z.object({ reference: z.string() });

export const OFFRE_SCHEMA = z
  .object({
    ...LIEU_SHAPE,
    id: z.int(),
    candidatId: z.string(),
    // Where it comes from: the Source of the Veille that detected it, or the import of its Fiche de poste
    source: z.string(),
    reference: z.string(),
    title: z.string(),
    url: z.string().nullable(),
    publishedAt: z.date().nullable(),
    dateLimite: z.date().nullable(),
    employer: z.string().nullable(),
    workplace: z.string().nullable(),
    applicationEmail: z.string().nullable(),
    contact1: z.string().nullable(),
    contact2: z.string().nullable(),
    statut: STATUT_SCHEMA,
    // When it was first marked Postulée, null if never
    postuleeAt: z.date().nullable(),
    isInZone: z.boolean(),
    isExpiree: z.boolean(),
    // The Offre it publishes again, and the Offres that publish it again
    republicationOf: LINKED_OFFRE_SCHEMA.nullable(),
    republicationList: z.array(LINKED_OFFRE_SCHEMA),
  })
  .brand<'Domain'>();

export type Offre = z.infer<typeof OFFRE_SCHEMA>;

// What a Détection found for one Veille, and why each notification it could not send failed. On
// the first launch, the Offres already online are imported without triggering anything.
export const DETECTION_SCHEMA = z
  .object({
    veilleId: z.string(),
    candidatId: z.string(),
    isFirstLaunch: z.boolean(),
    newOffreList: z.array(OFFRE_SCHEMA),
    nearMissList: z.array(LISTED_OFFRE_SCHEMA),
    notificationFailureList: z.array(z.string()),
  })
  .brand<'Domain'>();

export type Detection = z.infer<typeof DETECTION_SCHEMA>;

export const ARTEFACT_SCHEMA = z.enum(['recherche', 'lettre', 'fiche_entretien', 'visualisation']);

export type Artefact = z.infer<typeof ARTEFACT_SCHEMA>;

// The fixed part of the prompt is not among the Consignes: no one changes it (ADR-0003)
export const MODULE_CONSIGNES_SCHEMA = z
  .object({ module: ARTEFACT_SCHEMA, defaultConsignes: z.string(), candidatConsignes: z.string().nullable() })
  .brand<'Domain'>();

export type ModuleConsignes = z.infer<typeof MODULE_CONSIGNES_SCHEMA>;

// A Version that another Version read as input, of its own Offre or of another one
const READ_VERSION_SCHEMA = z.object({
  artefact: ARTEFACT_SCHEMA,
  number: z.int(),
  offre: z.object({ reference: z.string() }),
});

// Each launch of a module creates a new Version, which keeps the Consignes it was produced with
// and the Versions it read
export const VERSION_SCHEMA = z
  .object({
    artefact: ARTEFACT_SCHEMA,
    number: z.int(),
    isRetenue: z.boolean(),
    state: z.enum(['running', 'ready', 'failed']),
    consignes: z.string(),
    hasCandidatConsignes: z.boolean(),
    inputList: z.array(READ_VERSION_SCHEMA),
    createdAt: z.date(),
  })
  .brand<'Domain'>();

export type Version = z.infer<typeof VERSION_SCHEMA>;

// An AI module is named after the Artefact it produces; the extraction fills the imported Offre
// itself, without a Version
const MODULE_SCHEMA = z.enum([...ARTEFACT_SCHEMA.options, 'extraction']);

export type Module = z.infer<typeof MODULE_SCHEMA>;

const JOB_STATE_SCHEMA = z.enum(['queued', 'running', 'done', 'failed']);

export const JOB_SCHEMA = z
  .object({
    id: z.int(),
    module: MODULE_SCHEMA,
    offre: OFFRE_SCHEMA,
    state: JOB_STATE_SCHEMA,
    log: z.string(),
    sessionId: z.string().nullable(),
    version: VERSION_SCHEMA.nullable(),
  })
  .brand<'Domain'>();

export type Job = z.infer<typeof JOB_SCHEMA>;

// The field of the Offre a recommendation comes from, as published: the mail de candidature or a
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

// A Markdown file of the data folder: of the Profil of a Candidat, such as faits.md or cv.md, or of a
// Version, such as the Brouillon or the Lettre of a Lettre Version
const MARKDOWN_FILE_SHAPE = { fileName: z.string(), markdown: z.string() };

export const MARKDOWN_FILE_SCHEMA = z.object(MARKDOWN_FILE_SHAPE).brand<'Domain'>();

export type MarkdownFile = z.infer<typeof MARKDOWN_FILE_SCHEMA>;

// The name of a file of the Profil, which the front chooses: a single segment of safe characters
// ending in .md, so no name leads out of the Profil folder
export const PROFIL_FILE_NAME_SCHEMA = z
  .string()
  .regex(/^[\p{L}\p{N}][\p{L}\p{N}_.-]*\.md$/u)
  .brand<'Domain'>();

export type ProfilFileName = z.infer<typeof PROFIL_FILE_NAME_SCHEMA>;

// The name of a Pièce, under the same guard as a file of the Profil, ending in .pdf
export const PIECE_FILE_NAME_SCHEMA = z
  .string()
  .regex(/^[\p{L}\p{N}][\p{L}\p{N}_.-]*\.pdf$/iu)
  .brand<'Domain'>();

export type PieceFileName = z.infer<typeof PIECE_FILE_NAME_SCHEMA>;

// A PDF the Candidat dropped into their Profil, such as a CV or a past lettre, kept as is
export const PIECE_SCHEMA = z.object({ fileName: PIECE_FILE_NAME_SCHEMA, savedAt: z.date() }).brand<'Domain'>();

export type Piece = z.infer<typeof PIECE_SCHEMA>;

// A rubrique of the Faits, such as Diplômes, as the form edits it: a list rubrique has one entry per
// item of faits.md, a text rubrique a single one. Its example shows in an empty field what to write.
export const RUBRIQUE_SCHEMA = z
  .object({ title: z.string(), isList: z.boolean(), example: z.string(), entryList: z.array(z.string()) })
  .brand<'Domain'>();

export type Rubrique = z.infer<typeof RUBRIQUE_SCHEMA>;

// A Markdown file of a Version, and whether the Candidat may correct it by hand
const DOCUMENT_SCHEMA = z.object({ ...MARKDOWN_FILE_SHAPE, isModifiable: z.boolean() });

// isRetenable: whether the Candidat may make it the Version retenue
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
  // Lettre of a Postulée Offre
  isEditable: z.boolean(),
  versionList: z.array(VERSION_DOCUMENTS_SCHEMA),
});

// What the fiche of an Offre shows: the Offre with its raw contacts, its Fiche de poste, every
// Version of each Artefact with its files, and the recipients its Lettre retenue recommends
export const OFFRE_FICHE_SCHEMA = z
  .object({
    offre: OFFRE_SCHEMA,
    // The statuts the Offre can move to, a button each
    nextStatutList: z.array(STATUT_SCHEMA),
    ficheDePoste: z.string(),
    artefactList: z.array(ARTEFACT_VERSIONS_SCHEMA),
    recipients: RECIPIENTS_SCHEMA.nullable(),
    // That of its latest extraction job, null for an Offre that was not imported; the log says why
    // it failed
    extraction: z.object({ etat: ETAT_SCHEMA, log: z.string() }).nullable(),
  })
  .brand<'Domain'>();

export type OffreFiche = z.infer<typeof OFFRE_FICHE_SCHEMA>;

// A job of the Profil of a Candidat rather than of an Offre: the conversion of a Pièce into Markdown
export const PROFIL_JOB_SCHEMA = z
  .object({
    id: z.int(),
    module: z.literal('conversion'),
    candidatId: z.string(),
    piece: PIECE_FILE_NAME_SCHEMA,
    state: JOB_STATE_SCHEMA,
    log: z.string(),
    sessionId: z.string().nullable(),
  })
  .brand<'Domain'>();

export type ProfilJob = z.infer<typeof PROFIL_JOB_SCHEMA>;

// What the worker runs: a job of an Offre or of a Profil, a single queue for both (ADR-0003)
export const QUEUED_JOB_SCHEMA = z.union([JOB_SCHEMA, PROFIL_JOB_SCHEMA]);

export type QueuedJob = z.infer<typeof QUEUED_JOB_SCHEMA>;

// A Pièce and its conversion: the état of its latest conversion job, absent before any, and its log,
// which says why it failed
export const PIECE_CONVERSION_SCHEMA = z
  .object({
    fileName: PIECE_FILE_NAME_SCHEMA,
    savedAt: z.date(),
    conversion: z.object({ etat: ETAT_SCHEMA, log: z.string() }),
  })
  .brand<'Domain'>();

export type PieceConversion = z.infer<typeof PIECE_CONVERSION_SCHEMA>;

// How a headless AI session ended: its id, to resume it, and what it said, kept as the job's log
export const SESSION_RESULT_SCHEMA = z
  .object({ isSuccess: z.boolean(), sessionId: z.string().nullable(), log: z.string() })
  .brand<'Domain'>();

export type SessionResult = z.infer<typeof SESSION_RESULT_SCHEMA>;

// The fields an AI session read in an imported Fiche de poste: its title and its ville, null when it
// gives none, and its Fiche de poste
export const EXTRACTION_SCHEMA = z
  .object({ title: z.string().nullable(), city: z.string().nullable(), ficheDePoste: FICHE_DE_POSTE_SCHEMA })
  .brand<'Domain'>();

export type Extraction = z.infer<typeof EXTRACTION_SCHEMA>;

// The HTML page of a Visualisation Version, which the front shows in a sandboxed frame
export const VISUALISATION_SCHEMA = z.object({ html: z.string() }).brand<'Domain'>();

export type Visualisation = z.infer<typeof VISUALISATION_SCHEMA>;

// A Paramètre as the front builds its field: typed in, a list of values, secret, or chosen among what
// the module lists
export const PARAMETRE_SCHEMA = z
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

export type Parametre = z.infer<typeof PARAMETRE_SCHEMA>;

// A module of the Canaux de notification, as its descriptor presents it to the Candidat (ADR-0010)
export const CANAL_NOTIFICATION_MODULE_SCHEMA = z
  .object({ id: z.string(), name: z.string(), parametreList: z.array(PARAMETRE_SCHEMA), isTestable: z.boolean() })
  .brand<'Domain'>();

export type CanalNotificationModule = z.infer<typeof CANAL_NOTIFICATION_MODULE_SCHEMA>;

// A Source a Veille follows, as its descriptor presents it: the form of a Veille asks for its
// Paramètres (ADR-0010)
export const SOURCE_MODULE_SCHEMA = z
  .object({ id: z.string(), name: z.string(), parametreList: z.array(PARAMETRE_SCHEMA) })
  .brand<'Domain'>();

export type SourceModule = z.infer<typeof SOURCE_MODULE_SCHEMA>;

// A Candidat's Canal de notification as the actions return it: its module, null until chosen, and its
// Paramètres, each secret one reduced to whether it is configured, since it is write-only (ADR-0006)
export const CANAL_NOTIFICATION_SCHEMA = z
  .object({ module: z.string().nullable(), parametres: PARAMETRES_SCHEMA, configuredSecretList: z.array(z.string()) })
  .brand<'Domain'>();

export type CanalNotification = z.infer<typeof CANAL_NOTIFICATION_SCHEMA>;

// A Candidat's Canal de notification as saved, secret Paramètres included. Its own brand keeps it out
// of the values an action may return (src/actions/index.ts, ADR-0006).
export const SAVED_CANAL_NOTIFICATION_SCHEMA = z
  .object({ candidatName: z.string(), module: z.string().nullable(), parametres: PARAMETRES_SCHEMA })
  .brand<'Secret'>();

export type SavedCanalNotification = z.infer<typeof SAVED_CANAL_NOTIFICATION_SCHEMA>;

// One of the values a module offers for a Paramètre, with what the Candidat reads
export const PARAMETRE_CHOICE_SCHEMA = z.object({ value: z.string(), label: z.string() }).brand<'Domain'>();

export type ParametreChoice = z.infer<typeof PARAMETRE_CHOICE_SCHEMA>;

export type DomainValue = z.$brand<'Domain'>;
