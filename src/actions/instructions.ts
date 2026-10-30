import { z } from 'zod/v4';

import { ARTIFACT_SCHEMA, MODULE_INSTRUCTIONS_SCHEMA, type Artifact, type ModuleInstructions } from '#/domain/index.ts';

import type { ActionContext } from './context.ts';
import { findDefaultInstructions, parseModule } from './run-job.ts';

const INSTRUCTIONS_MODULE_INPUT_SCHEMA = z.object({ module: z.string() });
const INSTRUCTIONS_INPUT_SCHEMA = INSTRUCTIONS_MODULE_INPUT_SCHEMA.extend({ instructions: z.string() });

export function createInstructionsActions({ workspace, findCandidate }: ActionContext) {
  function readModuleInstructions(candidateId: string, module: Artifact): ModuleInstructions {
    return MODULE_INSTRUCTIONS_SCHEMA.parse({
      module,
      defaultInstructions: findDefaultInstructions(module),
      candidateInstructions: workspace.readInstructions(candidateId, module),
    });
  }

  return {
    async listInstructions(rawInput: unknown): Promise<ModuleInstructions[]> {
      const candidate = await findCandidate(rawInput);
      return ARTIFACT_SCHEMA.options.map((module) => readModuleInstructions(candidate.id, module));
    },

    // Named by its Artifact or its alias, as jf run names it
    async readInstructions(rawInput: unknown): Promise<ModuleInstructions> {
      const candidate = await findCandidate(rawInput);
      const { module } = INSTRUCTIONS_MODULE_INPUT_SCHEMA.parse(rawInput);
      return readModuleInstructions(candidate.id, parseModule(module, candidate.locale));
    },

    // The fixed part of the prompt stays, so the Candidate's Instructions cannot lift its rules (ADR-0003)
    async saveInstructions(rawInput: unknown): Promise<void> {
      const candidate = await findCandidate(rawInput);
      const { module, instructions } = INSTRUCTIONS_INPUT_SCHEMA.parse(rawInput);
      workspace.saveInstructions(candidate.id, parseModule(module, candidate.locale), instructions);
    },

    async deleteInstructions(rawInput: unknown): Promise<void> {
      const candidate = await findCandidate(rawInput);
      const { module } = INSTRUCTIONS_MODULE_INPUT_SCHEMA.parse(rawInput);
      workspace.deleteInstructions(candidate.id, parseModule(module, candidate.locale));
    },
  };
}
