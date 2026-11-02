import { BriefcaseIcon, InboxIcon, ListTodoIcon, RadarIcon, SettingsIcon, UserRoundIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';

import { ThemeToggle } from '#/web/components/theme-toggle.tsx';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from '#/web/components/ui/sidebar.tsx';

type LinkKey = 'new' | 'toApply' | 'applications' | 'profile' | 'watches' | 'settings';

interface IEntry {
  key: LinkKey;
  pathname: string;
  hash: string;
  icon: ReactNode;
}

// The lists of the journey, then the Candidate's settings (spec #125, « Navigation and URL state »).
// Until its own ticket replaces it, an entry leads to the POC page that holds its features.
const LIST_ENTRY_LIST: IEntry[] = [
  { key: 'new', pathname: '/', hash: '', icon: <InboxIcon /> },
  { key: 'toApply', pathname: '/to-apply', hash: '', icon: <ListTodoIcon /> },
  { key: 'applications', pathname: '/applications', hash: '', icon: <BriefcaseIcon /> },
];

const SETTINGS_ENTRY_LIST: IEntry[] = [
  { key: 'profile', pathname: '/profile', hash: '', icon: <UserRoundIcon /> },
  { key: 'watches', pathname: '/profile', hash: '#watches', icon: <RadarIcon /> },
  { key: 'settings', pathname: '/settings', hash: '', icon: <SettingsIcon /> },
];

function SidebarEntries({ entryList }: Readonly<{ entryList: IEntry[] }>) {
  const { t } = useTranslation('shell');
  const location = useLocation();
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {entryList.map(({ key, pathname, hash, icon }) => {
            const label = t(`link.${key}`);
            const isActive = location.pathname === pathname && location.hash === hash;
            return (
              <SidebarMenuItem key={key}>
                <SidebarMenuButton asChild isActive={isActive} tooltip={label}>
                  <Link to={`${pathname}${hash}`} aria-current={isActive ? 'page' : undefined}>
                    {icon}
                    <span>{label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

// The shell's Sidebar (DESIGN.md « Navigation (Sidebar) »): the Candidate switcher at its head, the
// pages, then the Locale Switcher and the theme toggle at its foot. Collapsed, only the icons remain,
// each with its tooltip. The switchers come from the root, which runs their forms (ADR-0008).
export function AppSidebar({
  candidateSwitcher,
  localeSwitcher,
}: Readonly<{ candidateSwitcher: ReactNode; localeSwitcher: ReactNode }>) {
  const { t } = useTranslation('shell');
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>{candidateSwitcher}</SidebarHeader>
      <SidebarContent>
        <nav aria-label={t('navigationLabel')}>
          <SidebarEntries entryList={LIST_ENTRY_LIST} />
          <SidebarSeparator />
          <SidebarEntries entryList={SETTINGS_ENTRY_LIST} />
        </nav>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:flex-col">
          {localeSwitcher}
          <ThemeToggle />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
