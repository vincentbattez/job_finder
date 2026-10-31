import { useTranslation } from 'react-i18next';
import { useFetcher } from 'react-router';

import { ButtonRow } from '#/web/components/button-row.tsx';
import { ArtifactDocument as ArtifactDocumentView, type IArtifactDocument } from '#/web/components/edition.tsx';
import type { IRefusal } from '#/web/failure.ts';

// What the Candidate changes from the Posting page. Each form posts to a route that relays to
// an action, then comes back to the Posting page where it was (ADR-0003). Through a fetcher, a
// refusal comes back to the form, which shows it and keeps what was typed.

function Refusal({ data }: Readonly<{ data: IRefusal | undefined }>) {
  const error = data?.error ?? null;
  return error === null ? null : <p role="alert">{error}</p>;
}

// A file of a Version, saved in place in the Version chosen
export function ArtifactDocument({
  reference,
  artifact,
  ...document
}: Readonly<IArtifactDocument & { reference: string; artifact: string }>) {
  const fetcher = useFetcher<IRefusal>();
  return (
    <ArtifactDocumentView
      {...document}
      error={fetcher.data?.error}
      renderForm={(fieldList) => (
        <fetcher.Form method="post" action={`/postings/${reference}/${artifact}/document`} preventScrollReset>
          {fieldList}
        </fetcher.Form>
      )}
    />
  );
}

export function ChooseButton({
  reference,
  artifact,
  number,
}: Readonly<{ reference: string; artifact: string; number: number }>) {
  const { t } = useTranslation('posting');
  const fetcher = useFetcher<IRefusal>();
  return (
    <fetcher.Form method="post" action={`/postings/${reference}/${artifact}/chosen`} preventScrollReset>
      <input type="hidden" name="number" value={number} />
      <ButtonRow>
        <button className="button" type="submit">
          {t('chooseVersion')}
        </button>
        <Refusal data={fetcher.data} />
      </ButtonRow>
    </fetcher.Form>
  );
}

// Archived is a mark beside the Status, so its button stands apart from the outcome selector and
// leaves the Status as it is (ADR-0007)
export function ArchiveButton({ reference, isArchived }: Readonly<{ reference: string; isArchived: boolean }>) {
  const { t } = useTranslation('posting');
  const fetcher = useFetcher<IRefusal>();
  return (
    <fetcher.Form method="post" action={`/postings/${reference}/archive`} preventScrollReset>
      <ButtonRow>
        <button className="button" type="submit" name="intent" value={isArchived ? 'unarchive' : 'archive'}>
          {isArchived ? t('unarchive') : t('archive')}
        </button>
        <Refusal data={fetcher.data} />
      </ButtonRow>
    </fetcher.Form>
  );
}
