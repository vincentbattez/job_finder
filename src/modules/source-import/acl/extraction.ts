import { readFileSync } from 'node:fs';
import path from 'node:path';

import { z } from 'zod/v4';

import { FICHE_DE_POSTE_SCHEMA, LISTED_OFFRE_SCHEMA } from '#/domain/index.ts';

export const EXTRACTION_FILE_NAME = 'extraction.json';

// Case, spacing and apostrophes set aside, as a session may copy them otherwise
function normalize(text: string): string {
  return text.normalize('NFC').toLowerCase().replaceAll(/[‘’]/g, "'").replaceAll(/\s+/g, ' ').trim();
}

// The fields the session found in the Fiche de poste, null when it does not give them. Each one is
// copied from the Fiche, so a value the Fiche does not contain was invented: refused.
function extractionSchemaOf(markdown: string) {
  const excerpt = z
    .string()
    .refine((value) => normalize(markdown).includes(normalize(value)), {
      error: "ne figure pas tel quel dans la Fiche de poste : la session l'a inventé",
    })
    .nullable();
  return z.object({
    title: excerpt,
    employer: excerpt,
    workplace: excerpt,
    city: excerpt,
    dateLimite: z.iso.date().nullable(),
    applicationEmail: excerpt,
    contact1: excerpt,
    contact2: excerpt,
  });
}

function parseExtraction(filePath: string, markdown: string) {
  let json: string;
  try {
    json = readFileSync(filePath, 'utf8');
  } catch {
    return { error: 'la session ne les a pas écrits' };
  }
  try {
    const result = extractionSchemaOf(markdown).safeParse(JSON.parse(json));
    return result.success ? { extraction: result.data } : { error: z.prettifyError(result.error) };
  } catch (error) {
    return { error: String(error) };
  }
}

// The extraction a session wrote as JSON, parsed into the domain (ADR-0005): the Offre as the
// Source Import Markdown lists it, its Fiche de poste and its ville
export function readExtraction(directory: string, reference: string, markdown: string) {
  const { extraction, error } = parseExtraction(path.join(directory, EXTRACTION_FILE_NAME), markdown);
  if (extraction === undefined) {
    throw new Error(
      `Les champs relevés dans la Fiche de poste ne sont pas valables (${EXTRACTION_FILE_NAME}) : ${error}. Relancer l'import.`,
    );
  }
  const { title, dateLimite, city, ...contactList } = extraction;
  // An Offre is followed by its title, in every list and in the name of its folder
  if (title === null) {
    throw new Error(
      "La Fiche de poste ne donne pas l'intitulé du poste, sans lequel l'Offre ne peut se suivre. L'ajouter en tête du fichier (« # Intitulé du poste »), puis relancer l'import.",
    );
  }
  return {
    listedOffre: LISTED_OFFRE_SCHEMA.parse({ reference, title, url: null, publishedAt: null }),
    // The day, at midnight UTC, as the Source PEP gives it
    fiche: FICHE_DE_POSTE_SCHEMA.parse({
      ...contactList,
      dateLimite: dateLimite === null ? null : new Date(dateLimite),
      courtOfAppeal: null,
      markdown,
    }),
    city,
  };
}
