import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { StateBadge } from './badge.tsx';
import { CopyCommand } from './copy-command.tsx';
import { DateText } from './date.tsx';
import { ArtifactDocument, ChooseButton } from './edition.tsx';
import { Markdown } from './markdown.tsx';
import { InstructionsOrigin } from './module-instructions.tsx';
import { ModuleLaunch } from './module-launch.tsx';
import { STATE_BY_VERSION_STATE, type IArtifactVersions } from './posting-detail.tsx';

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
      <div className="visualization">
        <iframe
          src={`/postings/${reference}/visualization/${String(version.number)}`}
          sandbox=""
          title={t('visualizationFrameTitle', { versionNumber: version.number })}
        />
      </div>
    );
  }
  if (documentList.length === 0) {
    return <p className="missing">{t('noFile')}</p>;
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
  module,
  isEditable,
  versionList,
}: Readonly<IArtifactVersions & { reference: string }>) {
  const { t } = useTranslation('posting');
  const headingId = useId();
  return (
    <section className="artifact" id={artifact} data-artifact={artifact} aria-labelledby={headingId}>
      <h2 id={headingId}>{t(`artifactLabelByArtifact.${artifact}`, { ns: 'common' })}</h2>
      <ModuleLaunch reference={reference} artifact={artifact} state={state} module={module} />
      {isEditable && <CopyCommand command={`jf edit ${reference} ${artifact}`} />}
      {versionList.length === 0 ? (
        <p className="missing">{t('noVersion')}</p>
      ) : (
        <ol className="version-list">
          {versionList.map(({ version, isChoosable, documentList }) => (
            <li key={version.number}>
              <details open={version.isChosen}>
                <summary>
                  <span className="reference">{t('versionNumber', { versionNumber: version.number })}</span>
                  <StateBadge state={STATE_BY_VERSION_STATE[version.state]} />
                  {version.isChosen && (
                    <span className="badge" data-chosen>
                      {t('chosenBadge')}
                    </span>
                  )}
                  <InstructionsOrigin hasCandidateInstructions={version.hasCandidateInstructions} />
                  <span className="date">
                    <DateText date={version.createdAt} />
                  </span>
                </summary>
                {isChoosable && <ChooseButton reference={reference} artifact={artifact} number={version.number} />}
                <details className="version-instructions">
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
