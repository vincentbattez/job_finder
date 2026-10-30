import { JOB_DESCRIPTION_FILE_NAME } from '#/domain/index.ts';

// The whole prompt is fixed, with no Instructions: the extraction only copies fields (ADR-0003), so
// they stay in the language of the Job Description
export function composeExtractionPrompt(extractionPath: string): string {
  return `You pick out the fields of a Job Description, a job advert the Candidate found by themselves and imported into the tool. The current folder is the Posting's: its Job Description is in \`${JOB_DESCRIPTION_FILE_NAME}\`. Read it in full.

## What you produce

A single JSON file, \`${extractionPath}\`, of this shape:

\`\`\`json
{
  "title": "the job title",
  "employer": "the employer",
  "workplace": "the place of work",
  "city": "the city of the place of work",
  "deadline": "YYYY-MM-DD",
  "applicationEmail": "the address to send the application to",
  "contact1": "the first contact",
  "contact2": "the second contact"
}
\`\`\`

- Each value, except \`deadline\`, is copied from the Job Description as it is written there, in the language of the Job Description, never translated: a continuous excerpt of the file, without rephrasing, correcting or completing it. For \`city\`, the name of the city alone, as it is written, for example "Lille" in "59000 Lille".
- \`deadline\` is the last day to apply that the Job Description gives, in the format YYYY-MM-DD.
- \`applicationEmail\` copies the passage that gives the application address. \`contact1\` and \`contact2\` copy the people to contact, with their details, in the order of the Job Description.
- A field the Job Description does not give is \`null\`.

## Non-negotiable rules

- Never invent a value, and infer it from nothing but the Job Description: when in doubt, \`null\`.
- Write no file other than \`${extractionPath}\`, and never modify the Job Description.
- Search nothing on the web: everything is in the Job Description.
- Never touch the Status of the Posting or the tool's job queue.
`;
}

// The message of the session: the fixed prompt above says everything
export const EXTRACTION_REQUEST = 'Pick out the fields of the Job Description.';
