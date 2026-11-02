// PROTOTYPE · Posting page agent. The Posting tab: its Job Description to read, and beside it what the
// Candidate checks at a glance (Deadline, Start Date, Contacts, Repost) and the Documents section, the
// Custom Artifacts of the Posting, with « Ajouter un document » (a text or a file, for this Posting or
// into the Profile as an Annex).
import { CalendarClockIcon, ExternalLinkIcon, FilePlus2Icon, FileTextIcon, MailIcon, RepeatIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';

import { Badge } from '#/web/prototype/components/ui/badge.tsx';
import { Button } from '#/web/prototype/components/ui/button.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/web/prototype/components/ui/dialog.tsx';
import { Input } from '#/web/prototype/components/ui/input.tsx';
import { Label } from '#/web/prototype/components/ui/label.tsx';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '#/web/prototype/components/ui/sheet.tsx';
import { Textarea } from '#/web/prototype/components/ui/textarea.tsx';
import { ToggleGroup, ToggleGroupItem } from '#/web/prototype/components/ui/toggle-group.tsx';

import {
  chosenVersionOf,
  formatCountdown,
  formatDate,
  STEP_LABEL,
  type IArtifact,
  type IPosting,
  type IPostingDetail,
} from '../model.ts';
import { useActions, usePosting } from '../store.ts';
import { ArtifactContent } from './reader.tsx';

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  );
}

function AsideCard({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>
        <h3 className="text-sm font-semibold">{title}</h3>
        <div className="ml-auto">{action}</div>
      </div>
      {children}
    </section>
  );
}

function RepostCard({ posting }: { posting: IPosting }) {
  const { repost } = posting;
  const earlier = usePosting(repost.repostOf ?? '');
  if (repost.repostOf === null && repost.repostList.length === 0) {
    return null;
  }
  return (
    <AsideCard title="Republication" icon={<RepeatIcon />}>
      <div className="space-y-2 text-sm">
        {repost.publicationNumber > 1 ? (
          <p>
            {repost.publicationNumber}
            <sup>e</sup> publication de ce Poste depuis le {formatDate(repost.firstPublishedAt)}.
          </p>
        ) : null}
        {earlier === undefined ? null : (
          <Link to={`/prototype/postings/${earlier.reference}`} className="block text-primary hover:underline">
            Offre précédente : {earlier.reference}
          </Link>
        )}
        {repost.earlierApplication === null ? null : (
          <p className="rounded-lg bg-muted/60 px-3 py-2">
            Tu as postulé le {formatDate(repost.earlierApplication.appliedAt)} ·{' '}
            {STEP_LABEL[repost.earlierApplication.step]}
          </p>
        )}
        {repost.repostList.map((reference) => (
          <Link key={reference} to={`/prototype/postings/${reference}`} className="block text-primary hover:underline">
            Republiée sous {reference}
          </Link>
        ))}
      </div>
    </AsideCard>
  );
}

