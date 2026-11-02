// PROTOTYPE (branch prototype/v1-ux, never merged). New, To Apply and Applications: one module for the
// three routes (prototype/new, prototype/to-apply, prototype/applications), as DECISIONS.md « Lists »
// describes them: list + sticky map synced both ways, common filters, the side Sheet a row opens; New
// carries Detection and Import in its header. Three variants of the list + map layout on ?variant=
// (lists/variant-*.tsx); the Sheet, the Detection, the filters and the mobile layout are shared.
// To Apply is seeded at load with a few kept Postings, in the client store only (lists/seed.ts).
import { useLocation } from 'react-router';

import { useIsMobile } from '#/web/prototype/hooks/use-mobile.ts';

import { DetectionCard, NewHeaderActions } from './lists/detection.tsx';
import { ListProvider, useListController } from './lists/list-context.tsx';
import { MobileLayout } from './lists/mobile.tsx';
import { PostingSheet } from './lists/posting-sheet.tsx';
import { VariantA } from './lists/variant-a.tsx';
import { VariantB } from './lists/variant-b.tsx';
import { VariantC } from './lists/variant-c.tsx';
import { LIST_LABEL, type ListName } from './model.ts';
import { PageHeader } from './page-header.tsx';
import { PrototypeSwitcher, usePrototypeVariant } from './prototype-switcher.tsx';

// The variants to compare (DECISIONS.md: list + map layout), on ?variant=
const VARIANT_LIST = [
  { key: 'A', name: 'Tableau + carte' },
  { key: 'B', name: 'Carte d’abord' },
  { key: 'C', name: 'Par échéance' },
];

const LIST_BY_PATH: Record<string, ListName> = {
  '/prototype/new': 'new',
  '/prototype/to-apply': 'to_apply',
  '/prototype/applications': 'applications',
};

const DESCRIPTION_BY_LIST: Record<ListName, (count: number) => string> = {
  new: (count) => (count === 0 ? 'Rien à trier' : `${String(count)} à trier : garde ou écarte`),
  to_apply: (count) => `${String(count)} à préparer, la date limite la plus proche en premier`,
  applications: (count) => `${String(count)} candidature${count > 1 ? 's' : ''} dans cet onglet`,
};

function ListPage() {
  const { list, listPostings } = useListController();
  const variant = usePrototypeVariant('variant', VARIANT_LIST);
  const isMobile = useIsMobile();
  return (
    <div className="flex h-svh flex-col">
      <PageHeader
        title={LIST_LABEL[list]}
        description={DESCRIPTION_BY_LIST[list](listPostings.length)}
        actions={list === 'new' ? <NewHeaderActions /> : undefined}
      />
      {list === 'new' ? <DetectionCard className="mb-3" /> : null}
      {isMobile ? <MobileLayout /> : null}
      {!isMobile && variant === 'A' ? <VariantA /> : null}
      {!isMobile && variant === 'B' ? <VariantB /> : null}
      {!isMobile && variant === 'C' ? <VariantC /> : null}
      <PostingSheet side={!isMobile && (variant === 'A' || variant === 'C') ? 'left' : 'right'} />
    </div>
  );
}

export default function Lists() {
  const { pathname } = useLocation();
  const list = LIST_BY_PATH[pathname] ?? 'new';
  return (
    <ListProvider key={list} list={list}>
      <ListPage />
      <PrototypeSwitcher variants={VARIANT_LIST} label="Liste" />
    </ListProvider>
  );
}
