// A place name: words joined by a single space or hyphen, so « DOUAI - TJ … » stops at DOUAI
const NAME = String.raw`[\p{L}'’]+(?:[ -][\p{L}'’]+)*`;

// The ville written after a postcode, as in « quai Finkmatt 67000 STRASBOURG »
const POSTCODE_PATTERN = new RegExp(String.raw`\b\d{2} ?\d{3}\s+(${NAME})`, 'gu');

// A court is named after the ville it sits in: « Tribunal judiciaire de Sens », « TJ BOULOGNE SUR MER »
const COURT_PATTERN = new RegExp(
  String.raw`\b(?:tribunal judiciaire|tribunal de première instance|tribunal|cour d['’]appel|tj|ca)\s+(?:de\s+|d['’]\s*)?(${NAME})`,
  'giu',
);

// The Cour de cassation, the one court named without its ville
const PARIS_COURT_PATTERN = /cour de cassation/i;

function readLast(pattern: RegExp, text: string): string | undefined {
  return Array.from(text.matchAll(pattern), ([, name]) => name).at(-1);
}

// The ville of a lieu d'affectation written as free text, as the Sources publish it: the
// address's ville, else the court's, else the text itself, which is often the ville alone
export function readCity(workplace: string | null): string | null {
  if (workplace === null) {
    return null;
  }
  if (PARIS_COURT_PATTERN.test(workplace)) {
    return 'Paris';
  }
  const city = readLast(POSTCODE_PATTERN, workplace) ?? readLast(COURT_PATTERN, workplace) ?? workplace;
  return city.trim().replace(/ cedex$/i, '');
}
