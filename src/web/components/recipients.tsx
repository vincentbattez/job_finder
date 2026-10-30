import { useCatalogue } from '#/web/catalogue.ts';

type ContactField = 'applicationEmail' | 'contact1' | 'contact2';

export interface IRecipients {
  to: { email: string; source: ContactField } | null;
  ccList: { email: string; source: ContactField }[];
  salutation: { text: string; source: ContactField | null };
  justification: string;
}

function Source({ field }: Readonly<{ field: ContactField | null }>) {
  const { posting: copy } = useCatalogue();
  // Named as on the raw contacts, so each recommendation points at the line it comes from
  return field === null ? null : <span className="recipients__source">{copy.contactLabelByField[field]}</span>;
}

// What the Chosen Letter recommends: who receives the application, who gets a copy, and how to
// address them
export function Recipients({ recipients }: Readonly<{ recipients: IRecipients }>) {
  const { to, ccList, salutation, justification } = recipients;
  const { posting: copy } = useCatalogue();
  return (
    <>
      <dl className="recipients">
        <div>
          <dt>{copy.recipientTerm}</dt>
          <dd>
            {to === null ? <span className="missing">{copy.noRecipientAddress}</span> : to.email}
            <Source field={to?.source ?? null} />
          </dd>
        </div>
        <div>
          <dt>{copy.ccTerm}</dt>
          {ccList.length === 0 ? (
            <dd className="missing">{copy.noCc}</dd>
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
          <dt>{copy.salutationTerm}</dt>
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
