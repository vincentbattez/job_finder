import { catalogueOf } from '#/domain/catalogue/index.ts';
import {
  JOB_DESCRIPTION_FILE_NAME,
  LANGUAGE_BY_LOCALE,
  type Artifact,
  type Candidate,
  type Posting,
} from '#/domain/index.ts';
import { DRAFT_FILE_NAME, LETTER_MODULE } from '#/modules/letter/index.ts';

interface IEditedArtifact {
  candidate: Candidate;
  posting: Posting;
  artifact: Artifact;
  // The folder of the Chosen Version, relative to the Posting folder
  versionPath: string;
}

// Fixed, with no Instructions to replace it (ADR-0003); the session runs in the Posting folder, its
// "current folder". It talks in the Candidate's locale, the Artifact stays in its own language.
export function composeEditPrompt({ candidate, posting, artifact, versionPath }: IEditedArtifact): string {
  const { name } = candidate;
  // The prompt is in English, as the rest of the code: the Artifact goes by its English name
  const artifactName = catalogueOf({ locale: 'en' }).common.artifactLabelByArtifact[artifact];
  const letterFiles =
    artifact === 'letter'
      ? ` The Letter to correct is \`${versionPath}/${LETTER_MODULE.fileName}\`, and \`${versionPath}/${DRAFT_FILE_NAME}\` is its Draft, what the AI wrote.`
      : '';
  return `You help ${name} modify the ${artifactName} of Posting ${posting.reference}, "${posting.title}". Talk with ${name} in ${LANGUAGE_BY_LOCALE[candidate.locale]}.

The current folder is this Posting's: \`${JOB_DESCRIPTION_FILE_NAME}\` is its Job Description, and each Artifact has one folder per Version there, numbered \`v1\`, \`v2\`…

You modify the Chosen Version of the ${artifactName}, the folder \`${versionPath}/\`: it is the one the tool relies on next.${letterFiles}

Steps:
1. Read the files of \`${versionPath}/\` and the Job Description, then ask ${name} what to modify.
2. Modify these files in place: never create a new Version.

Non-negotiable rules:
- Modify only the files of \`${versionPath}/\`: not the other Versions, the other Artifacts or the Job Description.
- Never modify a Draft (\`${DRAFT_FILE_NAME}\`): it stays as the AI wrote it, so that the tool learns from ${name}'s corrections by comparing it with the Letter.
- Keep the ${artifactName} in its own language, that of the Job Description, whatever the language you talk with ${name} in.
- Never invent a fact about ${name}, the employer or the Posting. If a piece of information is missing, ask ${name} for it or leave a \`[à compléter : …]\` marker.
- Keep the structure of the files: their headings, their sections and the links to their sources.
`;
}
