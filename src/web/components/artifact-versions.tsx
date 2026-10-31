import { Fragment, useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge, StateBadge } from './badge.tsx';
import { CopyCommand } from './copy-command.tsx';
import { DateText } from './date.tsx';
import { Markdown } from './markdown.tsx';
import { InstructionsOrigin } from './module-instructions.tsx';
import { STATE_BY_VERSION_STATE, type IArtifactVersions } from './posting-detail.tsx';

import './artifact-versions.css';

type VersionDocuments = IArtifactVersions['versionList'][number];
type VersionDocument = VersionDocuments['documentList'][number];

// What its Container hands in: the launch of the module, and for a Version its choice and its files
interface IArtifactVersionsSlots {
  launch: ReactNode;
  renderChooseButton: (number: number) => ReactNode;
  renderDocument: (document: VersionDocument) => ReactNode;
}

// A Visualization shows in a frame that runs none of its scripts: the page comes from an AI session
function VersionFiles({
  reference,
  artifact,
  version,
  documentList,
  renderDocument,
}: Readonly<
  Omit<VersionDocuments, 'isChoosable'> &
    Pick<IArtifactVersionsSlots, 'renderDocument'> & { reference: string; artifact: IArtifactVersions['artifact'] }
>) {
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
        <Fragment key={document.fileName}>{renderDocument(document)}</Fragment>
      ))}
    </>
  );
}

// Every Version of an Artifact, oldest first: the Chosen Version opens, the others stay folded,
// and so do the Instructions each was produced with, to compare two Versions
export function ArtifactVersions({
  reference,
  artifact,
  isEditable,
  versionList,
  launch,
  renderChooseButton,
  renderDocument,
}: Readonly<
  Pick<IArtifactVersions, 'artifact' | 'isEditable' | 'versionList'> & IArtifactVersionsSlots & { reference: string }
>) {
  const { t } = useTranslation('posting');
  const headingId = useId();
  return (
    <section className="artifact-versions" id={artifact} data-artifact={artifact} aria-labelledby={headingId}>
      <h2 id={headingId}>{t(`artifactLabelByArtifact.${artifact}`, { ns: 'common' })}</h2>
      {launch}
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
                {isChoosable && renderChooseButton(version.number)}
                <details className="artifact-versions__instructions">
                  <summary>{t('versionInstructions')}</summary>
                  <Markdown markdown={version.instructions} />
                </details>
                <VersionFiles
                  reference={reference}
                  artifact={artifact}
                  version={version}
                  documentList={documentList}
                  renderDocument={renderDocument}
                />
              </details>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
