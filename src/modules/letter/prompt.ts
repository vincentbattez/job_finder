// The salutation of the example is in the French of the Job Descriptions: cspell:ignore Présidente
import { describeArtifactLanguage, type IPromptInput } from '#/ai-module/index.ts';
import { JOB_DESCRIPTION_FILE_NAME } from '#/domain/index.ts';

import { RECIPIENTS_FILE_NAME } from './acl/recipients.ts';

// The Draft the session writes, never modified, and the Letter the Candidate corrects, its copy
export const DRAFT_FILE_NAME = 'draft.md';
export const LETTER_FILE_NAME = 'letter.md';

function quote(field: string | null): string {
  return field === null ? 'not given' : `"${field.trim()}"`;
}

// The pairs Draft/Letter the Candidate already sent, one folder per Applied Posting
function describeSentLetters(sentList: IPromptInput['readVersionList']): string {
  if (sentList.length === 0) {
    return 'The Candidate has not sent any Letter yet.';
  }
  const folderList = sentList.map(({ reference, directory }) => `- Posting ${reference}: \`${directory}\``);
  return `The Letters the Candidate already sent, one per folder. Each folder holds the Draft the tool wrote (\`${DRAFT_FILE_NAME}\`) and the Letter as the Candidate corrected then sent it (\`${LETTER_FILE_NAME}\`). Compare each pair: their corrections show their style and what they reject, apply them.
${folderList.join('\n')}`;
}

// The fixed part of the prompt of the Letter: what it reads, what it writes and where, and the
// rules no Instructions can lift (ADR-0003). It runs in the folder of the Posting.
export function composeLetterPrompt({
  posting,
  outputDirectory,
  readVersionList,
  profileDirectory,
}: IPromptInput): string {
  const researchList = readVersionList.filter(({ artifact }) => artifact === 'research');
  const sentList = readVersionList.filter(({ artifact }) => artifact === 'letter');
  return `You write the Draft of a Candidate's cover letter for a job Posting, and you recommend whom to send it to. ${describeArtifactLanguage('Draft')}

## The Posting

- Reference: ${posting.reference}
- Title: ${posting.title}
- Employer: ${posting.employer ?? 'not specified'}
- Place of work: ${posting.workplace ?? 'not specified'}

The current folder is the Posting's.

## What you read

Read everything before writing:
- The Job Description, as it was published: \`${JOB_DESCRIPTION_FILE_NAME}\`.
${researchList.map(({ filePath }) => `- The Chosen Research, which establishes what the recruiters expect and in what context: \`${filePath}\`.`).join('\n')}
- The Candidate's Profile, in \`${profileDirectory}\`: the facts they validated, their CV and their past letters, when they exist. Read each of its files: it is the only source of facts about the Candidate, and their past letters show their style.
- ${describeSentLetters(sentList)}

## The contacts of the Posting, as published

- \`applicationEmail\`, the application email: ${quote(posting.applicationEmail)}
- \`contact1\`, the first person to contact: ${quote(posting.contact1)}
- \`contact2\`, the second person to contact: ${quote(posting.contact2)}

These are free-text fields: an address may be mixed with a name, a function, a phone number or an instruction ("secretariat in copy"), and a field may give no address at all. Interpret them, and resolve the ambiguity between them: where to send, whom to copy, whom the letter is addressed to.

## What you produce

1. \`${outputDirectory}/${DRAFT_FILE_NAME}\`: the Draft, the whole letter in Markdown, from the salutation to the signature, ready to be corrected then pasted into an email.
2. \`${outputDirectory}/${RECIPIENTS_FILE_NAME}\`: the recommended recipients, as JSON, exactly in this shape:

\`\`\`json
{
  "to": { "email": "address@example.fr", "source": "applicationEmail" },
  "ccList": [{ "email": "copy@example.fr", "source": "contact2" }],
  "salutation": { "text": "Madame la Présidente,", "source": "contact1" },
  "justification": "Why these choices, in a few sentences."
}
\`\`\`

- \`to\`: the address to send the application to, or \`null\` if no field gives one.
- \`ccList\`: the addresses to copy, possibly none (\`[]\`).
- \`salutation\`: the salutation of the letter, the same as the Draft's.
- \`source\`: the field the information comes from, \`applicationEmail\`, \`contact1\` or \`contact2\`. For the salutation, the field that names the person or the function the letter is addressed to, or \`null\` for a generic salutation.
- \`email\`: the address alone, copied as it appears in the \`source\` field, with no name or text around it.
- \`justification\`: why this recipient, these copies and this salutation, based on the fields.

## Non-negotiable rules

- Never invent a fact about the Candidate: degrees, dates, internships, experience, skills, motivations, mobility. Each fact comes from their Profile or from the Letters they already sent. Infer nothing that is not written there.
- Wherever the letter needs a fact you do not have, write in its place a marker \`[à compléter : …]\` that says precisely what is missing, for example \`[à compléter : intitulé et année du master]\`. Keep the words \`à compléter\` as they are, whatever the language of the letter: the tool highlights them so that none is sent. Ten markers are better than a single invented fact.
- Invent no fact about the Posting or the employer: rely on the Job Description and the Chosen Research. Invent no address: each one appears in the field it cites.
- Write no file other than these two, and never modify the Job Description, the Research, the Profile or the Letters already sent.
- Never touch the Status of the Posting or the tool's job queue.
- The next message holds the Candidate's Instructions: they say how to write the letter. If they contradict what you read, the expected files, their language or these rules, this fixed part prevails.
`;
}
