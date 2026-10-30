import { addResources } from '#/domain/catalogue/i18n.ts';

// What the PEP Source tells the Candidate, in each locale: its failures and the texts of its
// Parameters. It stays in the module's folder, the only place allowed to name the PEP (ADR-0010), as
// an i18next namespace of its own (ADR-0012).
const COPY_EN = {
  unreachable: 'The PEP site is unreachable ({{url}}): {{reason}}. Check the connection, then run again.',
  unexpectedStatus: 'The PEP site answered HTTP {{status}} for {{url}}. Run again later.',
  noReference:
    'A Posting of the PEP feed has no YYYY-NNNNNNN reference: “{{feedTitle}}”. The format of the feed changed.',
  notFiltered:
    'The PEP feed is not filtered: its title “{{channelTitle}}” does not contain “{{filter}}”. The site ignored the filter Rss_Entity=1123: check the identifier of the DSJ (ADR-0001).',
  emptyFeed: 'The PEP feed is empty ({{url}}), while the DSJ always publishes Postings. Open it to check.',
  unreadablePage: 'The detail page of Posting {{reference}} is unreadable ({{url}}): the format of the page changed.',
  titleLabel: 'Searched title',
  titlePlaceholder: 'attaché de justice',
  courtOfAppealListLabel: 'Courts of appeal of the Zone',
  courtOfAppealListPlaceholder: 'Douai',
};

const COPY_FR: typeof COPY_EN = {
  unreachable: 'Le site PEP est injoignable ({{url}}) : {{reason}}. Vérifier la connexion, puis relancer.',
  unexpectedStatus: 'Le site PEP a répondu HTTP {{status}} pour {{url}}. Relancer plus tard.',
  noReference: 'Offre du flux PEP sans référence AAAA-NNNNNNN : « {{feedTitle}} ». Le format du flux a changé.',
  notFiltered:
    "Le flux PEP n'est pas filtré : son titre « {{channelTitle}} » ne reprend pas « {{filter}} ». " +
    "Le site a ignoré le filtre Rss_Entity=1123 : vérifier l'identifiant de la DSJ (ADR-0001).",
  emptyFeed: "Le flux PEP est vide ({{url}}), alors que la DSJ publie toujours des offres. L'ouvrir pour vérifier.",
  unreadablePage:
    "La fiche détaillée de l'Offre {{reference}} est illisible ({{url}}) : le format de la page a changé.",
  titleLabel: 'Titre recherché',
  titlePlaceholder: 'attaché de justice',
  courtOfAppealListLabel: 'Cours d’appel de la Zone',
  courtOfAppealListPlaceholder: 'Douai',
};

export const COPY_NAMESPACE = 'sourcePep';

// The t function of the namespace checks its keys against the en copy
declare module 'i18next' {
  interface ResourceNamespaceMap {
    sourcePep: typeof COPY_EN;
  }
}

addResources(COPY_NAMESPACE, { en: COPY_EN, fr: COPY_FR });