function AddDocumentDialog({
  reference,
  isOpen,
  onOpenChange,
}: {
  reference: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const { addCustomArtifact } = useActions();
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [scope, setScope] = useState<'posting' | 'profile'>('posting');
  const [isPending, setIsPending] = useState(false);

  async function onFile(file: File) {
    if (title === '') {
      setTitle(file.name.replace(/\.(md|mdx|txt|pdf)$/iu, ''));
    }
    setText(
      /\.pdf$/iu.test(file.name)
        ? `_Texte extrait du PDF « ${file.name} » (conversion simulée dans le prototype)._`
        : await file.text(),
    );
  }

  async function submit() {
    setIsPending(true);
    await addCustomArtifact({ reference, title: title.trim(), text, scope });
    setIsPending(false);
    setTitle('');
    setText('');
    onOpenChange(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Ajouter un document</DialogTitle>
          <DialogDescription>
            Un texte à toi ou un fichier, que les générations pourront lire. Il est validé d’emblée.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <ToggleGroup
            type="single"
            variant="outline"
            spacing={0}
            value={scope}
            onValueChange={(value) => {
              if (value === 'posting' || value === 'profile') {
                setScope(value);
              }
            }}
            className="w-full"
          >
            <ToggleGroupItem value="posting" className="flex-1">
              Pour cette Offre
            </ToggleGroupItem>
            <ToggleGroupItem value="profile" className="flex-1">
              Dans mon Profil (Annexe)
            </ToggleGroupItem>
          </ToggleGroup>
          <div className="grid gap-1.5">
            <Label htmlFor="document-title">Titre</Label>
            <Input
              id="document-title"
              value={title}
              placeholder="Notes d’un appel, rapport d’activité…"
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="document-text">Texte</Label>
              <label className="cursor-pointer text-xs text-primary hover:underline">
                ou choisir un fichier (.md, PDF)
                <input
                  type="file"
                  accept=".md,.mdx,.txt,.pdf"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file !== undefined) {
                      void onFile(file);
                    }
                  }}
                />
              </label>
            </div>
            <Textarea
              id="document-text"
              value={text}
              className="min-h-40"
              onChange={(event) => setText(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button disabled={title.trim() === '' || text.trim() === '' || isPending} onClick={() => void submit()}>
            {isPending ? 'Ajout…' : 'Ajouter'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DocumentsCard({ posting, documents }: { posting: IPosting; documents: IArtifact[] }) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const open = documents.find(({ key }) => key === openKey);
  const openVersion = open === undefined ? undefined : chosenVersionOf(open);
  return (
    <AsideCard
      title="Documents"
      icon={<FileTextIcon />}
      action={
        <Button variant="ghost" size="xs" onClick={() => setIsAddOpen(true)}>
          <FilePlus2Icon />
          Ajouter
        </Button>
      }
    >
      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucun document. Ajoute un texte ou un fichier que la Recherche, la Lettre ou les Fiches liront.
        </p>
      ) : (
        <ul className="-mx-1 space-y-0.5">
          {documents.map((document) => (
            <li key={document.key}>
              <button
                type="button"
                onClick={() => setOpenKey(document.key)}
                className="flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-left text-sm hover:bg-muted"
              >
                <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{document.label}</span>
                {document.interviewNumber === null ? null : (
                  <Badge variant="outline" className="text-[10px]">
                    Entretien {document.interviewNumber}
                  </Badge>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      <AddDocumentDialog reference={posting.reference} isOpen={isAddOpen} onOpenChange={setIsAddOpen} />
      <Sheet open={open !== undefined} onOpenChange={(isOpen) => setOpenKey(isOpen ? openKey : null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{open?.label}</SheetTitle>
            <SheetDescription>
              Document de l’Offre · validé
              {openVersion === undefined ? '' : ` · ajouté le ${formatDate(openVersion.createdAt)}`}
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-8">
            {openVersion === undefined ? null : (
              <ArtifactContent source={openVersion.text} format="mdx" className="prose-sm" />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </AsideCard>
  );
}

export function PostingTab({ posting, detail }: { posting: IPosting; detail: IPostingDetail }) {
  const documents = detail.artifacts.filter(({ type }) => type === 'custom');
  const { contacts } = posting;
  const hasContacts = [contacts.applicationEmail, contacts.contact1, contacts.contact2, contacts.workplace].some(
    (value) => value !== null && value !== '',
  );
  return (
    <div className="@container">
      <div className="grid gap-8 @4xl:grid-cols-[minmax(0,1fr)_19rem]">
        <article className="min-w-0">
          <div className="mx-auto max-w-[72ch]">
            <p className="mb-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">Fiche de poste</p>
            <ArtifactContent
              source={posting.jobDescription}
              format="markdown"
              className="prose-h2:mt-10 prose-h3:mt-6 prose-h3:mb-1 prose-h3:text-[0.95rem] prose-p:my-1.5"
            />
          </div>
        </article>
        <aside className="space-y-4 @4xl:sticky @4xl:top-20 @4xl:self-start">
          <AsideCard title="Repères" icon={<CalendarClockIcon />}>
            <dl className="divide-y">
              <Fact label="Date limite">
                {formatDate(posting.deadline)}
                {posting.deadline === null ? null : (
                  <span className="ml-1.5 text-xs text-muted-foreground">({formatCountdown(posting.deadline)})</span>
                )}
              </Fact>
              <Fact label="Prise de poste">{formatDate(posting.startDate)}</Fact>
              <Fact label="Publiée le">{formatDate(posting.publishedAt)}</Fact>
              {posting.appliedAt === null ? null : <Fact label="Postulée le">{formatDate(posting.appliedAt)}</Fact>}
              <Fact label="Région">{posting.region ?? '—'}</Fact>
              <Fact label="Source">
                {posting.url === null ? (
                  posting.source
                ) : (
                  <a
                    href={posting.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    {posting.source}
                    <ExternalLinkIcon className="size-3" />
                  </a>
                )}
              </Fact>
            </dl>
          </AsideCard>
          {hasContacts ? (
            <AsideCard title="Contacts" icon={<MailIcon />}>
              <div className="space-y-1.5 text-sm">
                {contacts.applicationEmail === null ? null : (
                  <a
                    href={`mailto:${contacts.applicationEmail}`}
                    className="block truncate text-primary hover:underline"
                  >
                    {contacts.applicationEmail}
                  </a>
                )}
                {[contacts.contact1, contacts.contact2, contacts.workplace]
                  .filter((value): value is string => value !== null && value !== '')
                  .map((value) => (
                    <p key={value} className="text-muted-foreground">
                      {value}
                    </p>
                  ))}
              </div>
            </AsideCard>
          ) : null}
          <RepostCard posting={posting} />
          <DocumentsCard posting={posting} documents={documents} />
        </aside>
      </div>
    </div>
  );
}
