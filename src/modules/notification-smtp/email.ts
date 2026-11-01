import type { Locale } from '#/domain/index.ts';
import type { INotification, INotificationLine, INotificationSection } from '#/notification/index.ts';

// The palette of the front (src/web/tokens.css) in hex: a mailbox reads neither its custom properties
// nor oklch, and drops a <style> block, hence the inline styles
const INK = '#0f1d19';
const MUTED = '#56655f';
const ACCENT = '#0f5b40';
const RULE = '#cfd8cb';
const PAPER = '#eaf5ef';

const STYLE = {
  body: `margin:0;padding:24px 16px;background:${PAPER};color:${INK};font-family:-apple-system,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.5`,
  page: 'max-width:640px;margin:0 auto;padding:24px;background:#ffffff;border-radius:8px',
  title: 'margin:0 0 8px;font-size:22px;line-height:1.3',
  heading: `margin:28px 0 12px;padding-bottom:6px;border-bottom:1px solid ${RULE};color:${MUTED};font-size:13px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase`,
  list: 'margin:0;padding:0;list-style:none',
  line: 'margin:0 0 14px',
  link: `color:${ACCENT};font-weight:600;text-decoration:none`,
  text: 'font-weight:600',
  detail: `display:block;color:${MUTED};font-size:14px`,
};

const ESCAPE_BY_CHARACTER: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

// The titles come from the Source's site: none may inject markup into the Candidate's mailbox
function escapeHtml(text: string): string {
  return text.replaceAll(/[&<>"']/g, (character) => ESCAPE_BY_CHARACTER[character] ?? character);
}

// Only a web page is linked: a link of any other scheme from a Source is shown as text
const WEB_URL_PATTERN = /^https?:\/\//;

function htmlLineOf({ text, detail, url }: INotificationLine): string {
  const label =
    url === null || !WEB_URL_PATTERN.test(url)
      ? `<span style="${STYLE.text}">${escapeHtml(text)}</span>`
      : `<a href="${escapeHtml(url)}" style="${STYLE.link}">${escapeHtml(text)}</a>`;
  const detailHtml = detail === null ? '' : `<span style="${STYLE.detail}">${escapeHtml(detail)}</span>`;
  return `<li style="${STYLE.line}">${label}${detailHtml}</li>`;
}

function htmlOf(title: string, sectionList: INotificationSection[], locale: Locale): string {
  const sectionHtml = sectionList
    .map(
      ({ heading, lineList }) =>
        `<h2 style="${STYLE.heading}">${escapeHtml(heading)}</h2><ul style="${STYLE.list}">${lineList.map((line) => htmlLineOf(line)).join('')}</ul>`,
    )
    .join('');
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"></head><body style="${STYLE.body}"><div style="${STYLE.page}"><h1 style="${STYLE.title}">${escapeHtml(title)}</h1>${sectionHtml}</div></body></html>`;
}

// The same sections for a mailbox that shows no HTML: each line, its detail and its link under it
function textOf(sectionList: INotificationSection[]): string {
  return sectionList
    .map(({ heading, lineList }) =>
      [
        heading,
        '',
        lineList
          .map(({ text, detail, url }) =>
            [`• ${text}`, ...[detail, url].filter((part) => part !== null).map((part) => `  ${part}`)].join('\n'),
          )
          .join('\n\n'),
      ].join('\n'),
    )
    .join('\n\n');
}

// A notification with sections is laid out in full, as a page and as text; any other is its message
export function emailOf(
  { title, message, sectionList }: INotification,
  locale: Locale,
): {
  subject: string;
  text: string;
  html?: string;
} {
  return sectionList === undefined
    ? { subject: title, text: message }
    : { subject: title, text: textOf(sectionList), html: htmlOf(title, sectionList, locale) };
}
