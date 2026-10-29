import { z } from 'zod/v4';

import type { MarkdownFile } from '#/domain/index.ts';
import { composeProfilPrompt } from '#/profil/prompt.ts';

import type { ActionContext } from './context.ts';

const PROFIL_FILE_INPUT_SCHEMA = z.object({ fileName: z.string(), markdown: z.string() });

export function createProfilActions({ workspace, aiSession, findCandidat }: ActionContext) {
  return {
    async openProfil(rawInput: unknown): Promise<void> {
      const candidat = await findCandidat(rawInput);
      aiSession.openInteractive({
        prompt: composeProfilPrompt(candidat),
        directory: workspace.profilDirectoryOf(candidat.id),
      });
    },

    async listProfilFiles(rawInput: unknown): Promise<MarkdownFile[]> {
      const candidat = await findCandidat(rawInput);
      return workspace.readProfilFiles(candidat.id);
    },

    async saveProfilFile(rawInput: unknown): Promise<void> {
      const candidat = await findCandidat(rawInput);
      const { fileName, markdown } = PROFIL_FILE_INPUT_SCHEMA.parse(rawInput);
      // The name comes from the front: only a file the Profil already has is written, so no name
      // can lead out of the Profil folder
      if (workspace.readProfilFiles(candidat.id).every((profilFile) => profilFile.fileName !== fileName)) {
        throw new Error(
          `Le Profil de ${candidat.name} n'a pas de fichier « ${fileName} ». « jf profil ${candidat.id} » complète le Profil.`,
        );
      }
      workspace.saveProfilFile(candidat.id, fileName, markdown);
    },
  };
}
