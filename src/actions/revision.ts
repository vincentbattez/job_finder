import { z } from 'zod/v4';

import type { RevisionSection } from '#/domain/index.ts';

import type { ActionContext } from './context.ts';
import { interviewFinderOf } from './interviews.ts';

// A section is named by its title in the Chosen Interview Brief, the level-2 heading as the page reads it
const SECTION_SHAPE = { title: z.string().trim().min(1) };

const NOTE_INPUT_SCHEMA = z.object({ ...SECTION_SHAPE, note: z.string() });

// The front posts text, the CLI and the tests a boolean
const MASTERED_INPUT_SCHEMA = z.object({ ...SECTION_SHAPE, isMastered: z.union([z.boolean(), z.stringbool()]) });

// The Revision of an Interview (spec #125, « Reading and Revision »): written section by section, by its
// title, so a newer Chosen Version keeps what the Candidate wrote wherever the title remains
export function createRevisionActions(context: ActionContext) {
  const findInterview = interviewFinderOf(context);
  const { workspace } = context;
  return {
    // Every section the Candidate wrote in or marked, those a newer Chosen Version dropped included
    async readRevision(rawInput: unknown): Promise<RevisionSection[]> {
      const { interview } = await findInterview(rawInput);
      return workspace.listRevisionSections(interview);
    },

    async writeRevisionNote(rawInput: unknown): Promise<void> {
      const { title, note } = NOTE_INPUT_SCHEMA.parse(rawInput);
      const { interview } = await findInterview(rawInput);
      await workspace.saveRevisionSection(interview, title, { note });
    },

    async markMastered(rawInput: unknown): Promise<void> {
      const { title, isMastered } = MASTERED_INPUT_SCHEMA.parse(rawInput);
      const { interview } = await findInterview(rawInput);
      await workspace.saveRevisionSection(interview, title, { isMastered });
    },
  };
}
