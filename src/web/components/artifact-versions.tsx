import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge, StateBadge } from './badge.tsx';
import { CopyCommand } from './copy-command.tsx';
import { DateText } from './date.tsx';
import { ArtifactDocument, ChooseButton } from './edition.tsx';
import { Markdown } from './markdown.tsx';
import { InstructionsOrigin } from './module-instructions.tsx';
import { ModuleLaunch } from './module-launch.tsx';
import { STATE_BY_VERSION_STATE, type IArtifactVersions } from './posting-detail.tsx';

import './artifact-versions.css';

type VersionDocuments = IArtifactVersions['versionList'][number];

// A Visualization shows in a frame that runs none of its scripts: the page comes from an AI session
function VersionFiles({
  reference,
  artifact,
  version,
  documentList,
}: Readonly<Omit<VersionDocuments, 'isChoosable'> & { reference: string; artifact: IArtifactVersions['artifact'] }>) {
  const { t } = useTranslation('posting');
  if (artifact === 'visualization' && version.state === 'ready') {
    return (
      <div className="artifact-versions__visualization">
        <iframe
          src={`/postings/${reference}/visualization/${String(version.number)}`}
          sandbox=""
          title={t('visualizationFrameTitle', { versionNumber: version.number })}
        />
      </div>
    );
  }
  if (documentList.length === 0) {
    return <p className="artifact-versions__missing">{t('noFile')}</p>;
  }
  return (
    <>
      {documentList.map((document) => (
        <ArtifactDocument key={document.fileName} reference={reference} artifact={artifact} {...document} />
      ))}
    </>
  );
}

// Every Version of an Artifact, oldest first: the Chosen Version opens, the others stay folded,
// and so do the Instructions each was produced with, to compare two Versions
export function ArtifactVersions({
  reference,
  artifact,
  state,
  failure,
  notificationFailure,
  module,
  isEditable,
  versionList,
}: Readonly<IArtifactVersions & { reference: string }>) {
  const { t } = useTranslation('posting');
  const headingId = useId();
  return (
    <section className="artifact-versions" id={artifact} data-artifact={artifact} aria-labelledby={headingId}>
      <h2 id={headingId}>{t(`artifactLabelByArtifact.${artifact}`, { ns: 'common' })}</h2>
      <ModuleLaunch
        reference={reference}
        artifact={artifact}
        state={state}
        failure={failure}
        notificationFailure={notificationFailure}
        module={module}
      />
      {isEditable && <CopyCommand command={`jf edit ${reference} ${artifact}`} />}
      {versionList.length === 0 ? (
        <p className="artifact-versions__missing">{t('noVersion')}</p>
      ) : (
        <ol className="artifact-versions__list">
          {versionList.map(({ version, isChoosable, documentList }) => (
            <li key={version.number}>
              <details className="artifact-versions__version" open={version.isChosen}>
                <summary>
                  <span className="artifact-versions__reference">
                    {t('versionNumber', { versionNumber: version.number })}
                  </span>
                  <StateBadge state={STATE_BY_VERSION_STATE[version.state]} />
                  {version.isChosen && <Badge data-chosen>{t('chosenBadge')}</Badge>}
                  <InstructionsOrigin hasCandidateInstructions={version.hasCandidateInstructions} />
                  <span className="artifact-versions__date">
                    <DateText date={version.createdAt} />
                  </span>
                </summary>
                {isChoosable && <ChooseButton reference={reference} artifact={artifact} number={version.number} />}
                <details className="artifact-versions__instructions">
                  <summary>{t('versionInstructions')}</summary>
                  <Markdown markdown={version.instructions} />
                </details>
                <VersionFiles reference={reference} artifact={artifact} version={version} documentList={documentList} />
              </details>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
