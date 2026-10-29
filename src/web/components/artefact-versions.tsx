import { useId } from 'react';

import { EtatBadge } from './badge.tsx';
import { CopyCommand } from './copy-command.tsx';
import { DateText } from './date.tsx';
import { ArtefactDocument, RetenirButton } from './edition.tsx';
import { ConsignesOrigin } from './module-consignes.tsx';
import { ModuleLaunch } from './module-launch.tsx';
import { ARTEFACT_LABEL_BY_ARTEFACT, ETAT_BY_VERSION_STATE, type IArtefactVersions } from './offre-fiche.tsx';

// Every Version of an Artefact, oldest first: the Version retenue opens, the others stay folded
export function ArtefactVersions({
  reference,
  artefact,
  etat,
  module,
  versionList,
}: Readonly<IArtefactVersions & { reference: string }>) {
  const headingId = useId();
  return (
    <section className="artefact" id={artefact} data-artefact={artefact} aria-labelledby={headingId}>
      <h2 id={headingId}>{ARTEFACT_LABEL_BY_ARTEFACT[artefact]}</h2>
      <ModuleLaunch reference={reference} artefact={artefact} etat={etat} module={module} />
      {/* jf edit works on the Version retenue */}
      {versionList.some(({ version }) => version.isRetenue) && (
        <CopyCommand command={`jf edit ${reference} ${artefact}`} />
      )}
      {versionList.length === 0 ? (
        <p className="missing">Aucune Version pour l’instant.</p>
      ) : (
        <ol className="version-list">
          {versionList.map(({ version, isRetenable, documentList }) => (
            <li key={version.number}>
              <details open={version.isRetenue}>
                <summary>
                  <span className="reference">v{version.number}</span>
                  <EtatBadge etat={ETAT_BY_VERSION_STATE[version.state]} />
                  {version.isRetenue && (
                    <span className="badge" data-retenue>
                      Retenue
                    </span>
                  )}
                  <ConsignesOrigin hasCandidatConsignes={version.hasCandidatConsignes} />
                  <span className="date">
                    <DateText date={version.createdAt} />
                  </span>
                </summary>
                {isRetenable && <RetenirButton reference={reference} artefact={artefact} number={version.number} />}
                {documentList.length === 0 ? (
                  <p className="missing">Aucun fichier dans cette Version.</p>
                ) : (
                  documentList.map((document) => (
                    <ArtefactDocument key={document.fileName} reference={reference} artefact={artefact} {...document} />
                  ))
                )}
              </details>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
