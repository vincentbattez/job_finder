import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '#/web/components/ui/badge.tsx';

type ContactField = 'applicationEmail' | 'contact1' | 'contact2';

export interface IRecipients {
  to: { email: string; source: ContactField } | null;
  ccList: { email: string; source: ContactField }[];
  salutation: { text: string; source: ContactField | null };
  justification: string;
}

// Named as on the raw contacts, so each recommendation points at the line it comes from
function Source({ field }: Readonly<{ field: ContactField | null }>) {
  const { t } = useTranslation('posting');
  return field === null ? null : (
    <Badge variant="outline" className="font-normal text-muted-foreground">
      {t(`contactLabelByField.${field}`)}
    </Badge>
  );
}

function Row({ term, children }: Readonly<{ term: string; children: ReactNode }>) {
  return (
    <div className="grid gap-x-4 gap-y-1 sm:grid-cols-[8rem_minmax(0,1fr)]">
      <dt className="text-muted-foreground">{term}</dt>
      {children}
    </div>
  );
}

const DEFINITION_CLASS = 'flex sm:col-start-2 min-w-0 flex-wrap items-center gap-x-2 gap-y-1 [overflow-wrap:anywhere]';

// What the Letter recommends, above its page: who receives the application, who gets a copy, and how to
// address them
export function Recipients({ recipients }: Readonly<{ recipients: IRecipients }>) {
  const { to, ccList, salutation, justification } = recipients;
  const { t } = useTranslation('posting');
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <h3 id={headingId} className="max-w-none text-label text-muted-foreground uppercase">
        {t('recipientsHeading')}
      </h3>
      <dl className="space-y-2 text-sm">
        <Row term={t('recipientTerm')}>
          <dd className={DEFINITION_CLASS}>
            {to === null ? <span className="text-muted-foreground">{t('noRecipientAddress')}</span> : to.email}
            <Source field={to?.source ?? null} />
          </dd>
        </Row>
        <Row term={t('ccTerm')}>
          {ccList.length === 0 ? (
            <dd className="text-muted-foreground sm:col-start-2">{t('noCc')}</dd>
          ) : (
            ccList.map(({ email, source }) => (
              <dd key={email} className={DEFINITION_CLASS}>
                {email}
                <Source field={source} />
              </dd>
            ))
          )}
        </Row>
        <Row term={t('salutationTerm')}>
          <dd className={DEFINITION_CLASS}>
            {salutation.text}
            <Source field={salutation.source} />
          </dd>
        </Row>
      </dl>
      <p className="text-sm text-muted-foreground">{justification}</p>
    </section>
  );
}
