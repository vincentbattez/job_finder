// PROTOTYPE · owned by the Posting page agent. /prototype/postings/:reference/interviews/:number/revision,
// the full-screen « Réviser l'Entretien » (DECISIONS.md « Revision »), out of the Sidebar: a countdown
// to the Interview, the Interview Brief full width in the reading variant of ?variant=A|B|C (the same
// layouts as the Posting page, posting/reader.tsx), and side access to the Portrait, the Posting and the
// Letter in a Sheet. It shows the newest Version, a Draft with its « Valider » at hand.
import {
  ArrowLeftIcon,
  BriefcaseIcon,
  CheckIcon,
  ClockIcon,
  MailIcon,
  MapPinIcon,
  UserRoundSearchIcon,
  UsersIcon,
} from 'lucide-react';
import { useState } from 'react';
import {
  Link,
  useLoaderData,
  useParams,
  useSearchParams,
  type LoaderFunctionArgs,
  type ShouldRevalidateFunctionArgs,
} from 'react-router';

import { Button } from '#/web/prototype/components/ui/button.tsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/web/prototype/components/ui/select.tsx';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '#/web/prototype/components/ui/sheet.tsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/web/prototype/components/ui/tabs.tsx';
import { cn } from '#/web/prototype/lib/utils.ts';

import { loadPostingDetail } from './data.server.ts';
import {
  artifactKeyOf,
  chosenVersionOf,
  formatDate,
  VERSION_STATE_LABEL,
  type IArtifact,
  type IVersion,
} from './model.ts';
import { VersionStateBadge } from './posting/artifact-view.tsx';
import { ArtifactContent, ArtifactReader, READING_VARIANT_LIST, type ReadingVariant } from './posting/reader.tsx';
import { countdownOf, formatLongDay, formatTime, useNow } from './posting/time.ts';
import { PrototypeSwitcher, usePrototypeVariant } from './prototype-switcher.tsx';
import { useActions, usePosting, usePostingDetail } from './store.ts';
import { ThemeToggle } from './theme-toggle.tsx';

export function loader({ request, params }: LoaderFunctionArgs) {
  return loadPostingDetail(request, params.reference ?? '');
}

export function shouldRevalidate({ currentParams, nextParams, currentUrl, nextUrl }: ShouldRevalidateFunctionArgs) {
  return currentParams.reference !== nextParams.reference || currentUrl.href === nextUrl.href;
}

type Side = 'portrait' | 'posting' | 'letter';

const SIDE_LABEL: Record<Side, string> = { portrait: 'Portrait', posting: 'Offre', letter: 'Lettre' };

function readableOf(artifact: IArtifact | undefined): IVersion | undefined {
  return artifact === undefined ? undefined : (chosenVersionOf(artifact) ?? artifact.versions.at(-1));
}

function SideEmpty({ children }: { children: string }) {
  return (
    <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">{children}</p>
  );
}

