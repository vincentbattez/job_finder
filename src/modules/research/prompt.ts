import { describeArtifactLanguage, describeMessage, type IPromptInput } from '#/ai-module/index.ts';

export const RESEARCH_FILE_NAME = 'research.md';

// A Repost starts from the Artifacts of the Posting it publishes again, so the work is not
// done twice
function describeRepostedPosting({ readVersionList, mark }: IPromptInput): string {
  const [firstVersion] = readVersionList;
  if (firstVersion === undefined) {
    return '';
  }
  return `
## The Posting published before

This Posting is the Repost of Posting ${mark(firstVersion.reference)}: the same Position, published again. The Inputs hold the Chosen Artifacts of that earlier Posting, to read before searching.

Do not do that work again: start from its Research, check what the Job Description of this Posting and the news change, and carry over what still holds, with its sources.
`;
}

// The fixed part sets the objective and the rules no Instructions can lift (ADR-0003); the way to
// reach it is left to the session and its Instructions. Its Inputs follow it, inlined (ADR-0021).
export function composeResearchPrompt(input: IPromptInput): string {
  const { posting, outputDirectory, mark } = input;
  const outputPath = mark(`${outputDirectory}/${RESEARCH_FILE_NAME}`);
  return `You produce the Research of a job Posting, for the Candidate who is going to apply to it. ${describeArtifactLanguage('Research')}

## Objective

Establish, with sources, what the recruiters expect for this Posting, and in what context: the employer, the department, the place. The Candidate will use it to write their cover letter and prepare their interview. It is up to you to decide what deserves digging into to get there.

## The Posting

- Reference: ${mark(posting.reference)}
- Title: ${mark(posting.title)}
- Employer: ${mark(posting.employer ?? 'not specified')}
- Place of work: ${mark(posting.workplace ?? 'not specified')}
- Advert: ${mark(posting.url ?? 'not specified')}

${describeMessage()} Start with the Job Description, as it was published.
${describeRepostedPosting(input)}
## What you produce

A single Markdown file: \`${outputPath}\`.
- It starts with a level 1 heading (\`# …\`).
- Each claim is followed by its source: a Markdown link to the page that establishes it.
- It ends with a \`## Sources\` section listing each cited source, with its URL.

## Research discipline

Carry out the research yourself.
- Rely on primary sources: the website of the employer or of the court, official texts, the reports and press releases of institutions, and for the news the articles that report it directly. Trace each claim back to the source that holds it, rather than citing a second-hand summary.
- Each claim is sourced. What you cannot source, do not write as a fact: present it as a hypothesis or an open question.

## Non-negotiable rules

- Never invent a fact.
- Write no file other than \`${outputPath}\`.
- Never touch the Status of the Posting or the tool's job queue.
- The Candidate's Instructions say how to carry out and present the Research. If they contradict the objective, the expected file, its language or these rules, this fixed part prevails.
`;
}
