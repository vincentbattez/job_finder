import { tFor } from '#/domain/catalogue/i18n.ts';
import { codedError } from '#/domain/coded-error.ts';
import {
  JOB_DESCRIPTION_SCHEMA,
  LISTED_POSTING_SCHEMA,
  type JobDescription,
  type ListedPosting,
  type Locale,
} from '#/domain/index.ts';
import { COPY_NAMESPACE } from '#/modules/source-pep/copy.ts';
import { messageOf } from '#/text/index.ts';

// The PEP publishes through Talent-Soft, whose pages are plain server HTML. Its URLs, feed and field
// ids are in French, as the site names them.
// cspell:disable
const ORIGIN = 'https://place-ep-recrute.talent-soft.com';

// The DSJ feed holds every attaché de justice offer; without top, it stops at the 20 latest (ADR-0001)
const FEED_URL = `${ORIGIN}/handlers/offerRss.ashx?LCID=1036&Rss_Entity=1123&top=1000`;

// The site silently ignores an unknown filter and then returns every offer: the channel title is
// the only proof that the filter applied (ADR-0001)
const FEED_FILTER = 'Direction des Services Judiciaires';
// cspell:enable

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

// Keeps the headings, paragraphs and lists of the detail page, so the Job Description reads as published
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

// A site that never answers would hold the Detection: past this, it is unreachable
const REQUEST_TIMEOUT_MS = 30_000;

async function get(httpFetch: typeof fetch, url: string, locale: Locale): Promise<string> {
  let response: Response;
  try {
    // A removed offer redirects to the home page: the redirect is an error, not a Job Description
    response = await httpFetch(url, { redirect: 'manual', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (error) {
    throw codedError(
      'source_unreachable',
      { detail: tFor(locale, COPY_NAMESPACE)('unreachable', { url, reason: messageOf(error) }) },
      { locale, cause: error },
    );
  }
  if (response.status !== 200) {
    throw codedError(
      'source_status',
      { detail: tFor(locale, COPY_NAMESPACE)('unexpectedStatus', { url, status: response.status }) },
      { locale },
    );
  }
  // text() decodes leniently: invalid UTF-8 becomes U+FFFD instead of failing the Detection
  return response.text();
}

function readTag(xml: string, tag: string): string {
  return decodeEntities(new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(xml)?.[1] ?? '').trim();
}

function readItem(item: string, locale: Locale): ListedPosting {
  const feedTitle = readTag(item, 'title');
  const [, reference, title] = /^(\d{4}-\d{7}) - (.+)$/.exec(feedTitle) ?? [];
  if (reference === undefined || title === undefined) {
    throw codedError(
      'source_format_changed',
      { detail: tFor(locale, COPY_NAMESPACE)('noReference', { feedTitle }) },
      { locale },
    );
  }
  return LISTED_POSTING_SCHEMA.parse({
    reference,
    title: title.trim(),
    url: readTag(item, 'link'),
    publishedAt: new Date(readTag(item, 'pubDate')),
  });
}

export async function readFeed(locale: Locale, httpFetch: typeof fetch = fetch): Promise<ListedPosting[]> {
  const xml = await get(httpFetch, FEED_URL, locale);
  const channelTitle = readTag(xml, 'title');
  if (!channelTitle.includes(FEED_FILTER)) {
    throw codedError(
      'source_format_changed',
      { detail: tFor(locale, COPY_NAMESPACE)('notFiltered', { channelTitle, filter: FEED_FILTER }) },
      { locale },
    );
  }
  const listedPostingList = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/g), ([, item = '']) =>
    readItem(item, locale),
  );
  if (listedPostingList.length === 0) {
    throw codedError(
      'source_format_changed',
      { detail: tFor(locale, COPY_NAMESPACE)('emptyFeed', { url: FEED_URL }) },
      { locale },
    );
  }
  return listedPostingList;
}

function readField(html: string, id: string): string | null {
  const value = new RegExp(String.raw`id="${id}"[^>]*>([\s\S]*?)</p>`).exec(html)?.[1] ?? '';
  return toText(value) === '' ? null : toText(value);
}

// The fields are read by their element ids, stable across offers (ADR-0001). The employing court of
// appeal tells the Zone, a Parameter of this Source only: it stays out of the Job Description.
export async function readJobDescription(
  reference: string,
  locale: Locale,
  httpFetch: typeof fetch = fetch,
): Promise<{ jobDescription: JobDescription; courtOfAppeal: string | null }> {
  // cspell:disable-next-line
  const url = `${ORIGIN}/offre-de-emploi/emploi_${reference.slice('AAAA-'.length)}.aspx`;
  const html = await get(httpFetch, url, locale);
  // cspell:disable-next-line
  const content = /id="contenu-ficheoffre"[^>]*>([\s\S]*?)<div class="ts-offer-page__cta is-bottom/.exec(html)?.[1];
  if (content === undefined) {
    throw codedError(
      'source_format_changed',
      { detail: tFor(locale, COPY_NAMESPACE)('unreadablePage', { reference, url }) },
      { locale },
    );
  }
  // cspell:disable
  const deadline = readField(content, 'fldoffer_date1');
  // The employing court of appeal is the offer's entity, such as « Direction des services judiciaires - CA DOUAI »
  const entity = toText(/_divEntityDesc"[^>]*>[\s\S]*?<\/h3>([\s\S]*?)<\/div>/.exec(content)?.[1] ?? '');
  const jobDescription = JOB_DESCRIPTION_SCHEMA.parse({
    deadline: deadline === null ? null : new Date(deadline.split('/').toReversed().join('-')),
    employer: readField(content, 'fldoffer_longtext2'),
    workplace: readField(content, 'fldlocation_shorttext1'),
    applicationEmail: readField(content, 'fldorigin_shorttext1'),
    contact1: readField(content, 'fldorigin_shorttext2'),
    contact2: readField(content, 'fldorigin_shorttext3'),
    markdown: toMarkdown(content),
  });
  // cspell:enable
  return { jobDescription, courtOfAppeal: / - CA (.+)$/.exec(entity)?.[1] ?? null };
}
