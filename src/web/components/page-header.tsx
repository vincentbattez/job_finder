import type { ReactNode } from 'react';

import { Separator } from '#/web/components/ui/separator.tsx';
import { SidebarTrigger } from '#/web/components/ui/sidebar.tsx';

// The label of a header action: on a phone the action keeps its icon only (DESIGN.md « Layout »), its
// name for a screen reader
export function HeaderActionLabel({ children }: Readonly<{ children: ReactNode }>) {
  return <span className="sr-only md:not-sr-only">{children}</span>;
}

// The head of a page in the shell (DESIGN.md « Layout »): the Sidebar trigger, the title and its
// one-line description, then the page's actions on the right; sticky and translucent
export function PageHeader({
  title,
  description,
  actions,
}: Readonly<{ title: ReactNode; description?: ReactNode; actions?: ReactNode }>) {
  return (
    <header className="sticky top-0 z-20 flex min-h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 data-vertical:h-4 data-vertical:self-center" />
      <div className="min-w-0 flex-1 py-2">
        <h1 className="max-w-none truncate text-base font-semibold">{title}</h1>
        {description === undefined ? null : <p className="truncate text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions === undefined ? null : <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
