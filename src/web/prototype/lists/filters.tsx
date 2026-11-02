// PROTOTYPE. The filters common to the three lists (DECISIONS.md « Lists »): City (several, searchable,
// with counts), Region, Archived; and the Applications tabs. Each variant places them its own way.
import { ArchiveIcon, CheckIcon, ChevronsUpDownIcon, MapPinIcon, XIcon } from 'lucide-react';
import { useState } from 'react';

import { Button } from '#/web/prototype/components/ui/button.tsx';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '#/web/prototype/components/ui/command.tsx';
import { Popover, PopoverContent, PopoverTrigger } from '#/web/prototype/components/ui/popover.tsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '#/web/prototype/components/ui/select.tsx';
import { Tabs, TabsList, TabsTrigger } from '#/web/prototype/components/ui/tabs.tsx';
import { Toggle } from '#/web/prototype/components/ui/toggle.tsx';
import { cn } from '#/web/prototype/lib/utils.ts';

import { useListController } from './list-context.tsx';
import {
  APPLICATION_TAB_LIST,
  countBy,
  EMPTY_FILTERS,
  hasFilters,
  postingsOfList,
  type ApplicationTab,
} from './list-model.ts';

const ALL_REGIONS = '__all__';

function CityFilter({ className }: { className?: string }) {
  const { listPostings, filters, setFilters } = useListController();
  const [isOpen, setIsOpen] = useState(false);
  const cityList = countBy(listPostings, 'city');
  const selected = filters.cityList;
  function toggle(city: string) {
    setFilters({
      ...filters,
      cityList: selected.includes(city) ? selected.filter((other) => other !== city) : [...selected, city],
    });
  }
  const label =
    selected.length === 0
      ? 'Toutes les villes'
      : selected.length === 1
        ? selected[0]
        : `${String(selected.length)} villes`;
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={isOpen}
          className={cn(
            'justify-between font-normal',
            selected.length > 0 && 'border-primary/40 text-foreground',
            className,
          )}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <MapPinIcon className="text-muted-foreground" />
            <span className="truncate">{label}</span>
          </span>
          <ChevronsUpDownIcon className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Chercher une ville…" />
          <CommandList>
            <CommandEmpty>Aucune ville</CommandEmpty>
            <CommandGroup>
              {cityList.map(({ value, count }) => (
                <CommandItem key={value} value={value} onSelect={() => toggle(value)}>
                  <CheckIcon className={cn('size-4', selected.includes(value) ? 'opacity-100' : 'opacity-0')} />
                  <span className="flex-1 truncate">{value}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function RegionFilter({ className }: { className?: string }) {
  const { listPostings, filters, setFilters } = useListController();
  const regionList = countBy(listPostings, 'region').toSorted((first, second) =>
    first.value.localeCompare(second.value, 'fr'),
  );
  return (
    <Select
      value={filters.region ?? ALL_REGIONS}
      onValueChange={(value) => setFilters({ ...filters, region: value === ALL_REGIONS ? null : value })}
    >
      <SelectTrigger size="sm" className={cn('font-normal', filters.region !== null && 'border-primary/40', className)}>
        <SelectValue placeholder="Toutes les régions" />
      </SelectTrigger>
      <SelectContent position="popper" align="start">
        <SelectItem value={ALL_REGIONS}>Toutes les régions</SelectItem>
        <SelectSeparator />
        {regionList.map(({ value, count }) => (
          <SelectItem key={value} value={value}>
            {`${value} (${String(count)})`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ArchivedFilter({ className }: { className?: string }) {
  const { list, tab, allPostings, filters, setFilters } = useListController();
  const archivedCount = postingsOfList(allPostings, list, tab, true).length;
  return (
    <Toggle
      size="sm"
      variant="outline"
      pressed={filters.isArchived}
      onPressedChange={(isArchived) => setFilters({ ...filters, isArchived, cityList: [], region: null })}
      className={cn('gap-1.5 font-normal', className)}
      aria-label="Afficher les Offres archivées"
    >
      <ArchiveIcon />
      Archivées
      <span className="text-xs text-muted-foreground tabular-nums">{archivedCount}</span>
    </Toggle>
  );
}

// The three filters and a reset; « bar » wraps them on a line, « stack » puts them one per line
export function ListFilters({ layout = 'bar', className }: { layout?: 'bar' | 'stack'; className?: string }) {
  const { filters, setFilters, postings } = useListController();
  const isStack = layout === 'stack';
  return (
    <div className={cn('flex gap-2', isStack ? 'flex-col' : 'flex-wrap items-center', className)}>
      <div className={cn('flex gap-2', isStack ? 'w-full' : 'contents')}>
        <CityFilter className={isStack ? 'min-w-0 flex-1' : 'w-44'} />
        <RegionFilter className={isStack ? 'min-w-0 flex-1' : 'w-48'} />
      </div>
      <div className={cn('flex items-center gap-2', isStack ? 'w-full' : 'contents')}>
        <ArchivedFilter />
        {hasFilters(filters) ? (
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setFilters(EMPTY_FILTERS)}>
            <XIcon />
            Réinitialiser
          </Button>
        ) : null}
        <span className={cn('text-sm text-muted-foreground tabular-nums', isStack ? 'ml-auto' : 'ml-auto pl-2')}>
          {postings.length} {postings.length > 1 ? 'Offres' : 'Offre'}
        </span>
      </div>
    </div>
  );
}

// In progress | Hired | Rejected, with their counts; nothing outside Applications
export function ApplicationTabs({ className, isFull = false }: { className?: string; isFull?: boolean }) {
  const { list, tab, setTab, allPostings, filters } = useListController();
  if (list !== 'applications') {
    return null;
  }
  return (
    <Tabs value={tab} onValueChange={(value) => setTab(value as ApplicationTab)} className={className}>
      <TabsList className={cn(isFull && 'w-full')}>
        {APPLICATION_TAB_LIST.map(({ key, label }) => (
          <TabsTrigger key={key} value={key} className="gap-1.5">
            {label}
            <span className="text-xs text-muted-foreground tabular-nums">
              {postingsOfList(allPostings, 'applications', key, filters.isArchived).length}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
