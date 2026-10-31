import { ArtifactVersions as ArtifactVersionsView } from '#/web/components/artifact-versions.tsx';
import type { IArtifactVersions } from '#/web/components/posting-detail.tsx';

import { ArtifactDocument, ChooseButton } from './edition.tsx';
import { ModuleLaunch } from './module-launch.tsx';

// Every Version of an Artifact, with the launch of its module, the choice of a Version and the
// correction of its files; an Artifact of an Interview names it to each action
export function ArtifactVersions({
  reference,
  interviewNumber = null,
  artifact,
  state,
  failure,
  notificationFailure,
  module,
  isEditable,
  versionList,
  workerFailure,
}: Readonly<IArtifactVersions & { reference: string; interviewNumber?: number | null }>) {
  return (
    <ArtifactVersionsView
      reference={reference}
      interviewNumber={interviewNumber}
      artifact={artifact}
      isEditable={isEditable}
      prompt={module.prompt}
      versionList={versionList}
      launch={
        <ModuleLaunch
          reference={reference}
          interviewNumber={interviewNumber}
          artifact={artifact}
          state={state}
          failure={failure}
          notificationFailure={notificationFailure}
          module={module}
          workerFailure={workerFailure}
        />
      }
      renderChooseButton={(number) => (
        <ChooseButton reference={reference} interviewNumber={interviewNumber} artifact={artifact} number={number} />
      )}
      renderDocument={(document) => (
        <ArtifactDocument reference={reference} interviewNumber={interviewNumber} artifact={artifact} {...document} />
      )}
    />
  );
}
