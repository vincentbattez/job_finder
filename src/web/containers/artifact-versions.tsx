import { ArtifactVersions as ArtifactVersionsView } from '#/web/components/artifact-versions.tsx';
import type { IArtifactVersions } from '#/web/components/posting-detail.tsx';

import { ArtifactDocument, ChooseButton } from './edition.tsx';
import { ModuleLaunch } from './module-launch.tsx';

// Every Version of an Artifact, with the launch of its module, the choice of a Version and the
// correction of its files
export function ArtifactVersions({
  reference,
  artifact,
  state,
  failure,
  notificationFailure,
  module,
  isEditable,
  versionList,
  workerFailure,
}: Readonly<IArtifactVersions & { reference: string }>) {
  return (
    <ArtifactVersionsView
      reference={reference}
      artifact={artifact}
      isEditable={isEditable}
      versionList={versionList}
      launch={
        <ModuleLaunch
          reference={reference}
          artifact={artifact}
          state={state}
          failure={failure}
          notificationFailure={notificationFailure}
          module={module}
          workerFailure={workerFailure}
        />
      }
      renderChooseButton={(number) => <ChooseButton reference={reference} artifact={artifact} number={number} />}
      renderDocument={(document) => <ArtifactDocument reference={reference} artifact={artifact} {...document} />}
    />
  );
}
