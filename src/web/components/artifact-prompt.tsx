import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { interviewSectionIdOf } from '#/actions/interview-section.ts';

import type { IPrompt } from './posting-detail.tsx';

import './artifact-prompt.css';

type ReadVersion = IPrompt['readVersionList'][number];

// The section of the Posting page that shows the Artifact, its Chosen Version open: on this page, or
// on that of the other Posting
function sectionLinkOf(currentReference: string, { reference, artifact, interviewNumber }: ReadVersion): string {
  const sectionId = interviewNumber === null ? artifact : interviewSectionIdOf(interviewNumber, artifact);
  return reference === currentReference ? `#${sectionId}` : `/postings/${reference}#${sectionId}`;
}

// The Prompt a run started now would receive, folded like the Instructions of a Version, untranslated; its
// labels a level below the title of the Artifact, an h2 on the Posting, an h4 under an Interview
export function ArtifactPrompt({
  reference,
  prompt,
  isUnderInterview,
}: Readonly<{ reference: string; prompt: IPrompt; isUnderInterview: boolean }>) {
  const { t } = useTranslation('posting');
  const LABEL_TAG = isUnderInterview ? 'h5' : 'h3';
  return (
    <details className="artifact-prompt">
      <summary className="button">{t('prompt.toggle')}</summary>
      <div className="artifact-prompt__body">
        <LABEL_TAG>{t('prompt.fixedPart')}</LABEL_TAG>
        <pre className="artifact-prompt__text">{prompt.fixedPart}</pre>
        <LABEL_TAG>{t('prompt.instructions')}</LABEL_TAG>
        <pre className="artifact-prompt__text">{prompt.instructions}</pre>
        <LABEL_TAG>{t('prompt.readVersions')}</LABEL_TAG>
        {prompt.readVersionList.length === 0 ? (
          <p className="artifact-prompt__none">{t('prompt.noReadVersion')}</p>
        ) : (
          <ul className="artifact-prompt__read-list">
            {prompt.readVersionList.map((readVersion) => (
              <li key={`${readVersion.reference}-${readVersion.artifact}-${String(readVersion.interviewNumber)}`}>
                <Link to={sectionLinkOf(reference, readVersion)}>
                  {t(readVersion.interviewNumber === null ? 'prompt.readVersion' : 'prompt.readVersionOfInterview', {
                    reference: readVersion.reference,
                    interviewNumber: readVersion.interviewNumber,
                    artifactLabel: t(`artifactLabelByArtifact.${readVersion.artifact}`, { ns: 'common' }),
                    versionNumber: readVersion.number,
                  })}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
