import { useState, type ReactNode } from 'react';

import { useIsHydrated } from './use-is-hydrated.ts';

import './drop-zone.css';

// A tray that takes one file, dropped or chosen, between what it is for and what became of it;
// disabled until React hydrates, since the file leaves through a fetcher
export function DropZone({
  intro,
  accept,
  label,
  isBusy,
  onFile,
  children,
}: Readonly<{
  intro: string;
  accept: string;
  label: string;
  isBusy: boolean;
  onFile: (file: File) => void;
  children: ReactNode;
}>) {
  const isHydrated = useIsHydrated();
  const [isDragOver, setIsDragOver] = useState(false);

  function takeFile(file: File | undefined): void {
    if (file !== undefined && !isBusy) {
      onFile(file);
    }
  }

  return (
    <div
      className="drop-zone"
      data-drag-over={isDragOver}
      onDragOver={(event) => {
        // Lets the file drop here, instead of the browser opening it
        event.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => {
        setIsDragOver(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragOver(false);
        takeFile(event.dataTransfer.files[0]);
      }}
    >
      <p>{intro}</p>
      <label className="button drop-zone__choose" data-disabled={!isHydrated || isBusy}>
        {label}
        <input
          type="file"
          accept={accept}
          className="visually-hidden"
          disabled={!isHydrated || isBusy}
          onChange={(event) => {
            takeFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </label>
      <div aria-live="polite">{children}</div>
    </div>
  );
}
