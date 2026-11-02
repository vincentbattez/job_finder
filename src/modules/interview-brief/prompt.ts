import { describeArtifactLanguage, describeMessage, type IPromptInput } from '#/ai-module/index.ts';
import { parisDateTimeOf } from '#/domain/paris-time.ts';
import { describeProfile } from '#/profile/prompt.ts';

export const INTERVIEW_BRIEF_FILE_NAME = 'interview-brief.md';

// The Chosen Letter of its Posting when the Candidate checked it: the recruiters question the Candidate on
// what it says; the Letters sent for other Postings are Past Letters
function describeLetter({ posting, readVersionList }: IPromptInput): string {
  const hasLetter = readVersionList.some(
    ({ artifact, reference }) => artifact === 'letter' && reference === posting.reference,
  );
  return hasLetter
    ? 'The Inputs hold the Chosen Letter, the one the Candidate sent or is about to send. The recruiters will have read it: prepare the questions they will ask about what it says.'
    : 'The Candidate has no Letter for this Posting: prepare the interview without it.';
}

// The Chosen Portrait of its Interview when there is one: who the Interviewers are, as the Candidate corrected it
function describePortrait(readVersionList: IPromptInput['readVersionList']): string {
  return readVersionList.some(({ artifact }) => artifact === 'portrait')
    ? 'The Inputs hold the Chosen Portrait of the Interviewers, which the Candidate checked: adapt the pitch to who they are.'
    : 'No Portrait of the Interviewers for this Interview: rely on what the Candidate describes of them.';
}

// The round it prepares, as the Candidate typed it: its start in Paris time, and who they will face
function describeInterview({ interview, mark }: IPromptInput): string {
  if (interview === null) {
    return '';
  }
  const { number, startAt, durationMinutes, place, interviewers } = interview;
  return `
## The Interview

The Interview Brief prepares Interview ${mark(String(number))} of this Posting, and no other:
- Start: ${mark(parisDateTimeOf(startAt).replace('T', ' '))}, Paris time; duration: ${mark(String(durationMinutes))} minutes
- Place: ${mark(place === '' ? 'not specified' : place)}
- Interviewers, as the Candidate describes them: ${mark(interviewers === '' ? 'not specified' : interviewers)}
`;
}

// The Chosen Interview Briefs of the rounds before this one: build on them rather than repeat them
function describePreviousBriefs({ readVersionList, mark }: IPromptInput): string {
  const briefList = readVersionList.filter(({ artifact }) => artifact === 'interview_brief');
  return briefList.length === 0
    ? '- This is the first Interview of the Posting, or the Candidate left out the previous Interview Briefs.'
    : briefList
        .map(
          ({ interviewNumber }) =>
            `- The Chosen Interview Brief of the previous Interview ${mark(String(interviewNumber))}: build on what it prepared rather than repeating it.`,
        )
        .join('\n');
}

// The fixed part: its objective and output, and the rules no Instructions can lift (ADR-0003); its Inputs
// follow it, inlined (ADR-0021)
export function composeInterviewBriefPrompt(input: IPromptInput): string {
  const { posting, outputDirectory, readVersionList, mark } = input;
  const outputPath = mark(`${outputDirectory}/${INTERVIEW_BRIEF_FILE_NAME}`);
  return `You write a Candidate's Interview Brief for one Interview of a job Posting: what they must revise, what to tell the Interviewers and how to practice before this round. ${describeArtifactLanguage('Interview Brief')}

## The Posting

- Reference: ${mark(posting.reference)}
- Title: ${mark(posting.title)}
- Employer: ${mark(posting.employer ?? 'not specified')}
- Place of work: ${mark(posting.workplace ?? 'not specified')}

The current folder is the Posting's.
${describeInterview(input)}
## What you read

${describeMessage()} The Job Description is as it was published, and the Chosen Research establishes what the recruiters expect and in what context.
- ${describeProfile()}
- ${describeLetter(input)}
- ${describePortrait(readVersionList)}
${describePreviousBriefs(input)}
- The Candidate's Notes, when the Inputs hold them, are their own words: what they learned of the Posting, a call, feedback from a round.

## What you produce

A single Markdown file: \`${outputPath}\`, which starts with a level 1 heading (\`# …\`). The Candidate's Instructions say how to organize it.

## Non-negotiable rules

- Never invent a fact about the Candidate: degrees, dates, internships, experience, skills, motivations, mobility. Each fact comes from their Profile or their Letter. Infer nothing that is not written there.
- Wherever the Interview Brief needs a fact you do not have, write in its place a marker \`[à compléter : …]\` that says precisely what is missing, for example \`[à compléter : sujet du mémoire de master]\`. Keep the words \`à compléter\` as they are, whatever the language of the Interview Brief: the tool highlights them.
- Invent no fact about the Posting or the employer: rely on the Job Description and the Chosen Research.
- Invent no fact about the Interviewers: rely on what the Candidate describes of them and on the Portrait.
- Write no file other than \`${outputPath}\`.
- Never touch the Status of the Posting or the tool's job queue.
- The Candidate's Instructions say how to prepare, organize and present the Interview Brief. If they contradict what you read, the expected file, its language or these rules, this fixed part prevails.
`;
}
