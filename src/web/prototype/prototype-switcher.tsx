// PROTOTYPE. The floating variant switcher of the `prototype` skill (UI.md): a high-contrast pill at the
// bottom centre, ← → buttons and keys, the variant in a URL search param (shareable, reload-stable),
// hidden in production builds. Each switcher names its own param, so the page variant (?variant=) and
// the generation panel's (?panel=) switch independently; several stack in the dock layout.tsx mounts.
//
//   const variant = usePrototypeVariant('variant', VARIANT_LIST);
//   <PrototypeSwitcher param="variant" variants={VARIANT_LIST} label="Page" />
//   <PrototypeSwitcher param="panel" variants={PANEL_LIST} label="Panneau" keys="shift+arrows" />
//
// A variant is a key ('A') or { key: 'A', name: 'Dialog' }; the first one is the default.
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router';

import { cn } from '#/web/prototype/lib/utils.ts';

export type Variant = string | { key: string; name?: string };

const DOCK_ID = 'prototype-switcher-dock';

function keyOf(variant: Variant): string {
  return typeof variant === 'string' ? variant : variant.key;
}

function nameOf(variant: Variant): string | undefined {
  return typeof variant === 'string' ? undefined : variant.name;
}

// The current variant's key, the first one when the URL names none or an unknown one
export function usePrototypeVariant(param: string, variants: readonly Variant[]): string {
  const [searchParams] = useSearchParams();
  const value = searchParams.get(param);
  const keyList = variants.map(keyOf);
  return value !== null && keyList.includes(value) ? value : (keyList[0] ?? '');
}

// Arrow keys belong to what has the focus when it uses them itself
const KEY_OWNER_SELECTOR = [
  'input',
  'textarea',
  'select',
  '[contenteditable]:not([contenteditable="false"])',
  '[role="tablist"]',
  '[role="menu"]',
  '[role="menubar"]',
  '[role="listbox"]',
  '[role="slider"]',
  '[role="radiogroup"]',
  '[role="grid"]',
  '[role="tree"]',
  '.leaflet-container',
].join(',');

interface IPrototypeSwitcherProps {
  variants: readonly Variant[];
  param?: string;
  // What it switches, shown before the variant: « Page », « Panneau »
  label?: string;
  // The first switcher of a page takes the plain arrows, a second one Shift + arrows
  keys?: 'arrows' | 'shift+arrows';
}

export function PrototypeSwitcher({ variants, param = 'variant', label, keys = 'arrows' }: IPrototypeSwitcherProps) {
  const [, setSearchParams] = useSearchParams();
  const current = usePrototypeVariant(param, variants);
  const [dock, setDock] = useState<HTMLElement | null>(null);
  const index = Math.max(
    0,
    variants.findIndex((variant) => keyOf(variant) === current),
  );

  // From the URL as it is now, so two quick presses move two steps
  function go(step: number) {
    setSearchParams(
      (previous) => {
        const keyList = variants.map(keyOf);
        const from = Math.max(0, keyList.indexOf(previous.get(param) ?? ''));
        const next = new URLSearchParams(previous);
        next.set(param, keyList[(from + step + keyList.length) % keyList.length] ?? '');
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  }

  useEffect(() => {
    setDock(document.getElementById(DOCK_ID));
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
        return;
      }
      const wantsShift = keys === 'shift+arrows';
      if (event.shiftKey !== wantsShift || event.altKey || event.metaKey || event.ctrlKey || event.defaultPrevented) {
        return;
      }
      if (event.target instanceof Element && event.target.closest(KEY_OWNER_SELECTOR) !== null) {
        return;
      }
      event.preventDefault();
      go(event.key === 'ArrowLeft' ? -1 : 1);
    }
    globalThis.addEventListener('keydown', onKeyDown);
    return () => globalThis.removeEventListener('keydown', onKeyDown);
  });

  if (import.meta.env.PROD || dock === null || variants.length === 0) {
    return null;
  }
  const currentVariant = variants[index];
  const name = currentVariant === undefined ? undefined : nameOf(currentVariant);
  const buttonClass =
    'grid size-7 place-items-center rounded-full transition-colors hover:bg-background/15 focus-visible:outline-2 focus-visible:outline-background';
  return createPortal(
    <div
      className="pointer-events-auto flex items-center gap-1 rounded-full bg-foreground px-1 py-1 font-mono text-xs text-background shadow-xl ring-1 ring-background/20"
      data-prototype-switcher={param}
      data-variant={current}
    >
      <button
        type="button"
        className={buttonClass}
        onClick={() => go(-1)}
        aria-label={`Variante précédente (${param})`}
      >
        <ChevronLeftIcon className="size-4" />
      </button>
      <span className="min-w-28 px-2 text-center" aria-live="polite">
        {label === undefined ? null : <span className="opacity-60">{label} · </span>}
        <span className="font-semibold">{current}</span>
        {name === undefined ? null : <span className="opacity-80"> ({name})</span>}
        <span className="ml-2 opacity-50 max-sm:hidden">
          {keys === 'shift+arrows' ? '⇧' : ''}←→ · ?{param}=
        </span>
      </span>
      <button type="button" className={buttonClass} onClick={() => go(1)} aria-label={`Variante suivante (${param})`}>
        <ChevronRightIcon className="size-4" />
      </button>
    </div>,
    dock,
  );
}

// Where every switcher of the page goes, stacked; layout.tsx mounts it once
export function PrototypeSwitcherDock({ className }: { className?: string }) {
  if (import.meta.env.PROD) {
    return null;
  }
  return (
    <div
      id={DOCK_ID}
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col-reverse items-center gap-2',
        // While a generation panel is open, only its switcher shows: the page's sits behind the modal
        '[&:has(>[data-prototype-switcher=panel])>[data-prototype-switcher]:not([data-prototype-switcher=panel])]:hidden',
        // The full-height Sheet of panel B keeps its footer (summary, Annuler, Lancer) visible
        '[&:has(>[data-prototype-switcher=panel][data-variant=B])]:bottom-20',
        // On a phone the bottom belongs to the list's Drawer: the dock goes under the page header
        'max-sm:top-[4.25rem] max-sm:bottom-auto max-sm:flex-col',
        className,
      )}
    />
  );
}
