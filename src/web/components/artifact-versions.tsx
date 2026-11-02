import { Fragment, useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { interviewSectionIdOf } from '#/actions/interview-section.ts';
import { ORIGINAL_FILE_NAME } from '#/actions/original.ts';

import { STATE_BY_VERSION_STATE, type IArtifactVersions } from './artifact.ts';
import { Badge, StateBadge } from './badge.tsx';
import { CopyCommand } from './copy-command.tsx';
import { DateText } from './date.tsx';
import { Markdown } from './markdown.tsx';
import { InstructionsOrigin } from './module-instructions.tsx';

import './artifact-versions.css';

type VersionDetail = IArtifactVersions['versionList'][number];
type VersionDocument = { fileName: string; markdown: string; isModifiable: boolean };

// What its Container hands in: the launch of the module, and for a Version its validation and its files
interface IArtifactVersionsSlots {
  launch: ReactNode;
  renderValidateButton: (number: number) => ReactNode;
  renderDocument: (number: number, document: VersionDocument) => ReactNode;
}

// Its text, corrected in place, then its Original, read-only (ADR-0019)
function VersionFiles({
  fileName,
  detail: { version, text, original, isCorrectable },
  renderDocument,
}: Readonly<{ fileName: string; detail: VersionDetail } & Pick<IArtifactVersionsSlots, 'renderDocument'>>) {
  const { t } = useTranslation('posting');
  const documentList = [
    ...(text === null ? [] : [{ fileName, markdown: text, isModifiable: isCorrectable }]),
    ...(original === null ? [] : [{ fileName: ORIGINAL_FILE_NAME, markdown: original, isModifiable: false }]),
  ];
  if (documentList.length === 0) {
    return <p className="artifact-versions__missing">{t('noFile')}</p>;
  }
  return (
    <>
      {documentList.map((document) => (
        <Fragment key={document.fileName}>{renderDocument(version.number, document)}</Fragment>
      ))}
    </>
  );
}

// Every Version of an Artifact, oldest first, each folded until asked;
// an Artifact of an Interview has its section under that Interview, a heading a level below
export function ArtifactVersions({
  reference,
  interviewNumber = null,
  artifact,
  isEditable,
  fileName,
  versionList,
  launch,
  renderValidateButton,
  renderDocument,
}: Readonly<
  Pick<IArtifactVersions, 'artifact' | 'isEditable' | 'fileName' | 'versionList'> &
    IArtifactVersionsSlots & { reference: string; interviewNumber?: number | null }
>) {
  const { t } = useTranslation('posting');
  const headingId = useId();
  const HEADING_TAG = interviewNumber === null ? 'h2' : 'h4';
  const editArgumentList = [reference, artifact, ...(interviewNumber === null ? [] : [String(interviewNumber)])];
  return (
    <section
      className="artifact-versions"
      id={interviewNumber === null ? artifact : interviewSectionIdOf(interviewNumber, artifact)}
      data-artifact={artifact}
      aria-labelledby={headingId}
    >
      <div className="artifact-versions__head">
        <HEADING_TAG id={headingId} className="artifact-versions__title">
          {t(`artifactLabelByArtifact.${artifact}`, { ns: 'common' })}
        </HEADING_TAG>
      </div>
      {launch}
      {isEditable && <CopyCommand command={`jf edit ${editArgumentList.join(' ')}`} />}
      {versionList.length === 0 ? (
        <p className="artifact-versions__missing">{t('noVersion')}</p>
      ) : (
        <ol className="artifact-versions__list">
          {versionList.map((detail) => {
            const { version, isValidatable } = detail;
            return (
              <li key={version.number}>
                <details className="artifact-versions__version">
                  <summary>
                    <span className="artifact-versions__reference">
                      {t('versionNumber', { versionNumber: version.number })}
                    </span>
                    <StateBadge state={STATE_BY_VERSION_STATE[version.state]} />
                    {version.isChosen ? (
                      <Badge data-chosen>{t('artifactView.chosenBadge')}</Badge>
                    ) : (
                      version.state === 'ready' && (
                        <Badge data-validation={version.validation}>
                          {t(`validationLabelByValidation.${version.validation}`)}
                        </Badge>
                      )
                    )}
                    <InstructionsOrigin hasCandidateInstructions={version.hasCandidateInstructions} />
                    <span className="artifact-versions__date">
                      <DateText date={version.createdAt} />
                    </span>
                  </summary>
                  {isValidatable && renderValidateButton(version.number)}
                  <details className="artifact-versions__instructions">
                    <summary>{t('versionInstructions')}</summary>
                    <Markdown markdown={version.instructions} />
                  </details>
                  <VersionFiles fileName={fileName} detail={detail} renderDocument={renderDocument} />
                </details>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
