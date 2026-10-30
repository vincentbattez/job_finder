// A place name: words joined by a single space or hyphen, so « DOUAI - TJ … » stops at DOUAI
const NAME = String.raw`[\p{L}'’]+(?:[ -][\p{L}'’]+)*`;

// The patterns read French addresses and court names, as the Sources publish them
// cspell:disable
// The city written after a postcode, as in « quai Finkmatt 67000 STRASBOURG »
const POSTCODE_PATTERN = new RegExp(String.raw`\b\d{2} ?\d{3}\s+(${NAME})`, 'gu');

// A court is named after the city it sits in: « Tribunal judiciaire de Sens », « TJ BOULOGNE SUR MER »
const COURT_PATTERN = new RegExp(
  String.raw`\b(?:tribunal judiciaire|tribunal de première instance|tribunal|cour d['’]appel|tj|ca)\s+(?:de\s+|d['’]\s*)?(${NAME})`,
  'giu',
);

// The Cour de cassation, the one court named without its city
const PARIS_COURT_PATTERN = /cour de cassation/i;
// cspell:enable

function readLast(pattern: RegExp, text: string): string | undefined {
  return Array.from(text.matchAll(pattern), ([, name]) => name).at(-1);
}

// The city of a place d'affectation written as free text, as the Sources publish it: the
// address's city, else the court's, else the text itself, which is often the city alone
export function readCity(workplace: string | null): string | null {
  if (workplace === null) {
    return null;
  }
  if (PARIS_COURT_PATTERN.test(workplace)) {
    return 'Paris';
  }
  const city = readLast(POSTCODE_PATTERN, workplace) ?? readLast(COURT_PATTERN, workplace) ?? workplace;
  // cspell:disable-next-line
  return city.trim().replace(/ cedex$/i, '');
}
