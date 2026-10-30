import { describeArtifactLanguage, type IPromptInput } from '#/ai-module/index.ts';
import { JOB_DESCRIPTION_FILE_NAME } from '#/domain/index.ts';

export const INTERVIEW_BRIEF_FILE_NAME = 'interview-brief.md';

// The Chosen Letter when there is one: the recruiters question the Candidate on what it says
function describeLetter(readVersionList: IPromptInput['readVersionList']): string {
  const letter = readVersionList.find(({ artifact }) => artifact === 'letter');
  return letter === undefined
    ? 'The Candidate has no Letter for this Posting: prepare the interview without it.'
    : `The Chosen Letter, the one the Candidate sent or is about to send: \`${letter.filePath}\`. The recruiters will have read it: prepare the questions they will ask about what it says.`;
}

// The fixed part: its objective, inputs and output, and the rules no Instructions can lift (ADR-0003)
export function composeInterviewBriefPrompt({
  posting,
  outputDirectory,
  readVersionList,
  profileDirectory,
}: IPromptInput): string {
  const outputPath = `${outputDirectory}/${INTERVIEW_BRIEF_FILE_NAME}`;
  const researchList = readVersionList.filter(({ artifact }) => artifact === 'research');
  return `You write a Candidate's Interview Brief for a job Posting: what they must revise and how to practise before the recruitment interview. ${describeArtifactLanguage('Interview Brief')}

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
- The Candidate's Profile, in \`${profileDirectory}\`: the facts they validated, their CV and their past letters, when they exist. Read each of its files: it is the only source of facts about the Candidate.
- ${describeLetter(readVersionList)}

## What you produce

A single Markdown file: \`${outputPath}\`, which starts with a level 1 heading (\`# …\`). The Candidate's Instructions say how to organise it.

## Non-negotiable rules

- Never invent a fact about the Candidate: degrees, dates, internships, experience, skills, motivations, mobility. Each fact comes from their Profile or their Letter. Infer nothing that is not written there.
- Wherever the Interview Brief needs a fact you do not have, write in its place a marker \`[à compléter : …]\` that says precisely what is missing, for example \`[à compléter : sujet du mémoire de master]\`. Keep the words \`à compléter\` as they are, whatever the language of the Interview Brief: the tool highlights them.
- Invent no fact about the Posting or the employer: rely on the Job Description and the Chosen Research.
- Write no file other than \`${outputPath}\`, and never modify the Job Description, the Research, the Profile or the Letter.
- Never touch the Status of the Posting or the tool's job queue.
- The next message holds the Candidate's Instructions: they say how to prepare, organise and present the Interview Brief. If they contradict what you read, the expected file, its language or these rules, this fixed part prevails.
`;
}
