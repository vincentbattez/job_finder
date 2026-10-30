type ContactField = 'applicationEmail' | 'contact1' | 'contact2';

export interface IRecipients {
  to: { email: string; source: ContactField } | null;
  ccList: { email: string; source: ContactField }[];
  salutation: { text: string; source: ContactField | null };
  justification: string;
}

// Named as on the raw contacts, so each recommendation points at the line it comes from
const CONTACT_LABEL_BY_FIELD: Record<ContactField, string> = {
  applicationEmail: 'Mail de candidature',
  contact1: 'Contact 1',
  contact2: 'Contact 2',
};

function Source({ field }: Readonly<{ field: ContactField | null }>) {
  return field === null ? null : <span className="recipients__source">{CONTACT_LABEL_BY_FIELD[field]}</span>;
}

// What the Lettre retenue recommends: who receives the application, who gets a copy, and how to
// address them
export function Recipients({ recipients }: Readonly<{ recipients: IRecipients }>) {
  const { to, ccList, salutation, justification } = recipients;
  return (
    <>
      <dl className="recipients">
        <div>
          <dt>Destinataire</dt>
          <dd>
            {to === null ? <span className="missing">Aucune adresse dans l’Offre</span> : to.email}
            <Source field={to?.source ?? null} />
          </dd>
        </div>
        <div>
          <dt>Copie</dt>
          {ccList.length === 0 ? (
            <dd className="missing">Aucune</dd>
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
          <dt>Formule d’appel</dt>
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
