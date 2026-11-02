import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import type { IPrompt } from './artifact.ts';

import './artifact-prompt.css';

type ReadVersion = IPrompt['readVersionList'][number];

// The tab of the Posting page that shows the Artifact, deep-linked (spec #125, « Navigation and URL
// state »): on this Posting or on another one
function sectionLinkOf({ reference, artifact, interviewNumber }: ReadVersion): string {
  return interviewNumber === null
    ? `/postings/${reference}?tab=${artifact}`
    : `/postings/${reference}?tab=interviews&interview=${String(interviewNumber)}&doc=${artifact}`;
}

// The Prompt a run started now would receive, folded like the Instructions of a Version, untranslated; its
// labels a level below the title of the Artifact, an h2 on the Posting, an h4 under an Interview
export function ArtifactPrompt({ prompt, isUnderInterview }: Readonly<{ prompt: IPrompt; isUnderInterview: boolean }>) {
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
                <Link to={sectionLinkOf(readVersion)}>
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
