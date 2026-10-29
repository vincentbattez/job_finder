import { useId, type ReactNode } from 'react';

import { ARTEFACT_LABEL_BY_ARTEFACT } from '#/actions/labels.ts';

import { EtatBadge, StatutBadge, type Etat } from './badge.tsx';
import { DateText } from './date.tsx';
import { Markdown } from './markdown.tsx';
import type { IOffreRow } from './offre-list.tsx';
import { Recipients, type IRecipients } from './recipients.tsx';
import { RepublicationFacts, type IRepublication } from './republication.tsx';

type Artefact = 'recherche' | 'lettre' | 'fiche_entretien' | 'visualisation';

type VersionState = 'running' | 'ready' | 'failed';

export const ETAT_BY_VERSION_STATE: Record<VersionState, Etat> = {
  running: 'en_cours',
  ready: 'pret',
  failed: 'en_echec',
};

export interface IArtefactVersions {
  artefact: Artefact;
  etat: Etat;
  // The module that produces the Artefact, and why it cannot run now
  module: { refusal: string | null };
  // Given by the action: jf edit opens its Version retenue
  isEditable: boolean;
  versionList: {
    version: {
      number: number;
      state: VersionState;
      isRetenue: boolean;
      hasCandidatConsignes: boolean;
      consignes: string;
      createdAt: Date;
    };
    isRetenable: boolean;
    documentList: { fileName: string; markdown: string; isModifiable: boolean }[];
  }[];
}

// The shape of the readOffre action, so the route passes its result as is
export interface IOffreFiche {
  offre: IOffreRow & {
    employer: string | null;
    applicationEmail: string | null;
    contact1: string | null;
    contact2: string | null;
    republicationOf: IRepublication['republicationOf'];
    republicationList: IRepublication['republicationList'];
  };
  ficheDePoste: string;
  artefactList: IArtefactVersions[];
  recipients: IRecipients | null;
}

const NON_PRECISE = <span className="missing">Non précisé</span>;

// A mail written in free text, as Avesnes publishes it, stays as published rather than a broken link
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;

// The fiche is a page of its own, or one sample among others on /design. The label and its
// Artefacts on one side; on the other, to whom to write and the Fiche de poste, folded since it is
// long as published. The children go at the foot of the label, below its statut.
export function OffreFiche({
  fiche,
  isPage = false,
  children,
}: Readonly<{ fiche: IOffreFiche; isPage?: boolean; children?: ReactNode }>) {
  const { offre, ficheDePoste, artefactList, recipients } = fiche;
  const TITLE_TAG = isPage ? 'h1' : 'h3';
  const PART_TAG = isPage ? 'h2' : 'h4';
  const artefactsId = useId();
  const contactsId = useId();
  const recipientsId = useId();
  const ficheDePosteId = useId();
  return (
    <article className="fiche">
      <div className="fiche__column">
        <header className="fiche__label">
          <div className="fiche__title">
            <TITLE_TAG>{offre.title}</TITLE_TAG>
            <StatutBadge statut={offre.statut} isExpiree={offre.isExpiree} />
          </div>
          <p>{[offre.workplace, offre.employer].filter(Boolean).join(', ')}</p>
          <dl className="fiche__facts">
            <div>
              <dt>Référence</dt>
              <dd className="reference">
                {offre.url === null ? offre.reference : <a href={offre.url}>{offre.reference}</a>}
              </dd>
            </div>
            <div>
              <dt>Publiée le</dt>
              <dd className="date">
                <DateText date={offre.publishedAt} />
              </dd>
            </div>
            <div>
              <dt>Date limite</dt>
              <dd className="date">
                <DateText date={offre.dateLimite} />
              </dd>
            </div>
            <RepublicationFacts offre={offre} />
          </dl>
          {children}
        </header>
        <section className="fiche__part" aria-labelledby={artefactsId}>
          <PART_TAG id={artefactsId}>Artefacts</PART_TAG>
          <ul className="artefact-list">
            {artefactList.map(({ artefact, etat }) => (
              <li key={artefact} data-artefact={artefact}>
                <a href={`#${artefact}`}>{ARTEFACT_LABEL_BY_ARTEFACT[artefact]}</a>
                <EtatBadge etat={etat} />
              </li>
            ))}
          </ul>
        </section>
      </div>
      <div className="fiche__column">
        <section className="fiche__part" aria-labelledby={contactsId}>
          <PART_TAG id={contactsId}>Contacts</PART_TAG>
          <dl className="fiche__contacts">
            <div>
              <dt>Mail de candidature</dt>
              <dd>
                {offre.applicationEmail !== null && EMAIL_PATTERN.test(offre.applicationEmail) ? (
                  <a href={`mailto:${offre.applicationEmail}`}>{offre.applicationEmail}</a>
                ) : (
                  (offre.applicationEmail ?? NON_PRECISE)
                )}
              </dd>
            </div>
            <div>
              <dt>Contact 1</dt>
              <dd>{offre.contact1 ?? NON_PRECISE}</dd>
            </div>
            <div>
              <dt>Contact 2</dt>
              <dd>{offre.contact2 ?? NON_PRECISE}</dd>
            </div>
          </dl>
        </section>
        <section className="fiche__part" aria-labelledby={recipientsId}>
          <PART_TAG id={recipientsId}>Destinataires recommandés</PART_TAG>
          {recipients === null ? (
            <p className="missing">La Lettre les recommande, une fois produite.</p>
          ) : (
            <Recipients recipients={recipients} />
          )}
        </section>
        <section className="fiche__part" aria-labelledby={ficheDePosteId}>
          <PART_TAG id={ficheDePosteId}>Fiche de poste</PART_TAG>
          <details className="fiche__poste">
            <summary>Lire la Fiche de poste</summary>
            <Markdown markdown={ficheDePoste} />
          </details>
        </section>
      </div>
    </article>
  );
}
