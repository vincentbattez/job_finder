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
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from '#/web/components/ui/sidebar.tsx';

type LinkKey = 'new' | 'toApply' | 'applications' | 'profile' | 'watches' | 'settings';

interface IEntry {
  key: LinkKey;
  pathname: string;
  icon: ReactNode;
}

// The lists of the journey, then the Candidate's settings (spec #125, « Navigation and URL state »).
const LIST_ENTRY_LIST: IEntry[] = [
  { key: 'new', pathname: '/', icon: <InboxIcon /> },
  { key: 'toApply', pathname: '/to-apply', icon: <ListTodoIcon /> },
  { key: 'applications', pathname: '/applications', icon: <BriefcaseIcon /> },
];

const SETTINGS_ENTRY_LIST: IEntry[] = [
  { key: 'profile', pathname: '/profile', icon: <UserRoundIcon /> },
  { key: 'watches', pathname: '/watches', icon: <RadarIcon /> },
  { key: 'settings', pathname: '/settings', icon: <SettingsIcon /> },
];

// What each entry counts, shown as a badge beside it: New counts the Postings left to sort
type CountByKey = Partial<Record<LinkKey, number>>;

function SidebarEntries({ entryList, countByKey = {} }: Readonly<{ entryList: IEntry[]; countByKey?: CountByKey }>) {
  const { t } = useTranslation('shell');
  const location = useLocation();
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {entryList.map(({ key, pathname, icon }) => {
            const label = t(`link.${key}`);
            const isActive = location.pathname === pathname;
            const count = countByKey[key] ?? 0;
            return (
              <SidebarMenuItem key={key}>
                <SidebarMenuButton asChild isActive={isActive} tooltip={label}>
                  <Link to={pathname} aria-current={isActive ? 'page' : undefined}>
                    {icon}
                    <span>{label}</span>
                  </Link>
                </SidebarMenuButton>
                {count > 0 && (
                  <SidebarMenuBadge className="bg-primary text-primary-foreground peer-hover/menu-button:text-primary-foreground peer-data-active/menu-button:text-primary-foreground">
                    <span aria-hidden>{count}</span>
                    <span className="sr-only">{t('newCount', { count })}</span>
                  </SidebarMenuBadge>
                )}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

// The shell's Sidebar (DESIGN.md « Navigation (Sidebar) »): the Candidate switcher at its head, the
// pages, New with the count of its Postings left to sort, then the Locale Switcher and the theme toggle
// at its foot. Collapsed, only the icons remain,
// each with its tooltip. The switchers come from the root, which runs their forms (ADR-0008).
export function AppSidebar({
  candidateSwitcher,
  localeSwitcher,
  newCount,
}: Readonly<{ candidateSwitcher: ReactNode; localeSwitcher: ReactNode; newCount: number }>) {
  const { t } = useTranslation('shell');
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>{candidateSwitcher}</SidebarHeader>
      <SidebarContent>
        <nav aria-label={t('navigationLabel')}>
          <SidebarEntries entryList={LIST_ENTRY_LIST} countByKey={{ new: newCount }} />
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
