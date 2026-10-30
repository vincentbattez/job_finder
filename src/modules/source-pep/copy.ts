import type { Locale } from '#/domain/index.ts';

// What the failures of the PEP site tell the Candidate, in each locale. It stays in the module's folder,
// the only place allowed to name the PEP (ADR-0010).
const COPY_EN = {
  unreachable: (url: string, reason: string) =>
    `The PEP site is unreachable (${url}): ${reason}. Check the connection, then run again.`,
  unexpectedStatus: (url: string, status: number) =>
    `The PEP site answered HTTP ${String(status)} for ${url}. Run again later.`,
  noReference: (feedTitle: string) =>
    `A Posting of the PEP feed has no YYYY-NNNNNNN reference: “${feedTitle}”. The format of the feed changed.`,
  notFiltered: (channelTitle: string, filter: string) =>
    `The PEP feed is not filtered: its title “${channelTitle}” does not contain “${filter}”. The site ignored the filter Rss_Entity=1123: check the identifier of the DSJ (ADR-0001).`,
  emptyFeed: (url: string) =>
    `The PEP feed is empty (${url}), while the DSJ always publishes Postings. Open it to check.`,
  unreadablePage: (reference: string, url: string) =>
    `The detail page of Posting ${reference} is unreadable (${url}): the format of the page changed.`,
};

const COPY_FR: typeof COPY_EN = {
  unreachable: (url, reason) =>
    `Le site PEP est injoignable (${url}) : ${reason}. Vérifier la connexion, puis relancer.`,
  unexpectedStatus: (url, status) => `Le site PEP a répondu HTTP ${String(status)} pour ${url}. Relancer plus tard.`,
  noReference: (feedTitle) =>
    `Offre du flux PEP sans référence AAAA-NNNNNNN : « ${feedTitle} ». Le format du flux a changé.`,
  notFiltered: (channelTitle, filter) =>
    `Le flux PEP n'est pas filtré : son titre « ${channelTitle} » ne reprend pas « ${filter} ». ` +
    `Le site a ignoré le filtre Rss_Entity=1123 : vérifier l'identifiant de la DSJ (ADR-0001).`,
  emptyFeed: (url) =>
    `Le flux PEP est vide (${url}), alors que la DSJ publie toujours des offres. L'ouvrir pour vérifier.`,
  unreadablePage: (reference, url) =>
    `La fiche détaillée de l'Offre ${reference} est illisible (${url}) : le format de la page a changé.`,
};

export const COPY_BY_LOCALE: Record<Locale, typeof COPY_EN> = { en: COPY_EN, fr: COPY_FR };
