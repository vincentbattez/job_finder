import type { Candidate } from '#/domain/index.ts';
import { CONVERSION_INSTRUCTIONS } from '#/profile/prompt.ts';

// The whole prompt is fixed, with no Instructions: the conversion only copies (ADR-0003), so the
// document keeps its own language. Its rules are those of jf profile, which converts the same
// documents with the Candidate.
export function composeConversionPrompt({ name }: Candidate, uploadPath: string, outputDirectory: string): string {
  return `You convert into Markdown an Upload that ${name} dropped into their Candidate Profile: an original document, their CV, a past cover letter or an Annex, as a PDF. The current folder is this Profile: the Upload is \`${uploadPath}\`. Read it in full.

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

// A PDF the Candidate brought as their own Version of an Artifact: copied into its text file, as an Upload
export function composeBroughtConversionPrompt(
  { name }: Candidate,
  { pdfFileName, outputFileName }: { pdfFileName: string; outputFileName: string },
): string {
  return `You convert into Markdown a document that ${name} brought as their own version of a document prepared for a job application, as a PDF. The current folder is that version's: the PDF is \`${pdfFileName}\`. Read it in full.

## What you produce

Write its text in the single file \`${outputFileName}\`, in the current folder, never elsewhere.

## Non-negotiable rules

- Copy the text of the PDF as it is, in its order and in its language: do not rephrase, summarize, correct, translate or complete anything. Only the layout becomes Markdown (headings, lists, bold, tables).
- Never invent a fact: an unreadable passage is marked "[illegible]".
- Modify nothing else than \`${outputFileName}\`.
- Search nothing on the web: everything is in the PDF.
`;
}

// claude -p needs a message: the fixed prompt above says everything (ADR-0003)
export const BROUGHT_CONVERSION_REQUEST = 'Convert the PDF into Markdown.';
