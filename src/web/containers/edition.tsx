import { useFetcher } from 'react-router';

import { ArtifactDocument as ArtifactDocumentView, type IArtifactDocument } from '#/web/components/edition.tsx';
import type { IRefusal } from '#/web/failure.ts';

import { InterviewField } from './interview-field.tsx';

// What the Candidate changes from the Posting page. Each form posts to a route that relays to
// an action, then comes back to the Posting page where it was (ADR-0003). Through a fetcher, a
// refusal comes back to the form, which shows it and keeps what was typed.

// The text of a Version, saved in place, Draft or Validated (ADR-0019)
export function ArtifactDocument({
  reference,
  interviewNumber,
  artifact,
  number,
  ...document
}: Readonly<
  IArtifactDocument & { reference: string; interviewNumber: number | null; artifact: string; number: number }
>) {
  const fetcher = useFetcher<IRefusal>();
  return (
    <ArtifactDocumentView
      {...document}
      error={fetcher.data?.error}
      renderForm={(fieldList) => (
        <fetcher.Form method="post" action={`/postings/${reference}/${artifact}/document`} preventScrollReset>
          <input type="hidden" name="number" value={number} />
          <InterviewField interviewNumber={interviewNumber} />
          {fieldList}
        </fetcher.Form>
      )}
    />
  );
}
