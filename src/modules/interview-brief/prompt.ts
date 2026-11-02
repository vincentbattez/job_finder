import { describeArtifactLanguage, type IPromptInput } from '#/ai-module/index.ts';
import { JOB_DESCRIPTION_FILE_NAME, type Interview } from '#/domain/index.ts';
import { parisDateTimeOf } from '#/domain/paris-time.ts';
import { describeProfile } from '#/profile/prompt.ts';

export const INTERVIEW_BRIEF_FILE_NAME = 'interview-brief.md';

// The Chosen Letter when there is one: the recruiters question the Candidate on what it says; the
// Letters of other Postings it reads are Past Letters
function describeLetter({ posting, readVersionList }: IPromptInput): string {
  const letter = readVersionList.find(
    ({ artifact, reference }) => artifact === 'letter' && reference === posting.reference,
  );
  return letter === undefined
    ? 'The Candidate has no Letter for this Posting: prepare the interview without it.'
    : `The Chosen Letter, the one the Candidate sent or is about to send: \`${letter.filePath}\`. The recruiters will have read it: prepare the questions they will ask about what it says.`;
}

// The Chosen Portrait of its Interview when there is one: who the Interviewers are, as the Candidate corrected it
function describePortrait(readVersionList: IPromptInput['readVersionList']): string {
  const portrait = readVersionList.find(({ artifact }) => artifact === 'portrait');
  return portrait === undefined
    ? 'No Portrait of the Interviewers for this Interview: rely on what the Candidate describes of them.'
    : `The Chosen Portrait of the Interviewers: \`${portrait.filePath}\`. The Candidate checked it: adapt the pitch to who they are.`;
}

// The round it prepares, as the Candidate typed it: its start in Paris time, and who they will face
function describeInterview(interview: Interview | null): string {
  if (interview === null) {
    return '';
  }
  const { number, startAt, durationMinutes, place, interviewers } = interview;
  return `
## The Interview

The Interview Brief prepares Interview ${String(number)} of this Posting, and no other:
- Start: ${parisDateTimeOf(startAt).replace('T', ' ')}, Paris time; duration: ${String(durationMinutes)} minutes
- Place: ${place === '' ? 'not specified' : place}
- Interviewers, as the Candidate describes them: ${interviewers === '' ? 'not specified' : interviewers}
`;
}

// The Notes are the Candidate's own words: what they learned of the Posting, a call, feedback from a round
function describeNotes(notes: string | null): string {
  return notes === null || notes.trim() === ''
    ? 'The Candidate keeps no Notes on this Posting.'
    : `The Candidate's Notes on this Posting, between the two lines:\n\n---\n${notes.trim()}\n---`;
}

// The Chosen Interview Briefs of the rounds before this one: build on them rather than repeat them
function describePreviousBriefs(readVersionList: IPromptInput['readVersionList']): string {
  const briefList = readVersionList.filter(({ artifact }) => artifact === 'interview_brief');
  return briefList.length === 0
    ? '- This is the first Interview of the Posting: no previous Interview Brief.'
    : briefList
        .map(
          ({ interviewNumber, filePath }) =>
            `- The Chosen Interview Brief of the previous Interview ${String(interviewNumber)}: \`${filePath}\`. Build on what it prepared rather than repeating it.`,
        )
        .join('\n');
}

// The fixed part: its objective, inputs and output, and the rules no Instructions can lift (ADR-0003)
export function composeInterviewBriefPrompt(input: IPromptInput): string {
  const { posting, interview, notes, outputDirectory, readVersionList, profileDirectory } = input;
  const outputPath = `${outputDirectory}/${INTERVIEW_BRIEF_FILE_NAME}`;
  const researchList = readVersionList.filter(({ artifact }) => artifact === 'research');
  return `You write a Candidate's Interview Brief for one Interview of a job Posting: what they must revise, what to tell the Interviewers and how to practice before this round. ${describeArtifactLanguage('Interview Brief')}

## The Posting

- Reference: ${posting.reference}
- Title: ${posting.title}
- Employer: ${posting.employer ?? 'not specified'}
- Place of work: ${posting.workplace ?? 'not specified'}

The current folder is the Posting's.
${describeInterview(interview)}
## What you read

Read before writing:
- The Job Description, as it was published: \`${JOB_DESCRIPTION_FILE_NAME}\`.
${researchList.map(({ filePath }) => `- The Chosen Research, which establishes what the recruiters expect and in what context: \`${filePath}\`.`).join('\n')}
- ${describeProfile(profileDirectory)}
- ${describeLetter(input)}
- ${describePortrait(readVersionList)}
${describePreviousBriefs(readVersionList)}

${describeNotes(notes)}

## What you produce

A single Markdown file: \`${outputPath}\`, which starts with a level 1 heading (\`# …\`). The Candidate's Instructions say how to organize it.

## Non-negotiable rules

- Never invent a fact about the Candidate: degrees, dates, internships, experience, skills, motivations, mobility. Each fact comes from their Profile or their Letter. Infer nothing that is not written there.
- Wherever the Interview Brief needs a fact you do not have, write in its place a marker \`[à compléter : …]\` that says precisely what is missing, for example \`[à compléter : sujet du mémoire de master]\`. Keep the words \`à compléter\` as they are, whatever the language of the Interview Brief: the tool highlights them.
- Invent no fact about the Posting or the employer: rely on the Job Description and the Chosen Research.
- Invent no fact about the Interviewers: rely on what the Candidate describes of them and on the Portrait.
- Write no file other than \`${outputPath}\`, and never modify the Job Description, the Research, the Profile, the Letter, the Portrait or a previous Interview Brief.
- Never touch the Status of the Posting or the tool's job queue.
- The next message holds the Candidate's Instructions: they say how to prepare, organize and present the Interview Brief. If they contradict what you read, the expected file, its language or these rules, this fixed part prevails.
`;
}
