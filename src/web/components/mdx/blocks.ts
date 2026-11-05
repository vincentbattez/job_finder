// The top-level blocks of an Artifact text, and its comparison with its Original block by block (spec #125,
// « Comparing »): blocks are cut at the MDX top level, never inside a fence or a component

const FENCE_PATTERN = /^\s*(`{3,}|~{3,})/u;
// A component opened at the start of a line, whose children follow on the next lines
const OPENING_TAG_PATTERN = /^\s*<([A-Z][\w.]*)(?:\s[^<>]*)?>\s*$/u;
const CLOSING_TAG_PATTERN = /^\s*<\/[A-Z][\w.]*>/u;

// Where a line leaves the scan: inside a fence (its opening mark), and how deep among components
interface IScan {
  fence: string | null;
  depth: number;
}

function scanLine({ fence, depth }: IScan, line: string): IScan {
  const fenceMark = FENCE_PATTERN.exec(line)?.[1];
  if (fenceMark !== undefined) {
    const isClosing = fence !== null && fenceMark[0] === fence[0] && fenceMark.length >= fence.length;
    return { fence: isClosing ? null : (fence ?? fenceMark), depth };
  }
  if (fence !== null) {
    return { fence, depth };
  }
  if (OPENING_TAG_PATTERN.test(line) && !line.trimEnd().endsWith('/>')) {
    return { fence, depth: depth + 1 };
  }
  return { fence, depth: CLOSING_TAG_PATTERN.test(line) ? Math.max(0, depth - 1) : depth };
}

export function splitBlocks(text: string): string[] {
  const blockList: string[][] = [[]];
  let scan: IScan = { fence: null, depth: 0 };
  for (const line of text.split('\n')) {
    if (scan.fence === null && scan.depth === 0 && line.trim() === '') {
      blockList.push([]);
      continue;
    }
    blockList.at(-1)?.push(line);
    scan = scanLine(scan, line);
  }
  return blockList.filter((lineList) => lineList.length > 0).map((lineList) => lineList.join('\n'));
}

// A run of blocks both texts share, or a change: the Original's blocks beside those that replaced them
export type BlockRun =
  { kind: 'same'; blockList: string[] } | { kind: 'change'; originalList: string[]; textList: string[] };

// The longest common subsequence of blocks, walked as runs the two columns follow in step
export function compareBlocks(original: string, text: string): BlockRun[] {
  const leftList = splitBlocks(original);
  const rightList = splitBlocks(text);
  const columnCount = rightList.length + 1;
  const common = new Uint32Array((leftList.length + 1) * columnCount);
  const at = (row: number, column: number): number => common[row * columnCount + column] ?? 0;
  for (let row = leftList.length - 1; row >= 0; row -= 1) {
    for (let column = rightList.length - 1; column >= 0; column -= 1) {
      common[row * columnCount + column] =
        leftList[row] === rightList[column]
          ? at(row + 1, column + 1) + 1
          : Math.max(at(row + 1, column), at(row, column + 1));
    }
  }
  const runList: BlockRun[] = [];
  function keep(block: string): void {
    const last = runList.at(-1);
    if (last?.kind === 'same') {
      last.blockList.push(block);
    } else {
      runList.push({ kind: 'same', blockList: [block] });
    }
  }
  function change(side: 'originalList' | 'textList', block: string): void {
    let last = runList.at(-1);
    if (last?.kind !== 'change') {
      last = { kind: 'change', originalList: [], textList: [] };
      runList.push(last);
    }
    last[side].push(block);
  }
  let row = 0;
  let column = 0;
  while (row < leftList.length || column < rightList.length) {
    const leftBlock = leftList[row];
    const rightBlock = rightList[column];
    if (leftBlock !== undefined && leftBlock === rightBlock) {
      keep(leftBlock);
      row += 1;
      column += 1;
    } else if (leftBlock !== undefined && (rightBlock === undefined || at(row + 1, column) >= at(row, column + 1))) {
      change('originalList', leftBlock);
      row += 1;
    } else if (rightBlock !== undefined) {
      change('textList', rightBlock);
      column += 1;
    }
  }
  return runList;
}
