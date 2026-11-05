import type { TFunction } from 'i18next';

import { profileDocumentKindOf } from '#/actions/profile-document.ts';

import type { GenerationInput, RecordedInput } from './artifact.ts';

type NamedInput = GenerationInput | RecordedInput;

// An Artifact read, of this Posting, of one of its Interviews or of the Posting a Repost publishes again
function artifactLabelOf(t: TFunction<'posting'>, reference: string, { readVersion, artifact }: NamedInput): string {
  const artifactLabel = artifact === null ? '' : t(`artifactLabelByArtifact.${artifact}`, { ns: 'common' });
  if (readVersion === null) {
    return t('generation.inputLabel.artifactMissing', { artifactLabel });
  }
  const { number, interviewNumber } = readVersion;
  if (readVersion.reference !== reference) {
    return t('generation.inputLabel.artifactOfPosting', { artifactLabel, number, reference: readVersion.reference });
  }
  return interviewNumber === null
    ? t('generation.inputLabel.artifact', { artifactLabel, number })
    : t('generation.inputLabel.artifactOfInterview', { artifactLabel, number, interviewNumber });
}

// A document of the Profile, told apart by its name
function profileDocumentLabelOf(t: TFunction<'posting'>, fileName: string | null): string {
  const kind = fileName === null ? 'annex' : profileDocumentKindOf(fileName);
  return kind === 'cv' || kind === 'facts'
    ? t(`generation.inputLabel.${kind}`)
    : t('generation.inputLabel.annex', { name: fileName });
}

// An Input as the Candidate names it, in the generation panel and on the Version it produced
export function inputLabelOf(t: TFunction<'posting'>, reference: string, input: NamedInput): string {
  const { kind, fileName, title } = input;
  switch (kind) {
    case 'job_description': {
      return t('generation.inputLabel.jobDescription');
    }
    case 'notes': {
      return t('generation.inputLabel.notes');
    }
    case 'profile_document': {
      return profileDocumentLabelOf(t, fileName);
    }
    case 'past_letter': {
      const sentTitle = input.readVersion !== null && 'title' in input.readVersion ? input.readVersion.title : '';
      return fileName === null
        ? t('generation.inputLabel.sentLetter', { title: sentTitle })
        : t('generation.inputLabel.pastLetter', { name: fileName });
    }
    case 'artifact': {
      return artifactLabelOf(t, reference, input);
    }
    case 'custom_artifact': {
      // Gone with the Interview it was attached to, the Version that read it still recording it
      return title === null
        ? t('generation.inputLabel.customArtifactGone')
        : t('generation.inputLabel.customArtifact', { title });
    }
  }
}
