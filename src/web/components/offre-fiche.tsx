import { useId } from 'react';

import { EtatBadge, StatutBadge, type Etat } from './badge.tsx';
import { DateText } from './date.tsx';
import { Markdown } from './markdown.tsx';
import type { IOffreRow } from './offre-list.tsx';

const ARTEFACT_LIST = ['recherche', 'lettre', 'fiche_entretien', 'visualisation'] as const;

type Artefact = (typeof ARTEFACT_LIST)[number];

const ARTEFACT_LABEL_BY_ARTEFACT: Record<Artefact, string> = {
  recherche: 'Recherche',
  lettre: 'Lettre',
  fiche_entretien: 'Fiche d’entretien',
  visualisation: 'Visualisation',
};

export interface IOffreFiche extends IOffreRow {
  employer: string;
  applicationEmail: string | null;
  contact1: string | null;
  contact2: string | null;
  fichePoste: string;
  etatByArtefact: Record<Artefact, Etat>;
}

function Contact({ contact }: Readonly<{ contact: string | null }>) {
  return contact === null ? <span className="missing">Non précisé</span> : contact;
}

export function OffreFiche({ offre }: Readonly<{ offre: IOffreFiche }>) {
  const artefactsId = useId();
  return (
    <article className="fiche">
      <header className="fiche__label">
        <div className="fiche__title">
          <h3>{offre.title}</h3>
          <StatutBadge statut={offre.statut} />
        </div>
        <p>
          {offre.workplace}, {offre.employer}
        </p>
        <dl className="fiche__facts">
          <div>
            <dt>Référence</dt>
            <dd className="reference">
              <a href={offre.url}>{offre.reference}</a>
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
        </dl>
      </header>
      <div className="fiche__part">
        <h4 id={artefactsId}>Artefacts</h4>
        <ul className="artefact-list" aria-labelledby={artefactsId}>
          {ARTEFACT_LIST.map((artefact) => (
            <li key={artefact} data-artefact={artefact}>
              <span>{ARTEFACT_LABEL_BY_ARTEFACT[artefact]}</span>
              <EtatBadge etat={offre.etatByArtefact[artefact]} />
            </li>
          ))}
        </ul>
      </div>
      <div className="fiche__part">
        <h4>Contacts</h4>
        <dl className="fiche__contacts">
          <div>
            <dt>Mail de candidature</dt>
            <dd>
              {offre.applicationEmail === null ? (
                <Contact contact={null} />
              ) : (
                <a href={`mailto:${offre.applicationEmail}`}>{offre.applicationEmail}</a>
              )}
            </dd>
          </div>
          <div>
            <dt>Contact 1</dt>
            <dd>
              <Contact contact={offre.contact1} />
            </dd>
          </div>
          <div>
            <dt>Contact 2</dt>
            <dd>
              <Contact contact={offre.contact2} />
            </dd>
          </div>
        </dl>
      </div>
      <div className="fiche__part">
        <h4>Fiche de poste</h4>
        <Markdown markdown={offre.fichePoste} />
      </div>
    </article>
  );
}
