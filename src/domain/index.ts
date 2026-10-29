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

export type DomainValue = z.$brand<'Domain'>;
