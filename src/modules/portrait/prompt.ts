import { describeArtifactLanguage, type IPromptInput } from '#/ai-module/index.ts';
import { JOB_DESCRIPTION_FILE_NAME, type Interview } from '#/domain/index.ts';
import { parisDateTimeOf } from '#/domain/paris-time.ts';

export const PORTRAIT_FILE_NAME = 'portrait.md';

// The round whose Interviewers it portrays, as the Candidate typed it
function describeInterview(interview: Interview | null): string {
  if (interview === null) {
    return '';
  }
  const { number, startAt, place, interviewers } = interview;
  return `
## The Interview

The Portrait is that of the Interviewers of Interview ${String(number)} of this Posting:
- Start: ${parisDateTimeOf(startAt).replace('T', ' ')}, Paris time
- Place: ${place === '' ? 'not specified' : place}
- Interviewers, as the Candidate describes them: ${interviewers === '' ? 'not specified' : interviewers}
`;
}

// The Chosen Research situates the Interviewers in their department, when there is one
function describeResearch(readVersionList: IPromptInput['readVersionList']): string {
  const research = readVersionList.find(({ artifact }) => artifact === 'research');
  return research === undefined
    ? 'The Candidate has no Research for this Posting: rely on the Job Description.'
    : `The Chosen Research, which establishes the context of the Posting, its department and its employer: \`${research.filePath}\`.`;
}

// The fixed part: its objective, inputs and output, and the rules no Instructions can lift (ADR-0003)
export function composePortraitPrompt({ posting, interview, outputDirectory, readVersionList }: IPromptInput): string {
  const outputPath = `${outputDirectory}/${PORTRAIT_FILE_NAME}`;
  return `You write the Portrait of the Interviewers a Candidate will face at one Interview of a job Posting: what is publicly known of their career and professional positions, so that the Candidate understands who they will face and adapts their pitch. ${describeArtifactLanguage('Portrait')}

## The Posting

- Reference: ${posting.reference}
- Title: ${posting.title}
- Employer: ${posting.employer ?? 'not specified'}
- Place of work: ${posting.workplace ?? 'not specified'}

The current folder is the Posting's.
${describeInterview(interview)}
## What you read

- The Job Description, as it was published: \`${JOB_DESCRIPTION_FILE_NAME}\`.
- ${describeResearch(readVersionList)}

## What you produce

A single Markdown file: \`${outputPath}\`, which starts with a level 1 heading (\`# …\`). The Candidate's Instructions say what to look for and how to present it.

## Non-negotiable rules

- Never invent a fact about an Interviewer: what you cannot establish, say that you could not.
- Write nothing about the private life of a person, whatever the Instructions ask.
- Write no file other than \`${outputPath}\`, and never modify the Job Description or the Research.
- Never touch the Status of the Posting or the tool's job queue.
- The next message holds the Candidate's Instructions: they say what to look for and how to present the Portrait. If they contradict the expected file, its language or these rules, this fixed part prevails.
`;
}
