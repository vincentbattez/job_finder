import { z } from 'zod/v4';

import { codedError } from '#/domain/coded-error.ts';
import {
  MARKDOWN_FILE_SCHEMA,
  PROFILE_FILE_NAME_SCHEMA,
  type Candidate,
  type MarkdownFile,
  type ProfileFileName,
} from '#/domain/index.ts';
import { composeProfilePrompt } from '#/profile/prompt.ts';
import { wordListOf } from '#/text/index.ts';

import type { ActionContext } from './context.ts';

const PROFILE_FILE_NAME_INPUT_SCHEMA = z.object({ fileName: z.string() });
const PROFILE_FILE_INPUT_SCHEMA = PROFILE_FILE_NAME_INPUT_SCHEMA.extend({ markdown: z.string() });
const ANNEX_INPUT_SCHEMA = z.object({ title: z.string().trim().min(1), markdown: z.string().regex(/\S/u) });
const NEW_PROFILE_FILE_INPUT_SCHEMA = PROFILE_FILE_NAME_INPUT_SCHEMA.extend({ markdown: z.string().default('') });

// The name comes from the front: parsed before anything touches the disk, so it never leads out of
// the Profile folder
function parseProfileFileName(fileName: string, candidate: Candidate): ProfileFileName {
  const result = PROFILE_FILE_NAME_SCHEMA.safeParse(fileName);
  if (!result.success) {
    throw codedError('invalid_profile_file_name', { fileName }, { locale: candidate.locale });
  }
  return result.data;
}

export function createProfileActions({ workspace, aiSession, findCandidate }: ActionContext) {
  function hasProfileFile(candidate: Candidate, fileName: ProfileFileName): boolean {
    return workspace.readProfileFiles(candidate.id).some((profileFile) => profileFile.fileName === fileName);
  }

  function assertIsNewProfileFile(candidate: Candidate, fileName: ProfileFileName): void {
    if (hasProfileFile(candidate, fileName)) {
      throw codedError(
        'duplicate_profile_file',
        { candidateName: candidate.name, fileName },
        { locale: candidate.locale },
      );
    }
  }

  function assertHasProfileFile(candidate: Candidate, fileName: ProfileFileName): void {
    if (!hasProfileFile(candidate, fileName)) {
      throw codedError(
        'missing_profile_file',
        { candidateName: candidate.name, fileName, candidateId: candidate.id },
        { locale: candidate.locale },
      );
    }
  }

  return {
    async openProfile(rawInput: unknown): Promise<void> {
      const candidate = await findCandidate(rawInput);
      aiSession.openInteractive({
        prompt: composeProfilePrompt(candidate),
        directory: workspace.profileDirectoryOf(candidate.id),
        locale: candidate.locale,
      });
    },

    async listProfileFiles(rawInput: unknown): Promise<MarkdownFile[]> {
      const candidate = await findCandidate(rawInput);
      return workspace.readProfileFiles(candidate.id);
    },

    async createProfileFile(rawInput: unknown): Promise<void> {
      const candidate = await findCandidate(rawInput);
      const input = NEW_PROFILE_FILE_INPUT_SCHEMA.parse(rawInput);
      const fileName = parseProfileFileName(input.fileName, candidate);
      assertIsNewProfileFile(candidate, fileName);
      workspace.saveProfileFile(candidate.id, fileName, input.markdown);
    },

    // An Annex named after its title, which the runs that read the Profile offer to add (spec #125); an
    // Annex of that name is never overwritten
    async addAnnex(rawInput: unknown): Promise<MarkdownFile> {
      const candidate = await findCandidate(rawInput);
      const { title, markdown } = ANNEX_INPUT_SCHEMA.parse(rawInput);
      const slug = wordListOf(title).join('-');
      const fileName = parseProfileFileName(`annex-${slug === '' ? 'document' : slug}.md`, candidate);
      assertIsNewProfileFile(candidate, fileName);
      workspace.saveProfileFile(candidate.id, fileName, markdown);
      return MARKDOWN_FILE_SCHEMA.parse({ fileName, markdown });
    },

    // Only a file the Profile already has is written: creating one is a choice of its own
    async saveProfileFile(rawInput: unknown): Promise<void> {
      const candidate = await findCandidate(rawInput);
      const input = PROFILE_FILE_INPUT_SCHEMA.parse(rawInput);
      const fileName = parseProfileFileName(input.fileName, candidate);
      assertHasProfileFile(candidate, fileName);
      workspace.saveProfileFile(candidate.id, fileName, input.markdown);
    },

    async deleteProfileFile(rawInput: unknown): Promise<void> {
      const candidate = await findCandidate(rawInput);
      const fileName = parseProfileFileName(PROFILE_FILE_NAME_INPUT_SCHEMA.parse(rawInput).fileName, candidate);
      assertHasProfileFile(candidate, fileName);
      workspace.deleteProfileFile(candidate.id, fileName);
    },
  };
}
