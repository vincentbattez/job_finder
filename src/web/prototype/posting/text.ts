// PROTOTYPE · Posting page agent. Text helpers of the Artifact reading: sections (the study mode of
// variant C), blocks and their diff (« Comparer à l'Original »), slugs and reading time. They cut MDX at
// its top level only: never inside a fence nor inside a JSX component, so each piece compiles alone.

const FENCE_PATTERN = /^\s*(`{3,}|~{3,})/u;
const JSX_TAG_PATTERN = /<(\/?)([A-Z][\w.]*)(?:\s[^<>]*?)?(\/?)>/gu;

interface ILineScan {
  line: string;
  // At the top level: outside any fence and any JSX component, before this line
  isTopLevel: boolean;
}

// An opening tag whose attributes go on the next lines, as MDXEditor writes them
const OPEN_TAG_START_PATTERN = /<[A-Z][\w.]*(?:\s[^<>]*)?$/u;

function scanLines(source: string): ILineScan[] {
  let depth = 0;
  let fence: string | null = null;
  let isInOpeningTag = false;
  return source.split('\n').map((line) => {
    const isTopLevel = depth === 0 && fence === null && !isInOpeningTag;
    const fenceMatch = isInOpeningTag ? null : FENCE_PATTERN.exec(line);
    if (fenceMatch !== null) {
      const marker = fenceMatch[1] ?? '';
      if (fence === null) {
        fence = marker.charAt(0);
      } else if (marker.startsWith(fence)) {
        fence = null;
      }
    } else if (isInOpeningTag) {
      if (/\/>\s*$/u.test(line)) {
        isInOpeningTag = false;
      } else if (/>\s*$/u.test(line)) {
        isInOpeningTag = false;
        depth += 1;
      }
    } else if (fence === null) {
      for (const match of line.matchAll(JSX_TAG_PATTERN)) {
        if (match[1] === '/') {
          depth = Math.max(0, depth - 1);
        } else if (match[3] !== '/') {
          depth += 1;
        }
      }
      isInOpeningTag = OPEN_TAG_START_PATTERN.test(line);
    }
    return { line, isTopLevel };
  });
}

// A heading's text without its Markdown: « **1. Le cadre** » → « 1. Le cadre »
export function plainText(markdown: string): string {
  return markdown
    .replaceAll(/!?\[([^\]]*)\]\([^)]*\)/gu, '$1')
    .replaceAll(/[*_`~]/gu, '')
    .replaceAll(/\s+/gu, ' ')
    .trim();
}

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFD')
      .replaceAll(/[̀-ͯ]/gu, '')
      .replaceAll(/[^a-z0-9]+/gu, '-')
      .replaceAll(/^-|-$/gu, '')
      .slice(0, 60) || 'section'
  );
}

export interface ISection {
  id: string;
  title: string;
  source: string;
}

// The document cut at its top-level `## ` headings; what comes before is the introduction, titled by
// the `# ` heading when there is one
const SHORT_INTRODUCTION_CHARS = 600;

