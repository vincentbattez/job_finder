import { CheckIcon, ChevronsUpDownIcon, Loader2Icon, UsersIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { Avatar, AvatarFallback } from '#/web/components/ui/avatar.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/web/components/ui/dropdown-menu.tsx';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '#/web/components/ui/sidebar.tsx';

interface ICandidate {
  id: string;
  name: string;
}

// Letters only: « Ann (test) » is « AT », not « A( »
function initialsOf(name: string): string {
  return name
    .split(/\s+/u)
    .map((word) => word.replaceAll(/[^\p{L}]/gu, '').charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// The head of the Sidebar: who reads, and the menu to read as another Candidate (DESIGN.md
// « Navigation (Sidebar) »). Its Container runs the switch.
export function CandidateSwitcher({
  candidateList,
  candidate,
  isPending,
  onSwitch,
}: Readonly<{
  candidateList: ICandidate[];
  candidate: ICandidate | null;
  isPending: boolean;
  onSwitch: (candidateId: string) => void;
}>) {
  const { t } = useTranslation('shell');
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              aria-label={t('candidate.switcherLabel')}
              aria-busy={isPending || undefined}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="size-8 rounded-lg" aria-hidden>
                <AvatarFallback className="rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  {isPending ? <Loader2Icon className="size-4 animate-spin" /> : initialsOf(candidate?.name ?? '?')}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate font-medium">{candidate?.name ?? t('candidate.noCandidate')}</span>
                {candidate !== null && (
                  <span className="truncate text-label text-muted-foreground">{t('candidate.role')}</span>
                )}
              </div>
              <ChevronsUpDownIcon className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-56" align="start" side="bottom" sideOffset={4}>
            <DropdownMenuLabel className="text-label text-muted-foreground">
              {t('candidate.listLabel')}
            </DropdownMenuLabel>
            {candidateList.map((other) => (
              <DropdownMenuItem
                key={other.id}
                className="gap-2"
                onSelect={() => {
                  if (other.id !== candidate?.id) {
                    onSwitch(other.id);
                  }
                }}
              >
                <Avatar className="size-6 rounded-md" aria-hidden>
                  <AvatarFallback className="rounded-md text-label">{initialsOf(other.name)}</AvatarFallback>
                </Avatar>
                {other.name}
                {other.id === candidate?.id ? <CheckIcon className="ml-auto" /> : null}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="gap-2">
              <Link to="/settings#candidates">
                <UsersIcon />
                {t('candidate.manage')}
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
