import { INPUT_HEADING_PREFIX, INPUTS_HEADING, INSTRUCTIONS_HEADING, type IPromptInput } from '#/ai-module/index.ts';
import type { Artifact, Posting } from '#/domain/index.ts';
import { MARK_END, MARK_START } from '#/domain/substitution.ts';

import type { IInput } from './inputs.ts';

// Each value a composer substitutes, marked for the generation panel to highlight (spec #125)
export const markSubstitution: IPromptInput['mark'] = (value) => `${MARK_START}${value}${MARK_END}`;

export const leaveUnmarked: IPromptInput['mark'] = (value) => value;

// The name of an Artifact in the Prompt, written in English like the Fixed Parts
const ARTIFACT_NAME_BY_ARTIFACT: Record<Artifact, string> = {
  research: 'Research',
  letter: 'Letter',
  portrait: 'Portrait',
  interview_brief: 'Interview Brief',
};

// The heading of an Input in the Prompt: what it is, and whose, when it is not of the run's own Posting
function headingOf({ kind, readVersion, fileName, title }: IInput, posting: Posting): string {
  if (kind === 'custom_artifact') {
    return `Custom Artifact: ${title ?? ''}`;
  }
  if (readVersion !== null) {
    const { posting: readPosting, version } = readVersion;
    if (kind === 'past_letter') {
      return `Letter sent for Posting ${readPosting.reference}`;
    }
    const name =
      version.artifact === 'custom' ? 'Custom Artifact' : `Chosen ${ARTIFACT_NAME_BY_ARTIFACT[version.artifact]}`;
    if (readPosting.id !== posting.id) {
      return `${name} of Posting ${readPosting.reference}`;
    }
    return version.interview === null ? name : `${name} of Interview ${String(version.interview.number)}`;
  }
  if (fileName !== null) {
    return `${kind === 'past_letter' ? 'Past Letter' : 'Profile'}: ${fileName}`;
  }
  return kind === 'notes' ? "The Candidate's Notes" : 'Job Description';
}

// What follows the Fixed Part, as the session's message: each checked Input under its own heading with its
// content, then the Instructions in effect (ADR-0021)
export function composeMessage(posting: Posting, checkedList: IInput[], instructions: string): string {
  return [
    `# ${INPUTS_HEADING}`,
    ...checkedList.map((input) => `## ${INPUT_HEADING_PREFIX}${headingOf(input, posting)}\n\n${input.content.trim()}`),
    `# ${INSTRUCTIONS_HEADING}`,
    instructions.trim(),
  ].join('\n\n');
}

// The Prompt as one Markdown document, the one the generation panel copies: the Fixed Part, then the message
export function promptOf({ fixedPrompt, message }: { fixedPrompt: string; message: string }): string {
  return `${fixedPrompt.trimEnd()}\n\n---\n\n${message}`;
}
