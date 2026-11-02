import { z } from 'zod/v4';

import type { Version } from '#/domain/index.ts';

import { ARTIFACT_INPUT_SCHEMA, REFERENCE_INPUT_SCHEMA, type ActionContext } from './context.ts';

const VERSION_INPUT_SCHEMA = ARTIFACT_INPUT_SCHEMA.extend({ number: z.coerce.number().int() });
const DOCUMENT_INPUT_SCHEMA = VERSION_INPUT_SCHEMA.extend({ fileName: z.string(), markdown: z.string() });

// Each act checks its own verdict in the Artifact module (ADR-0016)
export function createEditionActions({ artifacts, findPosting }: ActionContext) {
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

    async validateVersion(rawInput: unknown): Promise<void> {
      const { number, ...name } = VERSION_INPUT_SCHEMA.parse(rawInput);
      const handle = await artifacts.find(name);
      await handle.validate(number);
    },
  };
}
