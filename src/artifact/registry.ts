import type { IAiModule } from '#/ai-module/index.ts';
import { tFor } from '#/domain/catalogue/i18n.ts';
import { codedError } from '#/domain/coded-error.ts';
import {
  ARTIFACT_SCHEMA,
  CUSTOM_ARTIFACT_FILE_NAME,
  type Artifact,
  type Candidate,
  type Interview,
  type Locale,
  type Version,
} from '#/domain/index.ts';
import { INTERVIEW_BRIEF_MODULE } from '#/modules/interview-brief/index.ts';
import { LETTER_MODULE } from '#/modules/letter/index.ts';
import { PORTRAIT_MODULE } from '#/modules/portrait/index.ts';
import { RESEARCH_MODULE } from '#/modules/research/index.ts';

// The AI module of each Artifact: what makes one Artifact differ from another is declared there
// (ADR-0003); adding an Artifact is its module folder and a line here (ADR-0016)
export const AI_MODULE_BY_ARTIFACT: Record<Artifact, IAiModule> = {
  research: RESEARCH_MODULE,
  letter: LETTER_MODULE,
  portrait: PORTRAIT_MODULE,
  interview_brief: INTERVIEW_BRIEF_MODULE,
};

// The file of a Version holding its text: its module's, or a Custom Artifact's
export function versionFileNameOf({ artifact }: Pick<Version, 'artifact'>): string {
  return artifact === 'custom' ? CUSTOM_ARTIFACT_FILE_NAME : AI_MODULE_BY_ARTIFACT[artifact].fileName;
}

// Whether its Versions are attached to an Interview rather than to the Posting, as its module declares
export function isAttachedToInterview(artifact: Artifact): boolean {
  return AI_MODULE_BY_ARTIFACT[artifact].isAttachedToInterview === true;
}

// The jf command that names an Artifact, its arguments in order: the number of its Interview comes last,
// for an Artifact attached to one
export function commandOf(argumentList: string[], interview: Pick<Interview, 'number'> | null): string {
  return ['jf', ...argumentList, ...(interview === null ? [] : [String(interview.number)])].join(' ');
}

// An Artifact, or the module that produces it, named after it or by the module's alias
export function parseArtifactName(
  name: string,
  locale: Locale,
  errorCode: 'unknown_module' | 'unknown_artifact',
): Artifact {
  const artifact = ARTIFACT_SCHEMA.options.find(
    (option) => name === option || name === AI_MODULE_BY_ARTIFACT[option].alias,
  );
  if (artifact === undefined) {
    const nameList = Object.entries(AI_MODULE_BY_ARTIFACT).map(([option, aiModule]) => aiModule.alias ?? option);
    throw codedError(errorCode, { name, names: nameList.join(', ') }, { locale });
  }
  return artifact;
}

// Named by its Artifact or its alias, as jf run names it
export function parseModule(name: string, locale: Locale): Artifact {
  return parseArtifactName(name, locale, 'unknown_module');
}

// Those of the Candidate's locale, the ones they read and edit; the Artifact's language is set by the
// fixed part of the prompt
export function findDefaultInstructions(module: Artifact, candidate: Candidate): string {
  return tFor(candidate.locale, 'defaultInstructions')(module);
}
