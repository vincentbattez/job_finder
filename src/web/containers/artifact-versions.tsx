import { ArtifactVersions as ArtifactVersionsView } from '#/web/components/artifact-versions.tsx';
import type { IArtifactVersions } from '#/web/components/artifact.ts';

import { useValidation } from './artifact-view.tsx';
import { ArtifactDocument } from './edition.tsx';
import { useGeneration } from './generation.tsx';

// Every Version of an Artifact, with its generation panel, the choice of a Version and the correction of its
// files; an Artifact of an Interview names it to each action
export function ArtifactVersions({
  reference,
  title,
  interviewNumber = null,
  ...artifactVersions
}: Readonly<IArtifactVersions & { reference: string; title: string; interviewNumber?: number | null }>) {
  const { artifact, isEditable, fileName, versionList } = artifactVersions;
  const renderValidateButton = useValidation({ reference, interviewNumber, artifact });
  const generation = useGeneration({ reference, title, interviewNumber, artifactVersions });
  return (
    <>
      {generation.panel}
      <ArtifactVersionsView
        reference={reference}
        interviewNumber={interviewNumber}
        artifact={artifact}
        isEditable={isEditable}
        fileName={fileName}
        versionList={versionList}
        launch={
          <div className="space-y-2">
            {generation.launch}
            {generation.failure}
          </div>
        }
        renderValidateButton={(number) => renderValidateButton(number, 'validate')}
        renderDocument={(number, document) => (
          <ArtifactDocument
            reference={reference}
            interviewNumber={interviewNumber}
            artifact={artifact}
            number={number}
            {...document}
          />
        )}
      />
    </>
  );
}
