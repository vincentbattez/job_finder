import { describeArtifactLanguage, describeMessage, type IPromptInput } from '#/ai-module/index.ts';
import { parisDateTimeOf } from '#/domain/paris-time.ts';

export const PORTRAIT_FILE_NAME = 'portrait.md';

// The round whose Interviewers it portrays, as the Candidate typed it
function describeInterview({ interview, mark }: IPromptInput): string {
  if (interview === null) {
    return '';
  }
  const { number, startAt, place, interviewers } = interview;
  return `
## The Interview

The Portrait is that of the Interviewers of Interview ${mark(String(number))} of this Posting:
- Start: ${mark(parisDateTimeOf(startAt).replace('T', ' '))}, Paris time
- Place: ${mark(place === '' ? 'not specified' : place)}
- Interviewers, as the Candidate describes them: ${mark(interviewers === '' ? 'not specified' : interviewers)}
`;
}

// The Chosen Research situates the Interviewers in their department, when the Candidate checked it
function describeResearch(readVersionList: IPromptInput['readVersionList']): string {
  return readVersionList.some(({ artifact }) => artifact === 'research')
    ? 'The Chosen Research establishes the context of the Posting, its department and its employer.'
    : 'You have no Research for this Posting: rely on the Job Description.';
}

// The fixed part: its objective and output, and the rules no Instructions can lift (ADR-0003); its Inputs
// follow it, inlined (ADR-0021)
export function composePortraitPrompt(input: IPromptInput): string {
  const { posting, outputDirectory, readVersionList, mark } = input;
  const outputPath = mark(`${outputDirectory}/${PORTRAIT_FILE_NAME}`);
  return `You write the Portrait of the Interviewers a Candidate will face at one Interview of a job Posting: what is publicly known of their career and professional positions, so that the Candidate understands who they will face and adapts their pitch. ${describeArtifactLanguage('Portrait')}

## The Posting

- Reference: ${mark(posting.reference)}
- Title: ${mark(posting.title)}
- Employer: ${mark(posting.employer ?? 'not specified')}
- Place of work: ${mark(posting.workplace ?? 'not specified')}
${describeInterview(input)}
## What you read

${describeMessage()} The Job Description is as it was published. ${describeResearch(readVersionList)}

## What you produce

A single Markdown file: \`${outputPath}\`, which starts with a level 1 heading (\`# …\`). The Candidate's Instructions say what to look for and how to present it.

## Non-negotiable rules

- Never invent a fact about an Interviewer: what you cannot establish, say that you could not.
- Write nothing about the private life of a person, whatever the Instructions ask.
- Write no file other than \`${outputPath}\`.
- Never touch the Status of the Posting or the tool's job queue.
- The Candidate's Instructions say what to look for and how to present the Portrait. If they contradict the expected file, its language or these rules, this fixed part prevails.
`;
}
