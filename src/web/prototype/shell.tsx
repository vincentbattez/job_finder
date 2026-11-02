// PROTOTYPE (branch prototype/v1-ux, never merged). The shell of the prototype's pages (DECISIONS.md
// « Navigation »): a shadcn Sidebar with the Candidate switcher at its head (switching keeps the page),
// New with its count to sort, To Apply, Applications, then Profile, Watches, Settings; the theme toggle
// at its foot. A page starts with <PageHeader> (page-header.tsx), which carries the Sidebar trigger.
import {
  BriefcaseIcon,
  CheckIcon,
  ChevronsUpDownIcon,
  InboxIcon,
  ListTodoIcon,
  RadarIcon,
  SettingsIcon,
  UserRoundIcon,
  type LucideIcon,
} from 'lucide-react';
import { Link, Outlet, useLocation, useMatch, useNavigate, useRevalidator } from 'react-router';

import { Avatar, AvatarFallback } from '#/web/prototype/components/ui/avatar.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '#/web/prototype/components/ui/dropdown-menu.tsx';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
} from '#/web/prototype/components/ui/sidebar.tsx';

import { LIST_LABEL, listOf, type ListName } from './model.ts';
import { usePosting, usePostings, usePrototype } from './store.ts';
import { ThemeToggle } from './theme-toggle.tsx';

// Remembered by the loaders of data.server.ts (CANDIDATE_COOKIE_NAME), apart from the real front's
const CANDIDATE_COOKIE_NAME = 'prototype_candidate';

const LIST_ENTRY_LIST: { list: ListName; to: string; icon: LucideIcon }[] = [
  { list: 'new', to: '/prototype/new', icon: InboxIcon },
  { list: 'to_apply', to: '/prototype/to-apply', icon: ListTodoIcon },
  { list: 'applications', to: '/prototype/applications', icon: BriefcaseIcon },
];

const OTHER_ENTRY_LIST: { label: string; to: string; icon: LucideIcon }[] = [
  { label: 'Profil', to: '/prototype/profile', icon: UserRoundIcon },
  { label: 'Veilles', to: '/prototype/watches', icon: RadarIcon },
  { label: 'Réglages', to: '/prototype/settings', icon: SettingsIcon },
];

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/u)
      // Letters only: « Démo (vide) » is « DV », not « D( »
      .map((word) => word.replaceAll(/[^\p{L}]/gu, '').charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase()
  );
}

function CandidateSwitcher() {
  const { candidate, candidateList } = usePrototype();
  const revalidator = useRevalidator();
  const navigate = useNavigate();
  const isOnPosting = useMatch('/prototype/postings/*') !== null;

  // Keeps the page, but a Posting belongs to the Candidate it was: back to New then
  async function switchTo(candidateId: string) {
    document.cookie = `${CANDIDATE_COOKIE_NAME}=${encodeURIComponent(candidateId)}; path=/; max-age=31536000; samesite=lax`;
    if (isOnPosting) {
      await navigate('/prototype/new');
    }
    await revalidator.revalidate();
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  {initialsOf(candidate.name)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{candidate.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {revalidator.state === 'loading' ? 'Chargement…' : 'Candidat'}
                </span>
              </div>
              <ChevronsUpDownIcon className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-56" align="start" side="bottom" sideOffset={4}>
            <DropdownMenuLabel className="text-xs text-muted-foreground">Candidats</DropdownMenuLabel>
            {candidateList.map((other) => (
              <DropdownMenuItem key={other.id} onSelect={() => void switchTo(other.id)} className="gap-2">
                <Avatar className="size-6 rounded-md">
                  <AvatarFallback className="rounded-md text-xs">{initialsOf(other.name)}</AvatarFallback>
                </Avatar>
                {other.name}
                {other.id === candidate.id ? <CheckIcon className="ml-auto" /> : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

// The list a page belongs to: its own, or the one of the Posting it shows
function useCurrentList(): ListName | null {
  const { pathname } = useLocation();
  const postingMatch = useMatch('/prototype/postings/:reference/*');
  const posting = usePosting(postingMatch?.params.reference ?? '');
  if (posting !== undefined) {
    return listOf(posting);
  }
  return LIST_ENTRY_LIST.find(({ to }) => pathname.startsWith(to))?.list ?? null;
}

function PrototypeSidebar() {
  const postings = usePostings();
  const { pathname } = useLocation();
  const currentList = useCurrentList();
  const newCount = postings.filter((posting) => posting.status === 'new' && posting.archivedAt === null).length;
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <CandidateSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {LIST_ENTRY_LIST.map(({ list, to, icon: Icon }) => (
                <SidebarMenuItem key={list}>
                  <SidebarMenuButton asChild isActive={currentList === list} tooltip={LIST_LABEL[list]}>
                    <Link to={to}>
                      <Icon />
                      <span>{LIST_LABEL[list]}</span>
                    </Link>
                  </SidebarMenuButton>
                  {list === 'new' && newCount > 0 ? (
                    <SidebarMenuBadge className="rounded-full bg-primary text-primary-foreground peer-hover/menu-button:text-primary-foreground peer-data-[active=true]/menu-button:text-primary-foreground">
                      {newCount}
                    </SidebarMenuBadge>
                  ) : null}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator />
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {OTHER_ENTRY_LIST.map(({ label, to, icon: Icon }) => (
                <SidebarMenuItem key={to}>
                  <SidebarMenuButton asChild isActive={pathname.startsWith(to)} tooltip={label}>
                    <Link to={to}>
                      <Icon />
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:justify-center">
          <span className="truncate px-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
            Prototype · lecture seule
          </span>
          <ThemeToggle />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

export default function PrototypeShell() {
  return (
    <SidebarProvider>
      <PrototypeSidebar />
      <SidebarInset className="min-w-0">
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
