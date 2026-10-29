import { ETAT_LIST, EtatBadge, StatutBadge, type Statut } from '#/web/components/badge.tsx';
import { MarkdownEditor } from '#/web/components/markdown-editor.tsx';
import { OffreFiche, type IOffreFiche } from '#/web/components/offre-fiche.tsx';
import { OffreList, type IOffreRow } from '#/web/components/offre-list.tsx';

// Sample values that read as samples: the real Offres reach the front through the actions (ADR-0003)
const SAMPLE_OFFRE = {
  reference: '2026-0000101',
  title: 'Attaché de justice (F/H), pôle civil',
  url: 'https://example.org/offres/2026-0000101',
  workplace: 'Tribunal judiciaire de Béthune',
  employer: 'Cour d’appel de Douai',
  status: 'a_traiter',
  isExpiree: false,
  publishedAt: new Date('2026-10-20'),
  dateLimite: new Date('2026-11-19'),
  applicationEmail: 'recrutement@example.org',
  contact1: 'Greffe du pôle civil, 03 00 00 00 00',
  contact2: null,
  republicationOf: { reference: '2026-0000042' },
  republicationList: [],
} satisfies IOffreFiche['offre'];

const SAMPLE_FICHE_DE_POSTE = [
  '## Missions',
  '',
  'L’attaché de justice assiste les magistrats du pôle civil : recherches juridiques, notes de synthèse et projets de décision.',
  '',
  '## Profil recherché',
  '',
  '- Master 2 en droit privé',
  '- Goût du travail en équipe',
].join('\n');

function sampleVersion(number: number, state: 'running' | 'ready' | 'failed') {
  return {
    version: {
      number,
      state,
      isRetenue: number === 1,
      hasCandidatConsignes: number === 2,
      createdAt: new Date('2026-10-21'),
    },
    isRetenable: false,
    documentList: [],
  };
}

// One Artefact in each état: the état of an Artefact is the state of its latest Version
const SAMPLE_FICHE: IOffreFiche = {
  offre: SAMPLE_OFFRE,
  ficheDePoste: SAMPLE_FICHE_DE_POSTE,
  artefactList: [
    { artefact: 'recherche', versionList: [sampleVersion(1, 'ready')] },
    { artefact: 'lettre', versionList: [sampleVersion(1, 'ready'), sampleVersion(2, 'running')] },
    { artefact: 'fiche_entretien', versionList: [sampleVersion(1, 'failed')] },
    { artefact: 'visualisation', versionList: [] },
  ],
  recipients: {
    to: { email: 'recrutement@example.org', source: 'applicationEmail' },
    ccList: [],
    salutation: { text: 'Madame, Monsieur,', source: null },
    justification: 'Le mail de candidature est la seule adresse publiée ; aucun contact ne donne de nom.',
  },
};

const SAMPLE_LETTRE = [
  'Madame, Monsieur,',
  '',
  'Titulaire d’un [à compléter : diplôme], je souhaite rejoindre le pôle civil du tribunal judiciaire de Béthune comme attachée de justice.',
  '',
  '## Ce que j’apporte',
  '',
  '- [à compléter : une expérience en juridiction]',
  '- Des notes de synthèse claires et sourcées',
].join('\n');

const SAMPLE_OFFRE_LIST: IOffreRow[] = [
  SAMPLE_OFFRE,
  {
    reference: '2026-0000102',
    title: 'Attaché de justice (F/H), parquet',
    url: 'https://example.org/offres/2026-0000102',
    workplace: 'Tribunal judiciaire de Boulogne-sur-Mer',
    status: 'postulee',
    isExpiree: true,
    publishedAt: new Date('2026-09-25'),
    dateLimite: new Date('2026-10-23'),
  },
  {
    reference: '2026-0000103',
    title: 'Attaché de justice (F/H), pôle mineurs',
    url: 'https://example.org/offres/2026-0000103',
    workplace: 'Tribunal judiciaire d’Avesnes-sur-Helpe',
    status: 'a_traiter',
    isExpiree: true,
    publishedAt: new Date('2026-09-14'),
    dateLimite: new Date('2026-10-15'),
  },
  {
    reference: '2026-0000104',
    title: 'Attaché de justice (F/H), service de l’application des peines',
    url: 'https://example.org/offres/2026-0000104',
    workplace: 'Tribunal judiciaire d’Amiens',
    status: 'archivee',
    isExpiree: false,
    publishedAt: new Date('2026-09-30'),
    dateLimite: null,
  },
];

// Each look of the badge: Expirée shows in place of À traiter
const STATUT_SAMPLE_LIST: { statut: Statut; isExpiree: boolean }[] = [
  { statut: 'a_traiter', isExpiree: false },
  { statut: 'postulee', isExpiree: false },
  { statut: 'a_traiter', isExpiree: true },
  { statut: 'archivee', isExpiree: false },
];

export function meta() {
  return [
    { title: 'Système de design de Job Finder' },
    { name: 'description', content: 'Les composants du front de Job Finder, montrés avec des Offres d’exemple.' },
  ];
}

export default function Design() {
  return (
    <main className="container page">
      <div className="page__head">
        <h1>Système de design</h1>
        <p>Les composants du front, montrés avec des Offres d’exemple.</p>
      </div>
      <section aria-labelledby="statuts">
        <h2 id="statuts">Statuts d’une Offre</h2>
        <ul className="badge-list">
          {STATUT_SAMPLE_LIST.map(({ statut, isExpiree }) => (
            <li key={`${statut}-${String(isExpiree)}`}>
              <StatutBadge statut={statut} isExpiree={isExpiree} />
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="etats">
        <h2 id="etats">États d’un Artefact</h2>
        <ul className="badge-list">
          {ETAT_LIST.map((etat) => (
            <li key={etat}>
              <EtatBadge etat={etat} />
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="offres">
        <h2 id="offres">Liste d’Offres</h2>
        <OffreList offreList={SAMPLE_OFFRE_LIST} />
      </section>
      <section aria-labelledby="liste-vide">
        <h2 id="liste-vide">Liste vide</h2>
        <OffreList offreList={[]} />
      </section>
      <section aria-labelledby="fiche">
        <h2 id="fiche">Fiche d’une Offre</h2>
        <OffreFiche fiche={SAMPLE_FICHE} />
      </section>
      <section aria-labelledby="editeur">
        <h2 id="editeur">Éditeur Markdown</h2>
        <MarkdownEditor label="Lettre" defaultValue={SAMPLE_LETTRE} />
      </section>
    </main>
  );
}
