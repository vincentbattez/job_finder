import type { Candidate } from '#/domain/index.ts';
import { CONVERSION_INSTRUCTIONS } from '#/profile/prompt.ts';

// The whole prompt is fixed, with no Instructions: the conversion only copies (ADR-0003), so the
// document keeps its own language. Its rules are those of jf profile, which converts the same
// documents with the Candidate.
export function composeConversionPrompt({ name }: Candidate, uploadPath: string, outputDirectory: string): string {
  return `You convert into Markdown an Upload that ${name} dropped into their Candidate Profile: an original document, their CV or a past cover letter, as a PDF. The current folder is this Profile: the Upload is \`${uploadPath}\`. Read it in full.

## What you produce

The Upload is a single document: ${CONVERSION_INSTRUCTIONS}.

Write this single file in the folder \`${outputDirectory}\`, never elsewhere: the tool then moves it into the Profile.

## Non-negotiable rules

- Copy the text of the Upload as it is, in its order and in its language: do not rephrase, summarize, correct, translate or complete anything. Only the layout becomes Markdown (headings, lists, bold).
- Never invent a fact: an unreadable passage is marked "[illegible]".
- Modify neither the Upload nor any file of the Profile.
- Search nothing on the web: everything is in the Upload.
`;
}

// claude -p needs a message: the fixed prompt above says everything (ADR-0003)
export const CONVERSION_REQUEST = 'Convert the Upload into Markdown.';
