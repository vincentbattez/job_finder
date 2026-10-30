import { z } from 'zod/v4';

import { PROFIL_FILE_NAME_SCHEMA, type Candidat, type MarkdownFile, type ProfilFileName } from '#/domain/index.ts';
import { composeProfilPrompt } from '#/profil/prompt.ts';

import type { ActionContext } from './context.ts';

const PROFIL_FILE_NAME_INPUT_SCHEMA = z.object({ fileName: z.string() });
const PROFIL_FILE_INPUT_SCHEMA = PROFIL_FILE_NAME_INPUT_SCHEMA.extend({ markdown: z.string() });
const NEW_PROFIL_FILE_INPUT_SCHEMA = PROFIL_FILE_NAME_INPUT_SCHEMA.extend({ markdown: z.string().default('') });

// The name comes from the front: parsed before anything touches the disk, so it never leads out of
// the Profil folder
function parseProfilFileName(fileName: string): ProfilFileName {
  const result = PROFIL_FILE_NAME_SCHEMA.safeParse(fileName);
  if (!result.success) {
    throw new Error(
      `« ${fileName} » n'est pas un nom de fichier du Profil : un nom sans dossier, en lettres, chiffres, « - », « _ » ou « . », terminé par « .md ».`,
    );
  }
  return result.data;
}

export function createProfilActions({ workspace, aiSession, findCandidat }: ActionContext) {
  function hasProfilFile(candidat: Candidat, fileName: ProfilFileName): boolean {
    return workspace.readProfilFiles(candidat.id).some((profilFile) => profilFile.fileName === fileName);
  }

  function assertHasProfilFile(candidat: Candidat, fileName: ProfilFileName): void {
    if (!hasProfilFile(candidat, fileName)) {
      throw new Error(
        `Le Profil de ${candidat.name} n'a pas de fichier « ${fileName} ». La page Profil ou « jf profil ${candidat.id} » le crée.`,
      );
    }
  }

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

    async createProfilFile(rawInput: unknown): Promise<void> {
      const candidat = await findCandidat(rawInput);
      const input = NEW_PROFIL_FILE_INPUT_SCHEMA.parse(rawInput);
      const fileName = parseProfilFileName(input.fileName);
      if (hasProfilFile(candidat, fileName)) {
        throw new Error(`Le Profil de ${candidat.name} a déjà un fichier « ${fileName} ». Choisir un autre nom.`);
      }
      workspace.saveProfilFile(candidat.id, fileName, input.markdown);
    },

    // Only a file the Profil already has is written: creating one is a choice of its own
    async saveProfilFile(rawInput: unknown): Promise<void> {
      const candidat = await findCandidat(rawInput);
      const input = PROFIL_FILE_INPUT_SCHEMA.parse(rawInput);
      const fileName = parseProfilFileName(input.fileName);
      assertHasProfilFile(candidat, fileName);
      workspace.saveProfilFile(candidat.id, fileName, input.markdown);
    },

    async deleteProfilFile(rawInput: unknown): Promise<void> {
      const candidat = await findCandidat(rawInput);
      const fileName = parseProfilFileName(PROFIL_FILE_NAME_INPUT_SCHEMA.parse(rawInput).fileName);
      assertHasProfilFile(candidat, fileName);
      workspace.deleteProfilFile(candidat.id, fileName);
    },
  };
}
