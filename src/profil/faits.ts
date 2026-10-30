// A `## ` heading and the lines up to the next one, kept as written; the first section is what comes
// before the first heading, the title and free text of faits.md
interface ISection {
  title: string | null;
  raw: string;
  isRewritten?: boolean;
}

// How the entries of a rubrique are read from its body and written back
interface IFormat {
  isList: boolean;
  read(body: string): string[];
  write(entryList: string[], body: string): string;
  clean(entryList: string[]): string[];
}

const ITEM = /^[*+-]\s/;

const TEXT_FORMAT: IFormat = {
  isList: false,
  read: (body) => [body.trim()],
  write: (entryList) => entryList.join('\n\n'),
  clean: (entryList) => [entryList.map((entry) => entry.trim()).join('\n\n')],
};

// The text before the first item, and a paragraph after the list, stay free text: the form does not
// show it, and keeps it. A line after an item belongs to it, its indentation of two spaces removed.
function splitList(body: string): { intro: string; entryList: string[]; outro: string } {
  const introLineList: string[] = [];
  const itemList: string[][] = [];
  const outroLineList: string[] = [];
  for (const line of body.split('\n')) {
    const lastItemLineList = itemList.at(-1);
    const isAfterList = !ITEM.test(line) && /^\S/.test(line) && lastItemLineList?.at(-1) === '';
    if (isAfterList || outroLineList.length > 0) {
      outroLineList.push(line);
    } else if (ITEM.test(line)) {
      itemList.push([line.slice(2)]);
    } else {
      (lastItemLineList ?? introLineList).push(line.replace(/^ {1,2}/, ''));
    }
  }
  return {
    intro: introLineList.join('\n').trim(),
    entryList: itemList.map((lineList) => lineList.join('\n').trim()),
    outro: outroLineList.join('\n').trim(),
  };
}

const LIST_FORMAT: IFormat = {
  isList: true,
  read: (body) => splitList(body).entryList,
  write: (entryList, body) => {
    const { intro, outro } = splitList(body);
    return [intro, entryList.map((entry) => `- ${entry.replaceAll(/\n(?=.)/g, '\n  ')}`).join('\n'), outro]
      .filter((text) => text !== '')
      .join('\n\n');
  },
  clean: (entryList) => entryList.map((entry) => entry.trim()).filter((entry) => entry !== ''),
};

// The rubriques of faits.md, in their order. jf profil's prompt and the form of the Faits share them:
// what Claude writes, the form reads.
export const RUBRIQUE_LIST = [
  { title: 'Identité', format: TEXT_FORMAT },
  { title: 'Coordonnées', format: TEXT_FORMAT },
  { title: 'Diplômes', format: LIST_FORMAT },
  { title: 'Expériences', format: LIST_FORMAT },
  { title: 'Compétences', format: TEXT_FORMAT },
  { title: 'Motivations', format: TEXT_FORMAT },
  { title: 'Mobilité', format: TEXT_FORMAT },
] as const;

interface IRubrique {
  title: string;
  isList: boolean;
  // A list rubrique has one entry per item, a text rubrique a single one
  entryList: string[];
}

const EMPTY_FAITS = '# Faits\n';

// Claude may write « Experiences » or « mobilité »: a rubrique is found whatever its case and accents
function normalizeTitle(title: string | null): string | null {
  return title === null ? null : title.normalize('NFD').replaceAll(/\p{M}/gu, '').toLowerCase();
}

function splitSections(markdown: string): ISection[] {
  const sectionList: ISection[] = [{ title: null, raw: '' }];
  for (const line of markdown.split(/(?<=\n)/)) {
    const lastSection = sectionList.at(-1);
    if (line.startsWith('## ')) {
      sectionList.push({ title: line.slice(3).trim(), raw: line });
    } else if (lastSection !== undefined) {
      lastSection.raw += line;
    }
  }
  return sectionList;
}

function findSection(sectionList: ISection[], title: string): ISection | undefined {
  return sectionList.find(
    (section) => section.title !== null && normalizeTitle(section.title) === normalizeTitle(title),
  );
}

function bodyOf({ raw }: ISection): string {
  return raw.includes('\n') ? raw.slice(raw.indexOf('\n') + 1) : '';
}

function writeSection(title: string, content: string): string {
  return content === '' ? `## ${title}\n` : `## ${title}\n\n${content}\n`;
}

export function readRubriques(markdown: string): IRubrique[] {
  const sectionList = splitSections(markdown);
  return RUBRIQUE_LIST.map(({ title, format }) => {
    const section = findSection(sectionList, title);
    return { title, isList: format.isList, entryList: format.read(section === undefined ? '' : bodyOf(section)) };
  });
}

// A new rubrique goes before the next rubrique of the form, else at the end
function insertSection(sectionList: ISection[], rubriqueIndex: number, section: ISection): void {
  const nextKeySet = new Set(RUBRIQUE_LIST.slice(rubriqueIndex + 1).map(({ title }) => normalizeTitle(title)));
  const nextIndex = sectionList.findIndex(({ title }) => nextKeySet.has(normalizeTitle(title)));
  sectionList.splice(nextIndex === -1 ? sectionList.length : nextIndex, 0, section);
}

// A rewritten section is set apart by a blank line; the others keep their spacing as written
function joinSections(sectionList: ISection[]): string {
  let markdown = '';
  for (const [index, { raw, isRewritten }] of sectionList.entries()) {
    const isNextToRewritten = isRewritten === true || sectionList[index - 1]?.isRewritten === true;
    markdown = markdown !== '' && isNextToRewritten ? `${markdown.trimEnd()}\n\n${raw}` : markdown + raw;
  }
  return markdown;
}

// Rewrites only the rubriques whose entries changed, in place; the other sections and the free text
// stay as written, and a file left unchanged is returned byte for byte
export function writeRubriques(markdown: string, rubriqueList: Pick<IRubrique, 'title' | 'entryList'>[]): string {
  const sectionList = splitSections(markdown === '' ? EMPTY_FAITS : markdown);
  let hasChanged = markdown === '';
  for (const [index, { title, format }] of RUBRIQUE_LIST.entries()) {
    const entryList = format.clean(rubriqueList.find((rubrique) => rubrique.title === title)?.entryList ?? []);
    const section = findSection(sectionList, title);
    const body = section === undefined ? '' : bodyOf(section);
    if (format.read(body).join('\0') === entryList.join('\0')) {
      continue;
    }
    const raw = writeSection(section?.title ?? title, format.write(entryList, body));
    if (section === undefined) {
      insertSection(sectionList, index, { title, raw, isRewritten: true });
    } else {
      Object.assign(section, { raw, isRewritten: true });
    }
    hasChanged = true;
  }
  return hasChanged ? joinSections(sectionList) : markdown;
}