export default function RevisionPage() {
  const { reference = '', number = '' } = useParams();
  const [searchParams] = useSearchParams();
  const posting = usePosting(reference);
  const detail = usePostingDetail(reference, useLoaderData<typeof loader>());
  const actions = useActions();
  const variant = usePrototypeVariant('variant', READING_VARIANT_LIST) as ReadingVariant;
  const now = useNow(15_000);
  const [side, setSide] = useState<Side | null>(null);
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const interviewNumber = Number(number);
  const interview = posting?.interviews.find((other) => other.number === interviewNumber);
  const briefKey = artifactKeyOf('interview_brief', interviewNumber);
  const brief = detail?.artifacts.find(({ key }) => key === briefKey);
  const portrait = detail?.artifacts.find(({ key }) => key === artifactKeyOf('portrait', interviewNumber));
  const letter = detail?.artifacts.find(({ key }) => key === 'letter');
  const versionList = brief?.versions ?? [];
  const version = versionList.find((other) => other.number === selectedNumber) ?? versionList.at(-1);
  const backTo = `/prototype/postings/${reference}?tab=interviews&interview=${number}${
    searchParams.get('variant') === null ? '' : `&variant=${searchParams.get('variant') ?? ''}`
  }`;
  const countdown = interview === undefined ? null : countdownOf(interview, now);
  const portraitVersion = readableOf(portrait);
  const letterVersion = readableOf(letter);

  async function validate(versionNumber: number) {
    setIsValidating(true);
    await actions.validateVersion(reference, briefKey, versionNumber);
    setIsValidating(false);
  }

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto flex h-14 max-w-[96rem] items-center gap-2 px-3 sm:gap-3 sm:px-6">
          <Button asChild variant="ghost" size="icon-sm" aria-label="Retour à l’Offre">
            <Link to={backTo}>
              <ArrowLeftIcon />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">Réviser l’Entretien {number}</p>
            <p className="truncate text-xs text-muted-foreground">{posting?.title ?? reference}</p>
          </div>
          {countdown === null ? null : (
            <span
              className={cn(
                'hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium tabular-nums md:inline-flex',
                countdown.moment === 'past' ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary',
              )}
              suppressHydrationWarning
            >
              <ClockIcon className="size-3.5" />
              {countdown.label}
            </span>
          )}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setSide('portrait')}>
              <UserRoundSearchIcon />
              <span className="hidden sm:inline">Portrait</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSide('posting')}>
              <BriefcaseIcon />
              <span className="hidden sm:inline">Offre</span>
            </Button>
            <Button variant="ghost" size="sm" className="hidden md:inline-flex" onClick={() => setSide('letter')}>
              <MailIcon />
              Lettre
            </Button>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto max-w-[96rem] px-4 sm:px-6">
        {/* The Interview at a glance, and how long is left */}
        {interview === undefined || countdown === null ? null : (
          <section className="mt-6 grid gap-5 rounded-2xl border bg-gradient-to-br from-primary/[0.07] via-card to-card p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div className="min-w-0">
              <p className="text-xs font-medium tracking-wide text-primary uppercase">
                Entretien {interview.number} · {interview.durationMinutes} min
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight first-letter:uppercase sm:text-3xl">
                {formatLongDay(interview.startAt)} à {formatTime(interview.startAt)}
              </h1>
              <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                <p className="flex items-start gap-2">
                  <MapPinIcon className="mt-0.5 size-4 shrink-0" />
                  {interview.place || '—'}
                </p>
                <p className="flex items-start gap-2">
                  <UsersIcon className="mt-0.5 size-4 shrink-0" />
                  <span className="line-clamp-2">{interview.interviewers || '—'}</span>
                </p>
              </div>
            </div>
            <div className="flex items-baseline gap-2 md:flex-col md:items-end md:gap-0 md:text-right">
              <p className="text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl" suppressHydrationWarning>
                {countdown.moment === 'upcoming'
                  ? countdown.value
                  : countdown.moment === 'ongoing'
                    ? 'Maintenant'
                    : 'Passé'}
              </p>
              <p className="text-sm text-muted-foreground" suppressHydrationWarning>
                {countdown.moment === 'upcoming'
                  ? 'avant l’entretien'
                  : countdown.moment === 'ongoing'
                    ? 'l’entretien est en cours'
                    : `terminé ${countdown.label}`}
              </p>
            </div>
          </section>
        )}

        {/* Which Version is revised */}
        {version === undefined ? null : (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">Fiche d’entretien</span>
            <Select value={String(version.number)} onValueChange={(value) => setSelectedNumber(Number(value))}>
              <SelectTrigger size="sm" className="min-w-40" aria-label="Version">
                <SelectValue>
                  Version {version.number} · {VERSION_STATE_LABEL[version.state]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="start">
                {versionList.toReversed().map((other) => (
                  <SelectItem key={other.number} value={String(other.number)}>
                    Version {other.number} · {VERSION_STATE_LABEL[other.state]}
                    {other.isChosen ? ' · retenue' : ''} · {formatDate(other.createdAt)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <VersionStateBadge version={version} />
            {version.state === 'draft' ? (
              <Button
                size="sm"
                className="ml-auto"
                disabled={isValidating}
                onClick={() => void validate(version.number)}
              >
                <CheckIcon />
                {isValidating ? 'Validation…' : `Valider la Version ${String(version.number)}`}
              </Button>
            ) : null}
          </div>
        )}

        <main className="pt-8 pb-28">
          {version === undefined ? (
            <div className="rounded-2xl border border-dashed px-6 py-16 text-center">
              <h2 className="text-base font-semibold">Pas encore de Fiche d’entretien</h2>
              <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
                Génère-la depuis l’onglet Entretiens de l’Offre : elle deviendra ta page de révision.
              </p>
              <Button asChild size="sm" className="mt-5">
                <Link to={backTo}>Aller à l’Entretien</Link>
              </Button>
            </div>
          ) : (
            <ArtifactReader
              key={`${briefKey}:${String(version.number)}`}
              variant={variant}
              source={version.text}
              format={brief?.format ?? 'mdx'}
              memoryKey={`${reference}:${briefKey}:${String(version.number)}`}
              headerOffset={57}
            />
          )}
        </main>
      </div>

      <Sheet open={side !== null} onOpenChange={(isOpen) => setSide(isOpen ? side : null)}>
        <SheetContent side="right" className="w-full gap-0 sm:max-w-2xl">
          <SheetHeader className="border-b">
            <SheetTitle>À portée de main</SheetTitle>
            <SheetDescription>Le Portrait, l’Offre et la Lettre envoyée, sans quitter ta révision.</SheetDescription>
          </SheetHeader>
          <Tabs
            value={side ?? 'portrait'}
            onValueChange={(value) => setSide(value as Side)}
            className="min-h-0 flex-1 gap-0"
          >
            <TabsList variant="line" className="w-full justify-start rounded-none border-b px-4">
              {(['portrait', 'posting', 'letter'] as const).map((value) => (
                <TabsTrigger key={value} value={value} className="flex-none px-3">
                  {SIDE_LABEL[value]}
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              <TabsContent value="portrait">
                {portraitVersion === undefined ? (
                  <SideEmpty>Pas encore de Portrait pour cet Entretien.</SideEmpty>
                ) : (
                  <ArtifactContent
                    source={portraitVersion.text}
                    format={portrait?.format ?? 'mdx'}
                    className="prose-sm prose-h1:text-xl prose-h2:text-lg"
                  />
                )}
              </TabsContent>
              <TabsContent value="posting">
                <ArtifactContent
                  source={posting?.jobDescription ?? ''}
                  format="markdown"
                  className="prose-sm prose-h1:text-xl prose-h2:text-lg"
                />
              </TabsContent>
              <TabsContent value="letter">
                {letterVersion === undefined ? (
                  <SideEmpty>Pas de Lettre pour cette Offre.</SideEmpty>
                ) : (
                  <ArtifactContent
                    source={letterVersion.text}
                    format="markdown"
                    className="prose-sm prose-h1:text-xl prose-h2:text-lg"
                  />
                )}
              </TabsContent>
            </div>
          </Tabs>
        </SheetContent>
      </Sheet>
      <PrototypeSwitcher variants={READING_VARIANT_LIST} label="Révision" />
    </div>
  );
}
