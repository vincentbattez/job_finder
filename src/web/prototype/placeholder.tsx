// PROTOTYPE. Profile, Watches and Settings are out of the prototype's scope (DECISIONS.md « Navigation »):
// one placeholder page for the three routes, with just enough to land on. The Watches page shows each
// Watch's Near Misses, where the Detection result links (#near-misses).
import { useLocation } from 'react-router';

import { Badge } from '#/web/prototype/components/ui/badge.tsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/web/prototype/components/ui/card.tsx';

import { formatDateTime } from './model.ts';
import { PageHeader } from './page-header.tsx';
import { usePrototype } from './store.ts';

const TITLE_BY_PATH: Record<string, string> = {
  '/prototype/profile': 'Profil',
  '/prototype/watches': 'Veilles',
  '/prototype/settings': 'Réglages',
};

function ProfilePlaceholder() {
  const { profileDocuments } = usePrototype();
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {profileDocuments.map((document) => (
        <li key={document.key} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
          <span className="truncate">{document.label}</span>
          <Badge variant="outline">{document.fileName}</Badge>
        </li>
      ))}
    </ul>
  );
}

function WatchesPlaceholder() {
  const { watches } = usePrototype();
  return (
    <div className="space-y-4">
      {watches.map((watch) => (
        <Card key={watch.id}>
          <CardHeader>
            <CardTitle>{watch.label}</CardTitle>
            <CardDescription>
              {watch.source} · dernière Détection : {formatDateTime(watch.lastDetectedAt)}
            </CardDescription>
          </CardHeader>
          <CardContent id="near-misses">
            <p className="mb-2 text-sm font-medium">Titres écartés de peu</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {watch.nearMisses.map((nearMiss) => (
                <li key={nearMiss.reference}>{nearMiss.title}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function Placeholder() {
  const { pathname } = useLocation();
  const title = TITLE_BY_PATH[pathname] ?? 'Page';
  return (
    <>
      <PageHeader title={title} description="Hors du périmètre du prototype" />
      <div className="p-4">
        {pathname === '/prototype/profile' ? <ProfilePlaceholder /> : null}
        {pathname === '/prototype/watches' ? <WatchesPlaceholder /> : null}
        {pathname === '/prototype/settings' ? (
          <p className="text-sm text-muted-foreground">Rien à régler dans le prototype.</p>
        ) : null}
      </div>
    </>
  );
}
