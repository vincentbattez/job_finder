import { cn } from 'cn';
import { ArchiveIcon, CheckIcon, ChevronsUpDownIcon, MapPinIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '#/web/components/ui/button.tsx';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '#/web/components/ui/command.tsx';
import { NativeSelect } from '#/web/components/ui/native-select.tsx';
import { Popover, PopoverContent, PopoverTrigger } from '#/web/components/ui/popover.tsx';
import { Toggle } from '#/web/components/ui/toggle.tsx';
import type { IListFilters } from '#/web/list-model.ts';

interface ITally {
  value: string;
  count: number;
}

interface IListFiltersProperties {
  filters: IListFilters;
  // What the list holds before the City and Region filters, each with its count
  cityList: ITally[];
  regionList: ITally[];
  archivedCount: number;
  // Each change derives from the filters as they are then, not as this render saw them: two Cities
  // ticked faster than a render both count
  onChange: (change: (filters: IListFilters) => IListFilters) => void;
}

// A filter that narrows the list takes the accent on its border
const ACTIVE_CLASS = 'border-primary/40';

function CityFilter({
  selectedList,
  cityList,
  onToggle,
}: Readonly<{ selectedList: string[]; cityList: ITally[]; onToggle: (city: string) => void }>) {
  const { t } = useTranslation('lists');
  const [isOpen, setIsOpen] = useState(false);
  let summary = t('filters.allCities');
  if (selectedList.length === 1) {
    summary = selectedList[0] ?? summary;
  } else if (selectedList.length > 1) {
    summary = t('filters.someCities', { count: selectedList.length });
  }
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={isOpen}
          aria-label={t('filters.city', { summary })}
          className={cn('min-w-0 flex-1 justify-between font-normal', selectedList.length > 0 && ACTIVE_CLASS)}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <MapPinIcon aria-hidden className="text-muted-foreground" />
            <span className="truncate">{summary}</span>
          </span>
          <ChevronsUpDownIcon aria-hidden className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 gap-0 p-0" align="start">
        <Command>
          <CommandInput placeholder={t('filters.searchCity')} aria-label={t('filters.searchCity')} />
          <CommandList>
            <CommandEmpty>{t('filters.noCity')}</CommandEmpty>
            <CommandGroup>
              {cityList.map(({ value, count }) => {
                const isSelected = selectedList.includes(value);
                return (
                  <CommandItem
                    key={value}
                    value={value}
                    data-checked={isSelected}
                    onSelect={() => {
                      onToggle(value);
                    }}
                  >
                    <CheckIcon aria-hidden className={cn('text-primary', !isSelected && 'invisible')} />
                    <span className="flex-1 truncate">{value}</span>
                    <span className="text-label text-muted-foreground tabular-nums">{count}</span>
                    {isSelected && <span className="sr-only">{t('filters.chosen')}</span>}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// The filters common to every list (spec #125 « Lists », DESIGN.md « Map-first list »), stacked in the
// list's panel: the Cities, several at once and searchable, the most frequent first; the Region; and
// Archived, which shows the list's Archived Postings instead of the followed ones
export function ListFilters({
  filters,
  cityList,
  regionList,
  archivedCount,
  onChange,
}: Readonly<IListFiltersProperties>) {
  const { t } = useTranslation('lists');
  const isFiltered = filters.cityList.length > 0 || filters.region !== null || filters.isArchived;
  return (
    <div role="search" aria-label={t('filters.label')} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <CityFilter
          selectedList={filters.cityList}
          cityList={cityList}
          onToggle={(city) => {
            onChange((current) => ({
              ...current,
              cityList: current.cityList.includes(city)
                ? current.cityList.filter((other) => other !== city)
                : [...current.cityList, city],
            }));
          }}
        />
        <div className="min-w-0 flex-1">
          <NativeSelect
            aria-label={t('filters.region')}
            value={filters.region ?? ''}
            onChange={(event) => {
              const region = event.target.value === '' ? null : event.target.value;
              onChange((current) => ({ ...current, region }));
            }}
            className={cn('h-8', filters.region !== null && ACTIVE_CLASS)}
          >
            <option value="">{t('filters.allRegions')}</option>
            {regionList.map(({ value, count }) => (
              <option key={value} value={value}>
                {t('filters.regionChoice', { region: value, count })}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Toggle
          size="sm"
          variant="outline"
          pressed={filters.isArchived}
          // The Archived hold other Cities and Regions: those chosen among the followed ones go
          onPressedChange={(isArchived) => {
            onChange(() => ({ cityList: [], region: null, isArchived }));
          }}
          className="gap-1.5 font-normal aria-pressed:border-primary/40 aria-pressed:bg-primary/[0.07]"
        >
          <ArchiveIcon aria-hidden />
          {t('filters.archived')}
          <span className="text-label text-muted-foreground tabular-nums">{archivedCount}</span>
        </Toggle>
        {isFiltered && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => {
              onChange(() => ({ cityList: [], region: null, isArchived: false }));
            }}
          >
            <XIcon aria-hidden />
            {t('filters.reset')}
          </Button>
        )}
      </div>
    </div>
  );
}
