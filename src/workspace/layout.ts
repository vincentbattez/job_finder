import path from 'node:path';

import { ERROR } from '#/domain/error.ts';

import { migrateObsoleteConfig } from './acl/config.ts';
import { kindOf, listEntries, moveEntry } from './acl/layout.ts';

interface ILayoutStep {
  from: string;
  to: string;
}

// Each entry of the French layout and its English name, in order: a step names the English parent an
// earlier one moved. `*` stands for every entry of its folder, such as each Candidate. An entry with
// an extension is a file, any other a folder. The step can go once every data/ is migrated (#65).
const LAYOUT_STEP_LIST: ILayoutStep[] = [
  { from: 'candidats', to: 'candidates' },
  { from: 'candidates/*/profil', to: 'candidates/*/profile' },
  { from: 'candidates/*/profile/faits.md', to: 'candidates/*/profile/facts.md' },
  { from: 'candidates/*/profile/pieces', to: 'candidates/*/profile/uploads' },
  { from: 'candidates/*/consignes', to: 'candidates/*/instructions' },
];

// The concrete entries of a step, `*` replaced by each entry found
function expandStep(dataDirectory: string, { from, to }: ILayoutStep): ILayoutStep[] {
  const toSegmentList = to.split('/');
  let pairList: ILayoutStep[] = [{ from: '', to: '' }];
  for (const [index, segment] of from.split('/').entries()) {
    pairList = pairList.flatMap((pair) =>
      (segment === '*' ? listEntries(path.join(dataDirectory, pair.from)) : [segment]).map((name) => ({
        from: path.join(pair.from, name),
        to: path.join(pair.to, segment === '*' ? name : (toSegmentList[index] ?? '')),
      })),
    );
  }
  return pairList;
}

// Moves the French layout of the data folder to the English one, before anything reads it. Unknown
// entries stay as they are; a known one is moved, never copied, and never over its English
// counterpart: both at once is the Candidate's to merge (#65).
export function migrateLayout(dataDirectory: string): void {
  for (const step of LAYOUT_STEP_LIST) {
    const expectedKind = path.extname(step.to) === '' ? 'directory' : 'file';
    for (const { from, to } of expandStep(dataDirectory, step)) {
      const fromPath = path.join(dataDirectory, from);
      const toPath = path.join(dataDirectory, to);
      const fromKind = kindOf(fromPath);
      if (fromKind === null) {
        continue;
      }
      if (fromKind !== expectedKind) {
        throw ERROR.dataLayoutUnexpected(fromPath);
      }
      // Checked again: another process may have just moved it
      if (kindOf(toPath) !== null && kindOf(fromPath) !== null) {
        throw ERROR.dataLayoutMixed(fromPath, toPath);
      }
      moveEntry(fromPath, toPath);
    }
  }
  migrateObsoleteConfig(dataDirectory);
}
