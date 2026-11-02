import type { ReactNode } from 'react';

import { Separator } from '#/web/components/ui/separator.tsx';
import { SidebarTrigger } from '#/web/components/ui/sidebar.tsx';

// The head of a page in the shell (DESIGN.md « Layout »): the Sidebar trigger, the title, then what a
// page adds as it needs it (description, actions); sticky and translucent
export function PageHeader({ title }: Readonly<{ title: ReactNode }>) {
  return (
    <header className="sticky top-0 z-20 flex min-h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 data-vertical:h-4 data-vertical:self-center" />
      <div className="min-w-0 flex-1 py-2">
        <h1 className="truncate text-base font-semibold">{title}</h1>
      </div>
    </header>
  );
}
