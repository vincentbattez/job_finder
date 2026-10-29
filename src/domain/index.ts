import { z } from 'zod/v4';

// The domain types: past the anti-corruption layers, the code only handles these (ADR-0005).
// Every schema ends with .brand<'Domain'>(): only a value parsed by a domain schema carries the
// brand, so a database row or an API response cannot pass for a domain value. z.object drops the
// fields the domain does not know.
export const CANDIDAT_SCHEMA = z.object({ id: z.string(), name: z.string() }).brand<'Domain'>();

export type Candidat = z.infer<typeof CANDIDAT_SCHEMA>;

const ZONE_SCHEMA = z.object({ courtOfAppealList: z.array(z.string()) });

// Criteria and Zone are shaped by the Source; PEP is the only one so far
export const VEILLE_SCHEMA = z
  .object({
    id: z.string(),
    candidatId: z.string(),
    source: z.literal('pep'),
    criteria: z.object({ title: z.string() }),
    zone: ZONE_SCHEMA,
  })
  .brand<'Domain'>();

export type Veille = z.infer<typeof VEILLE_SCHEMA>;

// An Offre as a Source lists it, before its detail page is read
export const LISTED_OFFRE_SCHEMA = z
  .object({ reference: z.string(), title: z.string(), url: z.string(), publishedAt: z.date() })
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
    courtOfAppeal: z.string().nullable(),
    markdown: z.string(),
  })
  .brand<'Domain'>();

export type FicheDePoste = z.infer<typeof FICHE_DE_POSTE_SCHEMA>;

export const OFFRE_SCHEMA = z
  .object({
    id: z.int(),
    candidatId: z.string(),
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
    status: z.enum(['a_traiter', 'postulee', 'archivee']),
    isInZone: z.boolean(),
    isExpiree: z.boolean(),
  })
  .brand<'Domain'>();

export type Offre = z.infer<typeof OFFRE_SCHEMA>;

// What a Détection found for one Veille. On the first launch, the Offres already online are
// imported without triggering anything.
export const DETECTION_SCHEMA = z
  .object({
    veilleId: z.string(),
    candidatId: z.string(),
    isFirstLaunch: z.boolean(),
    newOffreList: z.array(OFFRE_SCHEMA),
    nearMissList: z.array(LISTED_OFFRE_SCHEMA),
  })
  .brand<'Domain'>();

export type Detection = z.infer<typeof DETECTION_SCHEMA>;

export const ARTEFACT_SCHEMA = z.enum(['recherche', 'lettre', 'fiche_entretien', 'visualisation']);

export type Artefact = z.infer<typeof ARTEFACT_SCHEMA>;

// The Consignes of a module for a Candidat: the default ones, kept in the repo, and the ones the
// Candidat replaced them with, if any. The fixed part of the prompt is not among them: no one
// changes it (ADR-0003).
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

// A job runs a module on an Offre; a module is named after the Artefact it produces. Its Version
// exists once the job runs.
export const JOB_SCHEMA = z
  .object({
    id: z.int(),
    module: ARTEFACT_SCHEMA,
    offre: OFFRE_SCHEMA,
    state: z.enum(['queued', 'running', 'done', 'failed']),
    log: z.string(),
    sessionId: z.string().nullable(),
    version: VERSION_SCHEMA.nullable(),
  })
  .brand<'Domain'>();

export type Job = z.infer<typeof JOB_SCHEMA>;

// What a job leaves: the job, the Version it produced and the path of that Version's file
export const MODULE_RUN_SCHEMA = z
  .object({ job: JOB_SCHEMA, version: VERSION_SCHEMA, filePath: z.string() })
  .brand<'Domain'>();

export type ModuleRun = z.infer<typeof MODULE_RUN_SCHEMA>;

// The field of the Offre a recommendation comes from, as published: the mail de candidature or a
// contact
const CONTACT_FIELD_SCHEMA = z.enum(['applicationEmail', 'contact1', 'contact2']);

const ADDRESS_SCHEMA = z.object({ email: z.email(), source: CONTACT_FIELD_SCHEMA });

// To whom the Lettre recommends sending the application, and why: the recipient (null when no
// field gives an address), the copies and the salutation, each with the field it comes from. A
// generic salutation comes from no field.
export const RECIPIENTS_SCHEMA = z
  .object({
    to: ADDRESS_SCHEMA.nullable(),
    ccList: z.array(ADDRESS_SCHEMA),
    salutation: z.object({ text: z.string().min(1), source: CONTACT_FIELD_SCHEMA.nullable() }),
    justification: z.string().min(1),
  })
  .brand<'Domain'>();

export type Recipients = z.infer<typeof RECIPIENTS_SCHEMA>;

// A Markdown file of a Version, such as the Brouillon or the Lettre of a Lettre Version
const DOCUMENT_SCHEMA = z.object({ fileName: z.string(), markdown: z.string() });

// A Markdown file of the Profil of a Candidat, such as faits.md or cv.md
export const PROFIL_FILE_SCHEMA = DOCUMENT_SCHEMA.brand<'Domain'>();

export type ProfilFile = z.infer<typeof PROFIL_FILE_SCHEMA>;

const VERSION_DOCUMENTS_SCHEMA = z.object({ version: VERSION_SCHEMA, documentList: z.array(DOCUMENT_SCHEMA) });

const ARTEFACT_VERSIONS_SCHEMA = z.object({
  artefact: ARTEFACT_SCHEMA,
  versionList: z.array(VERSION_DOCUMENTS_SCHEMA),
});

// What the fiche of an Offre shows: the Offre with its raw contacts, its Fiche de poste, every
// Version of each Artefact with its files, and the recipients its Lettre retenue recommends
export const OFFRE_FICHE_SCHEMA = z
  .object({
    offre: OFFRE_SCHEMA,
    ficheDePoste: z.string(),
    artefactList: z.array(ARTEFACT_VERSIONS_SCHEMA),
    recipients: RECIPIENTS_SCHEMA.nullable(),
  })
  .brand<'Domain'>();

export type OffreFiche = z.infer<typeof OFFRE_FICHE_SCHEMA>;

export type DomainValue = z.$brand<'Domain'>;
