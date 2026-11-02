// PROTOTYPE. The head of a page in the shell: the Sidebar trigger, its title, then its actions on the
// right; sticky at the top of the page.
import type { ReactNode } from 'react';

import { Separator } from '#/web/prototype/components/ui/separator.tsx';
import { SidebarTrigger } from '#/web/prototype/components/ui/sidebar.tsx';
import { cn } from '#/web/prototype/lib/utils.ts';

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'sticky top-0 z-20 flex min-h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80',
        className,
      )}
    >
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 data-vertical:h-4 data-vertical:self-center" />
      <div className="min-w-0 flex-1 py-2">
        <h1 className="truncate text-base font-semibold">{title}</h1>
        {description === undefined ? null : <p className="truncate text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions === undefined ? null : <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
