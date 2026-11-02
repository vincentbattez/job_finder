// PROTOTYPE · PLACEHOLDER owned by the lists agent: New, To Apply and Applications, one module for the
// three routes (prototype/new, prototype/to-apply, prototype/applications), as DECISIONS.md « Lists »
// describes them: list + sticky map, filters, the side Sheet; variants on ?variant=. Replace it all.
import { Link, useLocation } from 'react-router';

import { Badge } from '#/web/prototype/components/ui/badge.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#/web/prototype/components/ui/table.tsx';

import { formatDate, LIST_LABEL, listOf, STEP_LABEL, type ListName } from './model.ts';
import { PageHeader } from './page-header.tsx';
import { PrototypeSwitcher, usePrototypeVariant } from './prototype-switcher.tsx';
import { usePostings } from './store.ts';

// The variants to compare (DECISIONS.md: list + map layout), on ?variant=
const VARIANT_LIST = [
  { key: 'A', name: 'à définir' },
  { key: 'B', name: 'à définir' },
  { key: 'C', name: 'à définir' },
];

const LIST_BY_PATH: Record<string, ListName> = {
  '/prototype/new': 'new',
  '/prototype/to-apply': 'to_apply',
  '/prototype/applications': 'applications',
};

export default function Lists() {
  const { pathname } = useLocation();
  const list = LIST_BY_PATH[pathname] ?? 'new';
  const postings = usePostings().filter((posting) => listOf(posting) === list && posting.archivedAt === null);
  const variant = usePrototypeVariant('variant', VARIANT_LIST);
  return (
    <>
      <PageHeader
        title={LIST_LABEL[list]}
        description={`${String(postings.length)} Offres · placeholder · variante ${variant}`}
      />
      <PrototypeSwitcher variants={VARIANT_LIST} label="Liste" />
      <div className="p-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Titre</TableHead>
              <TableHead>Ville</TableHead>
              <TableHead>Date limite</TableHead>
              <TableHead>Étape</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {postings.map((posting) => (
              <TableRow key={posting.reference}>
                <TableCell className="max-w-xl truncate">
                  <Link to={`/prototype/postings/${posting.reference}`} className="hover:underline">
                    {posting.title}
                  </Link>
                </TableCell>
                <TableCell>{posting.city ?? '—'}</TableCell>
                <TableCell>{formatDate(posting.deadline)}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{STEP_LABEL[posting.step]}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