// The document cut at its top-level `## ` headings, its `# ` title apart; a short introduction joins the
// first section, a long one is a section of its own
export function splitSections(source: string): { title: string | null; sections: ISection[] } {
  const sectionList: ISection[] = [];
  let documentTitle: string | null = null;
  let introduction = '';
  let title: string | null = null;
  let lineList: string[] = [];
  const push = () => {
    const text = lineList.join('\n').trim();
    if (title === null) {
      introduction = text;
    } else if (text !== '') {
      sectionList.push({ id: `${String(sectionList.length)}-${slugify(title)}`, title, source: text });
    }
  };
  for (const { line, isTopLevel } of scanLines(source)) {
    if (isTopLevel && /^##\s/u.test(line)) {
      push();
      title = plainText(line.replace(/^##\s+/u, ''));
      lineList = [line];
      continue;
    }
    if (isTopLevel && title === null && documentTitle === null && /^#\s/u.test(line)) {
      documentTitle = plainText(line.replace(/^#\s+/u, ''));
      continue;
    }
    lineList.push(line);
  }
  push();
  const [first, ...rest] = sectionList;
  if (introduction === '' || first === undefined) {
    return {
      title: documentTitle,
      sections:
        first === undefined && introduction !== ''
          ? [{ id: '0-introduction', title: 'Introduction', source: introduction }]
          : sectionList,
    };
  }
  if (introduction.length < SHORT_INTRODUCTION_CHARS) {
    return { title: documentTitle, sections: [{ ...first, source: `${introduction}\n\n${first.source}` }, ...rest] };
  }
  return {
    title: documentTitle,
    sections: [{ id: 'intro-en-bref', title: 'En bref', source: introduction }, ...sectionList],
  };
}

// Top-level blocks: separated by blank lines, a component or a fence kept whole
export function splitBlocks(source: string): string[] {
  const blockList: string[] = [];
  let current: string[] = [];
  const scanList = scanLines(`${source}\n`);
  scanList.forEach(({ line }, index) => {
    const next = scanList[index + 1];
    const isBoundary = line.trim() === '' && (next === undefined || next.isTopLevel);
    if (isBoundary) {
      if (current.length > 0) {
        blockList.push(current.join('\n'));
      }
      current = [];
    } else {
      current.push(line);
    }
  });
  if (current.length > 0) {
    blockList.push(current.join('\n'));
  }
  return blockList;
}

const CONTAINER_OPEN_PATTERN = /^<([A-Z][\w.]*)(?:\s[^<>]*)?>$/u;

// A change inside one component (one Accordion of ten questions) is narrowed to its children, each
// shown wrapped in the component, so the comparison points at the question, not at the Accordion
function refine(hunk: Hunk): Hunk[] {
  if (hunk.kind !== 'change' || hunk.removed.length !== 1 || hunk.added.length !== 1) {
    return [hunk];
  }
  const leftLineList = (hunk.removed[0] ?? '').trim().split('\n');
  const rightLineList = (hunk.added[0] ?? '').trim().split('\n');
  const open = leftLineList[0] ?? '';
  const close = leftLineList.at(-1) ?? '';
  const name = CONTAINER_OPEN_PATTERN.exec(open.trim())?.[1];
  if (
    name === undefined ||
    leftLineList.length < 3 ||
    rightLineList.length < 3 ||
    open !== rightLineList[0] ||
    close !== rightLineList.at(-1) ||
    close.trim() !== `</${name}>`
  ) {
    return [hunk];
  }
  const wrap = (block: string) => `${open}\n\n${block}\n\n${close}`;
  return diffBlocks(leftLineList.slice(1, -1).join('\n'), rightLineList.slice(1, -1).join('\n')).map((inner): Hunk =>
    inner.kind === 'same'
      ? { kind: 'same', blocks: inner.blocks.map(wrap) }
      : { kind: 'change', removed: inner.removed.map(wrap), added: inner.added.map(wrap) },
  );
}

export type Hunk = { kind: 'same'; blocks: string[] } | { kind: 'change'; removed: string[]; added: string[] };

// Block-level diff (longest common subsequence), as hunks the two panes walk in step
export function diffBlocks(original: string, text: string): Hunk[] {
  const left = splitBlocks(original);
  const right = splitBlocks(text);
  const rows = left.length + 1;
  const columns = right.length + 1;
  const table = new Uint32Array(rows * columns);
  for (let leftIndex = left.length - 1; leftIndex >= 0; leftIndex -= 1) {
    for (let rightIndex = right.length - 1; rightIndex >= 0; rightIndex -= 1) {
      table[leftIndex * columns + rightIndex] =
        left[leftIndex]?.trim() === right[rightIndex]?.trim()
          ? (table[(leftIndex + 1) * columns + rightIndex + 1] ?? 0) + 1
          : Math.max(
              table[(leftIndex + 1) * columns + rightIndex] ?? 0,
              table[leftIndex * columns + rightIndex + 1] ?? 0,
            );
    }
  }
  const hunkList: Hunk[] = [];
  const pushSame = (block: string) => {
    const last = hunkList.at(-1);
    if (last?.kind === 'same') {
      last.blocks.push(block);
    } else {
      hunkList.push({ kind: 'same', blocks: [block] });
    }
  };
  const pushChange = (side: 'removed' | 'added', block: string) => {
    const last = hunkList.at(-1);
    if (last?.kind === 'change') {
      last[side].push(block);
    } else {
      hunkList.push({ kind: 'change', removed: [], added: [], [side]: [block] } as Hunk);
    }
  };
  let leftIndex = 0;
  let rightIndex = 0;
  while (leftIndex < left.length && rightIndex < right.length) {
    const leftBlock = left[leftIndex] ?? '';
    const rightBlock = right[rightIndex] ?? '';
    if (leftBlock.trim() === rightBlock.trim()) {
      pushSame(rightBlock);
      leftIndex += 1;
      rightIndex += 1;
    } else if (
      (table[(leftIndex + 1) * columns + rightIndex] ?? 0) >= (table[leftIndex * columns + rightIndex + 1] ?? 0)
    ) {
      pushChange('removed', leftBlock);
      leftIndex += 1;
    } else {
      pushChange('added', rightBlock);
      rightIndex += 1;
    }
  }
  for (; leftIndex < left.length; leftIndex += 1) {
    pushChange('removed', left[leftIndex] ?? '');
  }
  for (; rightIndex < right.length; rightIndex += 1) {
    pushChange('added', right[rightIndex] ?? '');
  }
  return hunkList.flatMap(refine);
}

// About 200 words a minute: what reading it, not learning it, takes
export function readingMinutes(source: string): number {
  const wordCount = source
    .replaceAll(/<[^>]+>/gu, ' ')
    .split(/\s+/u)
    .filter((word) => /\p{L}/u.test(word)).length;
  return Math.max(1, Math.round(wordCount / 200));
}
