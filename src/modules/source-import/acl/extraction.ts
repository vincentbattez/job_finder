import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

import { z } from 'zod/v4';

import { tFor } from '#/domain/catalogue/i18n.ts';
import { codedError } from '#/domain/coded-error.ts';
import { EXTRACTION_SCHEMA, JOB_DESCRIPTION_SCHEMA, type Extraction, type Locale } from '#/domain/index.ts';

export const EXTRACTION_FILE_NAME = 'extraction.json';

export function emptyExtractionDirectory(directory: string): void {
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory);
}

// Case, spacing and apostrophes set aside, as a session may copy them otherwise
function normalize(text: string): string {
  return text.normalize('NFC').toLowerCase().replaceAll(/[‘’]/g, "'").replaceAll(/\s+/g, ' ').trim();
}

// The fields the session found in the Job Description, null when it does not give them. Each one is
// copied from the Job Description, so a value it does not contain was invented: refused.
function extractionSchemaOf(markdown: string, locale: Locale) {
  const excerpt = z
    .string()
    .refine((value) => normalize(markdown).includes(normalize(value)), {
      error: tFor(locale, 'error')('extractionInvented'),
    })
    .nullable();
  return z.object({
    title: excerpt,
    employer: excerpt,
    workplace: excerpt,
    city: excerpt,
    deadline: z.iso.date().nullable(),
    startDate: z.iso.date().nullable(),
    applicationEmail: excerpt,
    contact1: excerpt,
    contact2: excerpt,
  });
}

function parseExtraction(filePath: string, markdown: string, locale: Locale) {
  let json: string;
  try {
    json = readFileSync(filePath, 'utf8');
  } catch {
    return { error: tFor(locale, 'error')('extractionNotWritten') };
  }
  try {
    const result = extractionSchemaOf(markdown, locale).safeParse(JSON.parse(json));
    return result.success ? { extraction: result.data } : { error: z.prettifyError(result.error) };
  } catch (error) {
    return { error: String(error) };
  }
}

// The extraction a session wrote as JSON, parsed into the domain (ADR-0005)
export function readExtraction(directory: string, markdown: string, locale: Locale): Extraction {
  const { extraction, error } = parseExtraction(path.join(directory, EXTRACTION_FILE_NAME), markdown, locale);
  if (extraction === undefined) {
    throw codedError('invalid_extraction', { fileName: EXTRACTION_FILE_NAME, problem: error }, { locale });
  }
  const { title, deadline, startDate, city, ...jobDescriptionField } = extraction;
  return EXTRACTION_SCHEMA.parse({
    title,
    city,
    jobDescription: JOB_DESCRIPTION_SCHEMA.parse({
      ...jobDescriptionField,
      // The day, at midnight UTC, as the Sources give it
      deadline: deadline === null ? null : new Date(deadline),
      startDate: startDate === null ? null : new Date(startDate),
      markdown,
    }),
  });
}
