import path from 'node:path';

import type { IAiSession } from '#/ai-session/acl/claude-code.ts';
import type { Candidat, PieceFileName, SessionResult } from '#/domain/index.ts';

import { composeConversionPrompt, CONVERSION_REQUEST } from './prompt.ts';

// The CV, or a past lettre named after its employeur and its year: a name of the Profil, so it never
// leads out of its folder
const CONVERSION_FILE_NAME_PATTERN = /^(?:cv|lettre-[\p{L}\p{N}_.-]+-\d{4})\.md$/u;

// The job moves only these into the Profil: any other file the session wrote is refused
export function findConversionFileNameError(fileName: string): string | undefined {
  return CONVERSION_FILE_NAME_PATTERN.test(fileName)
    ? undefined
    : `« ${fileName} » n'est ni « cv.md » ni une lettre « lettre-<employeur>-<année>.md »`;
}

// The conversion of a Pièce into Markdown: a headless Claude session, with a fixed prompt, reads the
// Pièce in the Profil and writes its conversion in a folder of its own (ADR-0003)
export function createPieceConversion(aiSession: IAiSession) {
  return {
    async convert(
      candidat: Candidat,
      {
        piece,
        profilDirectory,
        piecePath,
        outputDirectory,
      }: {
        piece: PieceFileName;
        profilDirectory: string;
        piecePath: string;
        outputDirectory: string;
      },
    ): Promise<SessionResult> {
      const session = await aiSession.runHeadless({
        fixedPrompt: composeConversionPrompt(candidat, piecePath, path.relative(profilDirectory, outputDirectory)),
        consignes: CONVERSION_REQUEST,
        directory: profilDirectory,
        // Inside the Profil, where the session runs: nothing to add
        readDirectoryList: [],
        outputDirectory,
      });
      if (!session.isSuccess) {
        throw new Error(`Claude Code n'a pas converti la Pièce « ${piece} » : ${session.log}`);
      }
      return session;
    },
  };
}
