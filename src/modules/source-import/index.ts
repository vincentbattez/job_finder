import { createHash } from 'node:crypto';
import path from 'node:path';

import type { IAiSession } from '#/ai-session/acl/claude-code.ts';
import { codedError } from '#/domain/coded-error.ts';
import { JOB_DESCRIPTION_SCHEMA, LISTED_POSTING_SCHEMA, type Locale } from '#/domain/index.ts';

import { emptyExtractionDirectory, EXTRACTION_FILE_NAME, readExtraction } from './acl/extraction.ts';
import { composeExtractionPrompt, EXTRACTION_REQUEST } from './prompt.ts';

// The folder of the Posting where the session writes what it read
const EXTRACTION_DIRECTORY_NAME = 'extraction';

// The Source Import Markdown: a Job Description the Candidate found elsewhere
export function createImportSource(aiSession: IAiSession) {
  return {
    // The Posting as the import lists it, before Claude reads its fields: known by the content of its
    // Job Description, so importing the same file again finds it, and named after its file meanwhile
    list(fileName: string, markdown: string) {
      const reference = `import-${createHash('sha256').update(markdown).digest('hex').slice(0, 10)}`;
      return {
        listedPosting: LISTED_POSTING_SCHEMA.parse({ reference, title: fileName, url: null, publishedAt: new Date() }),
        jobDescription: JOB_DESCRIPTION_SCHEMA.parse({
          deadline: null,
          startDate: null,
          employer: null,
          workplace: null,
          applicationEmail: null,
          contact1: null,
          contact2: null,
          markdown,
        }),
      };
    },

    // A headless Claude session, with a fixed prompt, reads the fields of the Job Description in the
    // folder of the Posting. Throws when the session fails or writes an extraction that is not valid.
    async extract(postingDirectory: string, jobDescription: string, locale: Locale) {
      const outputDirectory = path.join(postingDirectory, EXTRACTION_DIRECTORY_NAME);
      // The extraction of an earlier run never passes for that of this one
      emptyExtractionDirectory(outputDirectory);
      const session = await aiSession.runHeadless({
        fixedPrompt: composeExtractionPrompt(path.join(EXTRACTION_DIRECTORY_NAME, EXTRACTION_FILE_NAME)),
        message: EXTRACTION_REQUEST,
        directory: postingDirectory,
        outputDirectory,
        // It reads the Job Description in the Posting's folder, and searches nothing on the web
        isReadingDirectory: true,
        isSearchingWeb: false,
        locale,
      });
      if (!session.isSuccess) {
        throw codedError('extraction_session_failed', { log: session.log }, { locale });
      }
      return { ...readExtraction(outputDirectory, jobDescription, locale), session };
    },
  };
}
