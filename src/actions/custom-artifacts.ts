import { z } from 'zod/v4';

import type { CustomArtifact } from '#/domain/index.ts';

import type { ActionContext } from './context.ts';
import { assertIsAcceptedPdf } from './uploads.ts';

// A document needs a title to be told apart, and a text to be read
const CUSTOM_ARTIFACT_INPUT_SCHEMA = z.object({
  reference: z.string(),
  interview: z.coerce.number().int().optional(),
  title: z.string().trim().min(1),
  text: z.string().regex(/\S/u),
});

const CUSTOM_ARTIFACT_PDF_INPUT_SCHEMA = z.object({
  reference: z.string(),
  interview: z.coerce.number().int().optional(),
  title: z.string().trim().min(1),
  fileName: z.string().default('document.pdf'),
  content: z.instanceof(Uint8Array),
});

// Created only through the Artifact module, like any Artifact (ADR-0016)
export function createCustomArtifactActions({ artifacts, findPosting, findLocale }: ActionContext) {
  return {
    // For the Posting, or for one of its Interviews when one is named: the runs of the Posting, or of that
    // Interview, read it by default (spec #125)
    async addCustomArtifact(rawInput: unknown): Promise<CustomArtifact> {
      const { reference, ...custom } = CUSTOM_ARTIFACT_INPUT_SCHEMA.parse(rawInput);
      return artifacts.createCustom({ posting: await findPosting(reference), ...custom });
    },

    // The same document as a PDF, which the worker converts like an Upload (ADR-0003)
    async addCustomArtifactPdf(rawInput: unknown): Promise<CustomArtifact> {
      const { reference, fileName, ...custom } = CUSTOM_ARTIFACT_PDF_INPUT_SCHEMA.parse(rawInput);
      const posting = await findPosting(reference);
      assertIsAcceptedPdf(fileName, custom.content, await findLocale(posting.candidateId));
      return artifacts.createCustomFromPdf({ posting, ...custom });
    },
  };
}
