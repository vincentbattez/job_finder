import { z } from 'zod/v4';

import {
  ARTIFACT_SCHEMA,
  MODULE_INSTRUCTIONS_SCHEMA,
  type Artifact,
  type Candidate,
  type ModuleInstructions,
} from '#/domain/index.ts';

import type { ActionContext } from './context.ts';
import { findDefaultInstructions, parseModule } from './run-job.ts';

const INSTRUCTIONS_MODULE_INPUT_SCHEMA = z.object({ module: z.string() });
const INSTRUCTIONS_INPUT_SCHEMA = INSTRUCTIONS_MODULE_INPUT_SCHEMA.extend({ instructions: z.string() });

export function createInstructionsActions({ workspace, findCandidate }: ActionContext) {
  function readModuleInstructions(candidate: Candidate, module: Artifact): ModuleInstructions {
    return MODULE_INSTRUCTIONS_SCHEMA.parse({
      module,
      defaultInstructions: findDefaultInstructions(module, candidate),
      candidateInstructions: workspace.readInstructions(candidate.id, module),
    });
  }

  return {
    async listInstructions(rawInput: unknown): Promise<ModuleInstructions[]> {
      const candidate = await findCandidate(rawInput);
      return ARTIFACT_SCHEMA.options.map((module) => readModuleInstructions(candidate, module));
    },

    // Named by its Artifact or its alias, as jf run names it
    async readInstructions(rawInput: unknown): Promise<ModuleInstructions> {
      const candidate = await findCandidate(rawInput);
      const { module } = INSTRUCTIONS_MODULE_INPUT_SCHEMA.parse(rawInput);
      return readModuleInstructions(candidate, parseModule(module));
    },

    // The fixed part of the prompt stays, so the Candidate's Instructions cannot lift its rules (ADR-0003)
    async saveInstructions(rawInput: unknown): Promise<void> {
      const candidate = await findCandidate(rawInput);
      const { module, instructions } = INSTRUCTIONS_INPUT_SCHEMA.parse(rawInput);
      workspace.saveInstructions(candidate.id, parseModule(module), instructions);
    },

    async deleteInstructions(rawInput: unknown): Promise<void> {
      const candidate = await findCandidate(rawInput);
      const { module } = INSTRUCTIONS_MODULE_INPUT_SCHEMA.parse(rawInput);
      workspace.deleteInstructions(candidate.id, parseModule(module));
    },
  };
}
