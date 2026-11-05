import { cn } from 'cn';
import { FileUpIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { buttonVariants } from '#/web/components/ui/button.tsx';

import { useIsHydrated } from './use-is-hydrated.ts';

// A tray that takes one file, dropped or chosen, between what it is for and what became of it;
// disabled until React hydrates, since the file leaves through a fetcher
export function DropZone({
  intro,
  accept,
  label,
  isBusy,
  onFile,
  error,
  children,
}: Readonly<{
  intro?: string;
  accept: string;
  label: string;
  isBusy: boolean;
  onFile: (file: File) => void;
  // What the action refused, in the red of every refusal
  error?: string | null | undefined;
  children?: ReactNode;
}>) {
  const isHydrated = useIsHydrated();
  const [isDragOver, setIsDragOver] = useState(false);
  const isDisabled = !isHydrated || isBusy;

  function takeFile(file: File | undefined): void {
    if (file !== undefined && !isBusy) {
      onFile(file);
    }
  }

  return (
    <div
      className={cn(
        'grid justify-items-start gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground transition-colors',
        isDragOver && 'border-solid border-primary bg-primary/5',
      )}
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
      {intro !== undefined && <p>{intro}</p>}
      <label
        className={cn(
          buttonVariants({ variant: 'outline' }),
          'cursor-pointer text-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50',
          isDisabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <FileUpIcon aria-hidden />
        {label}
        <input
          type="file"
          accept={accept}
          className="sr-only"
          disabled={isDisabled}
          onChange={(event) => {
            takeFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </label>
      <div aria-live="polite" className="empty:hidden">
        {children}
        {error != null && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
