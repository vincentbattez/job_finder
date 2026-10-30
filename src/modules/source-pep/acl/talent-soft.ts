import { FICHE_DE_POSTE_SCHEMA, LISTED_OFFRE_SCHEMA, type FicheDePoste, type ListedOffre } from '#/domain/index.ts';

// Place de l'Emploi Public publishes through Talent-Soft, whose pages are plain server HTML
const ORIGIN = 'https://place-ep-recrute.talent-soft.com';

// The DSJ feed holds every attaché de justice offer; without top, it stops at the 20 latest (ADR-0001)
const FEED_URL = `${ORIGIN}/handlers/offerRss.ashx?LCID=1036&Rss_Entity=1123&top=1000`;

// The site silently ignores an unknown filter and then returns every offer: the channel title is
// the only proof that the filter applied (ADR-0001)
const FEED_FILTER = 'Direction des Services Judiciaires';

const CHARACTER_BY_ENTITY: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', nbsp: ' ' };

function decodeEntities(text: string): string {
  return text.replaceAll(/&(#x?)?(\w+);/g, (entity, numeric: string | undefined, code: string) => {
    if (numeric === undefined) {
      return CHARACTER_BY_ENTITY[code] ?? entity;
    }
    return String.fromCodePoint(Number.parseInt(code, numeric === '#x' ? 16 : 10));
  });
}

function toText(html: string): string {
  return decodeEntities(html.replaceAll(/<br\s*\/?>/g, '\n').replaceAll(/<[^<>]*>/g, '')).trim();
}

// Keeps the headings, paragraphs and lists of the detail page, so the Fiche de poste reads as published
function toMarkdown(html: string): string {
  const markdown = html
    .replaceAll(
      /<h([23])[^>]*>([\s\S]*?)<\/h\1>/g,
      (heading, level: string, title: string) =>
        `\n\n${'#'.repeat(Number(level))} ${toText(title).replaceAll(/\s+/g, ' ')}\n\n`,
    )
    .replaceAll(/<li[^>]*>/g, '\n- ')
    .replaceAll(/<br\s*\/?>|<\/(?:p|div|ul)>/g, '\n\n')
    .replaceAll(/<[^<>]*>/g, '');
  return `${decodeEntities(markdown)
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replaceAll(/\n{3,}/g, '\n\n')
    .trim()}\n`;
}

async function get(httpFetch: typeof fetch, url: string): Promise<string> {
  let response: Response;
  try {
    // A removed offer redirects to the home page: the redirect is an error, not a Fiche de poste
    response = await httpFetch(url, { redirect: 'manual' });
  } catch (error) {
    throw new Error(`Le site PEP est injoignable (${url}) : ${String(error)}. Vérifier la connexion, puis relancer.`, {
      cause: error,
    });
  }
  if (response.status !== 200) {
    throw new Error(`Le site PEP a répondu HTTP ${String(response.status)} pour ${url}. Relancer plus tard.`);
  }
  // text() decodes leniently: invalid UTF-8 becomes U+FFFD instead of failing the Detection
  return response.text();
}

function readTag(xml: string, tag: string): string {
  return decodeEntities(new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(xml)?.[1] ?? '').trim();
}

function readItem(item: string): ListedOffre {
  const feedTitle = readTag(item, 'title');
  const [, reference, title] = /^(\d{4}-\d{7}) - (.+)$/.exec(feedTitle) ?? [];
  if (reference === undefined || title === undefined) {
    throw new Error(`Offre du flux PEP sans référence AAAA-NNNNNNN : « ${feedTitle} ». Le format du flux a changé.`);
  }
  return LISTED_OFFRE_SCHEMA.parse({
    reference,
    title: title.trim(),
    url: readTag(item, 'link'),
    publishedAt: new Date(readTag(item, 'pubDate')),
  });
}

export async function readFeed(httpFetch: typeof fetch = fetch): Promise<ListedOffre[]> {
  const xml = await get(httpFetch, FEED_URL);
  const channelTitle = readTag(xml, 'title');
  if (!channelTitle.includes(FEED_FILTER)) {
    throw new Error(
      `Le flux PEP n'est pas filtré : son titre « ${channelTitle} » ne reprend pas « ${FEED_FILTER} ». ` +
        `Le site a ignoré le filtre Rss_Entity=1123 : vérifier l'identifiant de la DSJ (ADR-0001).`,
    );
  }
  const listedOffreList = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/g), ([, item = '']) => readItem(item));
  if (listedOffreList.length === 0) {
    throw new Error(
      `Le flux PEP est vide (${FEED_URL}), alors que la DSJ publie toujours des offres. L'ouvrir pour vérifier.`,
    );
  }
  return listedOffreList;
}

function readField(html: string, id: string): string | null {
  const value = new RegExp(String.raw`id="${id}"[^>]*>([\s\S]*?)</p>`).exec(html)?.[1] ?? '';
  return toText(value) === '' ? null : toText(value);
}

// The fields are read by their element ids, stable across offers (ADR-0001). The employing court of
// appeal tells the Zone, a Parameter of this Source only: it stays out of the Fiche de poste.
export async function readFicheDePoste(
  reference: string,
  httpFetch: typeof fetch = fetch,
): Promise<{ ficheDePoste: FicheDePoste; courtOfAppeal: string | null }> {
  const url = `${ORIGIN}/offre-de-emploi/emploi_${reference.slice('AAAA-'.length)}.aspx`;
  const html = await get(httpFetch, url);
  const content = /id="contenu-ficheoffre"[^>]*>([\s\S]*?)<div class="ts-offer-page__cta is-bottom/.exec(html)?.[1];
  if (content === undefined) {
    throw new Error(
      `La fiche détaillée de l'Offre ${reference} est illisible (${url}) : le format de la page a changé.`,
    );
  }
  const dateLimite = readField(content, 'fldoffer_date1');
  // The employing court of appeal is the offer's entity, such as « Direction des services judiciaires - CA DOUAI »
  const entity = toText(/_divEntityDesc"[^>]*>[\s\S]*?<\/h3>([\s\S]*?)<\/div>/.exec(content)?.[1] ?? '');
  const ficheDePoste = FICHE_DE_POSTE_SCHEMA.parse({
    dateLimite: dateLimite === null ? null : new Date(dateLimite.split('/').toReversed().join('-')),
    employer: readField(content, 'fldoffer_longtext2'),
    workplace: readField(content, 'fldlocation_shorttext1'),
    applicationEmail: readField(content, 'fldorigin_shorttext1'),
    contact1: readField(content, 'fldorigin_shorttext2'),
    contact2: readField(content, 'fldorigin_shorttext3'),
    markdown: toMarkdown(content),
  });
  return { ficheDePoste, courtOfAppeal: / - CA (.+)$/.exec(entity)?.[1] ?? null };
}
