import { z } from 'zod/v4';

import type { Job, Version } from '#/domain/index.ts';

import { ARTIFACT_INPUT_SCHEMA, REFERENCE_INPUT_SCHEMA, type ActionContext } from './context.ts';
import { assertIsAcceptedPdf } from './uploads.ts';

const VERSION_INPUT_SCHEMA = ARTIFACT_INPUT_SCHEMA.extend({ number: z.coerce.number().int() });
const DOCUMENT_INPUT_SCHEMA = VERSION_INPUT_SCHEMA.extend({ fileName: z.string(), markdown: z.string() });
const BROUGHT_INPUT_SCHEMA = ARTIFACT_INPUT_SCHEMA.extend({ markdown: z.string() });
const BROUGHT_PDF_INPUT_SCHEMA = ARTIFACT_INPUT_SCHEMA.extend({
  // The name the Candidate's file had, which a refusal names
  fileName: z.string().default('brought.pdf'),
  content: z.instanceof(Uint8Array),
});

// Each act checks its own verdict in the Artifact module (ADR-0016)
export function createEditionActions({ artifacts, findPosting, findLocale }: ActionContext) {
  return {
    // The Chosen Versions jf edit offers, those it accepts: of the Posting, then of each Interview
    async listChosenVersions(rawInput: unknown): Promise<Version[]> {
      const { reference } = REFERENCE_INPUT_SCHEMA.parse(rawInput);
      const handleList = await artifacts.listOf(await findPosting(reference));
      return handleList.flatMap(({ editRefusal, chosenVersion }) =>
        editRefusal === null && chosenVersion !== undefined ? [chosenVersion] : [],
      );
    },

    async openArtifact(rawInput: unknown): Promise<void> {
      const handle = await artifacts.find(ARTIFACT_INPUT_SCHEMA.parse(rawInput));
      handle.openForEdition();
    },

    async saveDocument(rawInput: unknown): Promise<void> {
      const { number, fileName, markdown, ...name } = DOCUMENT_INPUT_SCHEMA.parse(rawInput);
      const handle = await artifacts.find(name);
      handle.saveDocument(number, fileName, markdown);
    },

    // The Candidate's own Version, pasted or read from a Markdown file: a Draft with no Original (ADR-0019)
    async bringVersion(rawInput: unknown): Promise<Version> {
      const { markdown, ...name } = BROUGHT_INPUT_SCHEMA.parse(rawInput);
      const handle = await artifacts.find(name);
      return handle.bring(markdown);
    },

    // The Candidate's own Version as a PDF, which the worker converts like an Upload (ADR-0003)
    async bringPdf(rawInput: unknown): Promise<Job> {
      const { fileName, content, ...name } = BROUGHT_PDF_INPUT_SCHEMA.parse(rawInput);
      const handle = await artifacts.find(name);
      const posting = await findPosting(name.reference);
      assertIsAcceptedPdf(fileName, content, await findLocale(posting.candidateId));
      return handle.bringPdf(content);
    },

    async validateVersion(rawInput: unknown): Promise<void> {
      const { number, ...name } = VERSION_INPUT_SCHEMA.parse(rawInput);
      const handle = await artifacts.find(name);
      await handle.validate(number);
    },
  };
}
