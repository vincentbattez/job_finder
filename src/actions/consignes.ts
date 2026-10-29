import { z } from 'zod/v4';

import { ARTEFACT_SCHEMA, MODULE_CONSIGNES_SCHEMA, type Artefact, type ModuleConsignes } from '#/domain/index.ts';

import type { ActionContext } from './context.ts';
import { findDefaultConsignes, parseModule } from './run-job.ts';

const CONSIGNES_MODULE_INPUT_SCHEMA = z.object({ module: z.string() });
const CONSIGNES_INPUT_SCHEMA = CONSIGNES_MODULE_INPUT_SCHEMA.extend({ consignes: z.string() });

export function createConsignesActions({ workspace, findCandidat }: ActionContext) {
  function readModuleConsignes(candidatId: string, module: Artefact): ModuleConsignes {
    return MODULE_CONSIGNES_SCHEMA.parse({
      module,
      defaultConsignes: findDefaultConsignes(module),
      candidatConsignes: workspace.readConsignes(candidatId, module),
    });
  }

  return {
    async listConsignes(rawInput: unknown): Promise<ModuleConsignes[]> {
      const candidat = await findCandidat(rawInput);
      return ARTEFACT_SCHEMA.options.map((module) => readModuleConsignes(candidat.id, module));
    },

    // Named by its Artefact or its alias, as jf run names it
    async readConsignes(rawInput: unknown): Promise<ModuleConsignes> {
      const candidat = await findCandidat(rawInput);
      const { module } = CONSIGNES_MODULE_INPUT_SCHEMA.parse(rawInput);
      return readModuleConsignes(candidat.id, parseModule(module));
    },

    // The fixed part of the prompt stays, so the Candidat's Consignes cannot lift its rules (ADR-0003)
    async saveConsignes(rawInput: unknown): Promise<void> {
      const candidat = await findCandidat(rawInput);
      const { module, consignes } = CONSIGNES_INPUT_SCHEMA.parse(rawInput);
      workspace.saveConsignes(candidat.id, parseModule(module), consignes);
    },

    async deleteConsignes(rawInput: unknown): Promise<void> {
      const candidat = await findCandidat(rawInput);
      const { module } = CONSIGNES_MODULE_INPUT_SCHEMA.parse(rawInput);
      workspace.deleteConsignes(candidat.id, parseModule(module));
    },
  };
}
