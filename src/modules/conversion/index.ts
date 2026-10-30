import path from 'node:path';

import type { IAiSession } from '#/ai-session/acl/claude-code.ts';
import type { Candidate, SessionResult, UploadFileName } from '#/domain/index.ts';

import { composeConversionPrompt, CONVERSION_REQUEST } from './prompt.ts';

// The CV, or a past letter named after its employer and its year: a name of the Profile, so it never
// leads out of its folder
const CONVERSION_FILE_NAME_PATTERN = /^(?:cv|letter-[\p{L}\p{N}_.-]+-\d{4})\.md$/u;

// The job moves only these into the Profile: any other file the session wrote is refused
export function isConversionFileName(fileName: string): boolean {
  return CONVERSION_FILE_NAME_PATTERN.test(fileName);
}

// The conversion of an Upload into Markdown: a headless Claude session, with a fixed prompt, reads the
// Upload in the Profile and writes its conversion in a folder of its own (ADR-0003)
export function createUploadConversion(aiSession: IAiSession) {
  return {
    async convert(
      candidate: Candidate,
      {
        upload,
        profileDirectory,
        uploadPath,
        outputDirectory,
      }: {
        upload: UploadFileName;
        profileDirectory: string;
        uploadPath: string;
        outputDirectory: string;
      },
    ): Promise<SessionResult> {
      const session = await aiSession.runHeadless({
        fixedPrompt: composeConversionPrompt(candidate, uploadPath, path.relative(profileDirectory, outputDirectory)),
        instructions: CONVERSION_REQUEST,
        directory: profileDirectory,
        // Inside the Profile, where the session runs: nothing to add
        readDirectoryList: [],
        outputDirectory,
      });
      if (!session.isSuccess) {
        throw new Error(`Claude Code n'a pas converti la Pièce « ${upload} » : ${session.log}`);
      }
      return session;
    },
  };
}
