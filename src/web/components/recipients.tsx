import { useTranslation } from 'react-i18next';

type ContactField = 'applicationEmail' | 'contact1' | 'contact2';

export interface IRecipients {
  to: { email: string; source: ContactField } | null;
  ccList: { email: string; source: ContactField }[];
  salutation: { text: string; source: ContactField | null };
  justification: string;
}

function Source({ field }: Readonly<{ field: ContactField | null }>) {
  const { t } = useTranslation('posting');
  // Named as on the raw contacts, so each recommendation points at the line it comes from
  return field === null ? null : <span className="recipients__source">{t(`contactLabelByField.${field}`)}</span>;
}

// What the Chosen Letter recommends: who receives the application, who gets a copy, and how to
// address them
export function Recipients({ recipients }: Readonly<{ recipients: IRecipients }>) {
  const { to, ccList, salutation, justification } = recipients;
  const { t } = useTranslation('posting');
  return (
    <>
      <dl className="recipients">
        <div>
          <dt>{t('recipientTerm')}</dt>
          <dd>
            {to === null ? <span className="missing">{t('noRecipientAddress')}</span> : to.email}
            <Source field={to?.source ?? null} />
          </dd>
        </div>
        <div>
          <dt>{t('ccTerm')}</dt>
          {ccList.length === 0 ? (
            <dd className="missing">{t('noCc')}</dd>
          ) : (
            ccList.map(({ email, source }) => (
              <dd key={email}>
                {email}
                <Source field={source} />
              </dd>
            ))
          )}
        </div>
        <div>
          <dt>{t('salutationTerm')}</dt>
          <dd>
            {salutation.text}
            <Source field={salutation.source} />
          </dd>
        </div>
      </dl>
      <p className="recipients__justification">{justification}</p>
    </>
  );
}
