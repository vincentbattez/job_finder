import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetcher } from 'react-router';

import type { Status } from '#/web/components/badge.tsx';
import { ButtonRow } from '#/web/components/button-row.tsx';
import { ArtifactDocument as ArtifactDocumentView, type IArtifactDocument } from '#/web/components/edition.tsx';
import { useIsHydrated } from '#/web/components/use-is-hydrated.ts';
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

// Archived is a mark beside the Status, so its button stands apart from the Status buttons and
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

// A button for each status the action lets the Posting move to. Applied is never undone and freezes
// the Chosen Letter, the one sent: it takes a second click, without a browser dialog.
export function StatusButtons({
  reference,
  nextStatusList,
}: Readonly<{ reference: string; nextStatusList: Status[] }>) {
  const [isConfirming, setIsConfirming] = useState(false);
  const { t } = useTranslation('posting');
  const isHydrated = useIsHydrated();
  const fetcher = useFetcher<IRefusal>();
  return (
    <fetcher.Form method="post" action={`/postings/${reference}/status`} preventScrollReset>
      <ButtonRow>
        {nextStatusList.map((status) => {
          if (status !== 'applied') {
            return (
              <button className="button" key={status} type="submit" name="status" value={status}>
                {t(`statusButtonLabelByStatus.${status}`)}
              </button>
            );
          }
          return isConfirming ? (
            <Fragment key={status}>
              <button type="submit" name="status" value={status} className="button button--primary">
                {t('confirmApplied')}
              </button>
              <button
                className="button"
                type="button"
                onClick={() => {
                  setIsConfirming(false);
                }}
              >
                {t('cancel')}
              </button>
            </Fragment>
          ) : (
            <button
              key={status}
              type="button"
              className="button button--primary"
              disabled={!isHydrated}
              onClick={() => {
                setIsConfirming(true);
              }}
            >
              {t(`statusButtonLabelByStatus.${status}`)}
            </button>
          );
        })}
        {nextStatusList.includes('applied') && <p>{t('appliedFreezesLetter')}</p>}
        <Refusal data={fetcher.data} />
      </ButtonRow>
    </fetcher.Form>
  );
}
