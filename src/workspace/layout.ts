import path from 'node:path';

import { ARTIFACT_RENAME_LIST } from '#/domain/artifact-rename.ts';
import { codedError } from '#/domain/coded-error.ts';

import { migrateObsoleteConfig } from './acl/config.ts';
import { deleteDirectory } from './acl/files.ts';
import { kindOf, listEntries, moveEntry } from './acl/layout.ts';

interface ILayoutStep {
  from: string;
  to: string;
}

// Each entry of the French layout and its English name, in order: a step names the English parent an
// earlier one moved. `*` stands for any part of a name, kept as is: a whole `*` for every entry of
// its folder, such as each Candidate. An entry with an extension is a file, any other a folder. The step can go once every data/ is migrated (#65).
const LAYOUT_STEP_LIST: ILayoutStep[] = [
  { from: 'candidats', to: 'candidates' },
  { from: 'candidates/*/profil', to: 'candidates/*/profile' },
  { from: 'candidates/*/profile/faits.md', to: 'candidates/*/profile/facts.md' },
  // Her past letters, which the conversion names in English now
  { from: 'candidates/*/profile/lettre-*.md', to: 'candidates/*/profile/letter-*.md' },
  { from: 'candidates/*/profile/pieces', to: 'candidates/*/profile/uploads' },
  { from: 'candidates/*/consignes', to: 'candidates/*/instructions' },
  { from: 'candidates/*/offres', to: 'candidates/*/postings' },
  { from: 'candidates/*/postings/*/fiche-de-poste.md', to: 'candidates/*/postings/*/job-description.md' },
  // The Instructions of each Artifact, each Artifact folder, then the files of each of its Versions
  ...ARTIFACT_RENAME_LIST.flatMap(({ from, to }) => [
    { from: `candidates/*/instructions/${from}.md`, to: `candidates/*/instructions/${to}.md` },
    { from: `candidates/*/postings/*/${from}`, to: `candidates/*/postings/*/${to}` },
  ]),
  { from: 'candidates/*/postings/*/research/*/recherche.md', to: 'candidates/*/postings/*/research/*/research.md' },
  { from: 'candidates/*/postings/*/letter/*/brouillon.md', to: 'candidates/*/postings/*/letter/*/draft.md' },
  { from: 'candidates/*/postings/*/letter/*/lettre.md', to: 'candidates/*/postings/*/letter/*/letter.md' },
  {
    from: 'candidates/*/postings/*/letter/*/destinataires.json',
    to: 'candidates/*/postings/*/letter/*/recipients.json',
  },
  {
    from: 'candidates/*/postings/*/interview_brief/*/fiche-entretien.md',
    to: 'candidates/*/postings/*/interview_brief/*/interview-brief.md',
  },
  {
    from: 'candidates/*/postings/*/visualization/*/visualisation.html',
    to: 'candidates/*/postings/*/visualization/*/visualization.html',
  },
];

// The Interview Brief and the Visualization of a Posting, which the migration of spec #45 deleted
// from the database: they belong to an Interview now, in its own folder (#52). The step can go once
// every data/ is migrated.
const OBSOLETE_ENTRY_LIST = ['candidates/*/postings/*/interview_brief', 'candidates/*/postings/*/visualization'];

// The names of a folder a segment of a step matches, each with what its `*` stands for
function matchSegment(directory: string, segment: string): { name: string; wildcard: string }[] {
  if (!segment.includes('*')) {
    return [{ name: segment, wildcard: '' }];
  }
  const [prefix = '', suffix = ''] = segment.split('*', 2);
  return listEntries(directory)
    .filter((name) => name.length > prefix.length + suffix.length && name.startsWith(prefix) && name.endsWith(suffix))
    .map((name) => ({ name, wildcard: name.slice(prefix.length, name.length - suffix.length) }));
}

// The concrete entries of a step, each `*` replaced by what it matched
function expandStep(dataDirectory: string, { from, to }: ILayoutStep): ILayoutStep[] {
  const toSegmentList = to.split('/');
  let pairList: ILayoutStep[] = [{ from: '', to: '' }];
  for (const [index, segment] of from.split('/').entries()) {
    pairList = pairList.flatMap((pair) =>
      matchSegment(path.join(dataDirectory, pair.from), segment).map(({ name, wildcard }) => ({
        from: path.join(pair.from, name),
        to: path.join(
          pair.to,
          (toSegmentList[index] ?? '').replace('*', () => wildcard),
        ),
      })),
    );
  }
  return pairList;
}

// Each obsolete entry of the data folder, with all it holds; one already gone is the same outcome
function deleteObsoleteEntries(dataDirectory: string): void {
  const entryList = OBSOLETE_ENTRY_LIST.flatMap((entry) => expandStep(dataDirectory, { from: entry, to: entry }));
  for (const { from } of entryList) {
    deleteDirectory(path.join(dataDirectory, from));
  }
}

// Moves the French layout of the data folder to the English one, before anything reads it, then
// deletes the obsolete entries. Unknown entries stay as they are; a known one is moved, never copied, and never over its English
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
        throw codedError('data_layout_unexpected', { frenchPath: fromPath });
      }
      // Checked again: another process may have just moved it
      if (kindOf(toPath) !== null && kindOf(fromPath) !== null) {
        throw codedError('data_layout_mixed', { frenchPath: fromPath, englishPath: toPath });
      }
      moveEntry(fromPath, toPath);
    }
  }
  deleteObsoleteEntries(dataDirectory);
  migrateObsoleteConfig(dataDirectory);
}
