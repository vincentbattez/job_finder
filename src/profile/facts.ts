// A `## ` heading and the lines up to the next one, kept as written; the first part is what comes
// before the first heading, the title and free text of facts.md
interface IPart {
  title: string | null;
  raw: string;
  isRewritten?: boolean;
}

// How the entries of a section are read from its body and written back
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

// The sections of facts.md, in their order. jf profile's prompt and the form of the Facts share them:
// what Claude writes, the form reads. Each has an example of what it holds, which its empty field
// shows: a whole section for a text one, a single item for a list one.
// cspell:disable
export const SECTION_LIST = [
  { title: 'Identité', format: TEXT_FORMAT, example: 'Léa Durand, née le 4 mars 1999, de nationalité française' },
  {
    title: 'Coordonnées',
    format: TEXT_FORMAT,
    example: '12 rue Nationale, 59000 Lille\n06 12 34 56 78 · lea.durand@example.fr',
  },
  { title: 'Diplômes', format: LIST_FORMAT, example: 'Master 2 Droit public, Université de Lille, 2023' },
  {
    title: 'Expériences',
    format: LIST_FORMAT,
    example: 'Assistante de justice, Tribunal judiciaire de Lille, 2023-2025\n- Rédaction de projets de jugements',
  },
  { title: 'Compétences', format: TEXT_FORMAT, example: '- Rédaction juridique\n- Procédure civile\n- Word et Excel' },
  {
    title: 'Motivations',
    format: TEXT_FORMAT,
    example: 'Appuyer les magistrats au plus près des justiciables, dans une juridiction du Nord',
  },
  { title: 'Mobilité', format: TEXT_FORMAT, example: '- Lille et alentours\n- Béthune, Arras, Boulogne-sur-Mer' },
] as const;
// cspell:enable

interface ISection {
  title: string;
  isList: boolean;
  example: string;
  // A list section has one entry per item, a text section a single one
  entryList: string[];
}

const EMPTY_FACTS = '# Faits\n';

// Claude may write « Experiences » or « mobilité »: a section is found whatever its case and accents
function normalizeTitle(title: string | null): string | null {
  return title === null ? null : title.normalize('NFD').replaceAll(/\p{M}/gu, '').toLowerCase();
}

function splitParts(markdown: string): IPart[] {
  const partList: IPart[] = [{ title: null, raw: '' }];
  for (const line of markdown.split(/(?<=\n)/)) {
    const lastPart = partList.at(-1);
    if (line.startsWith('## ')) {
      partList.push({ title: line.slice(3).trim(), raw: line });
    } else if (lastPart !== undefined) {
      lastPart.raw += line;
    }
  }
  return partList;
}

function findPart(partList: IPart[], title: string): IPart | undefined {
  return partList.find((part) => part.title !== null && normalizeTitle(part.title) === normalizeTitle(title));
}

function bodyOf({ raw }: IPart): string {
  return raw.includes('\n') ? raw.slice(raw.indexOf('\n') + 1) : '';
}

function writePart(title: string, content: string): string {
  return content === '' ? `## ${title}\n` : `## ${title}\n\n${content}\n`;
}

export function readSections(markdown: string): ISection[] {
  const partList = splitParts(markdown);
  return SECTION_LIST.map(({ title, format, example }) => {
    const part = findPart(partList, title);
    return {
      title,
      isList: format.isList,
      example,
      entryList: format.read(part === undefined ? '' : bodyOf(part)),
    };
  });
}

// A new section goes before the next section of the form, else at the end
function insertPart(partList: IPart[], sectionIndex: number, part: IPart): void {
  const nextKeySet = new Set(SECTION_LIST.slice(sectionIndex + 1).map(({ title }) => normalizeTitle(title)));
  const nextIndex = partList.findIndex(({ title }) => nextKeySet.has(normalizeTitle(title)));
  partList.splice(nextIndex === -1 ? partList.length : nextIndex, 0, part);
}

// A rewritten part is set apart by a blank line; the others keep their spacing as written
function joinParts(partList: IPart[]): string {
  let markdown = '';
  for (const [index, { raw, isRewritten }] of partList.entries()) {
    const isNextToRewritten = isRewritten === true || partList[index - 1]?.isRewritten === true;
    markdown = markdown !== '' && isNextToRewritten ? `${markdown.trimEnd()}\n\n${raw}` : markdown + raw;
  }
  return markdown;
}

// Rewrites only the sections whose entries changed, in place; the other parts and the free text
// stay as written, and a file left unchanged is returned byte for byte
export function writeSections(markdown: string, sectionList: Pick<ISection, 'title' | 'entryList'>[]): string {
  const partList = splitParts(markdown === '' ? EMPTY_FACTS : markdown);
  let hasChanged = markdown === '';
  for (const [index, { title, format }] of SECTION_LIST.entries()) {
    const entryList = format.clean(sectionList.find((section) => section.title === title)?.entryList ?? []);
    const part = findPart(partList, title);
    const body = part === undefined ? '' : bodyOf(part);
    if (format.read(body).join('\0') === entryList.join('\0')) {
      continue;
    }
    const raw = writePart(part?.title ?? title, format.write(entryList, body));
    if (part === undefined) {
      insertPart(partList, index, { title, raw, isRewritten: true });
    } else {
      Object.assign(part, { raw, isRewritten: true });
    }
    hasChanged = true;
  }
  return hasChanged ? joinParts(partList) : markdown;
}
