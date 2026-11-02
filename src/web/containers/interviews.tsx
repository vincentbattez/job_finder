import type { ComponentProps, ReactNode } from 'react';
import { useFetcher } from 'react-router';

import type { IArtifactVersions } from '#/web/components/artifact.ts';
import { Interviews as InterviewsView } from '#/web/components/interviews.tsx';
import type { IRefusal } from '#/web/failure.ts';

import { ArtifactVersions } from './artifact-versions.tsx';

// One fetcher per form, so a refusal comes back to the form that posted it, which keeps what was typed;
// without JS, the form posts on its own and the route brings the Candidate back to the Posting page
function InterviewForm({
  reference,
  renderFieldList,
}: Readonly<{ reference: string; renderFieldList: (error: string | null | undefined) => ReactNode }>) {
  const fetcher = useFetcher<IRefusal>();
  return (
    <fetcher.Form method="post" action={`/postings/${reference}/interviews`} preventScrollReset>
      {renderFieldList(fetcher.data?.error)}
    </fetcher.Form>
  );
}

type InterviewsViewProperties = ComponentProps<typeof InterviewsView>;

// The Interviews of a Posting, added, edited and deleted through their action route (ADR-0003), each
// with its Interview Brief, run, rerun and chosen under it
export function Interviews({
  reference,
  interviewList,
  ...properties
}: Readonly<
  {
    reference: string;
    interviewList: (InterviewsViewProperties['interviewList'][number] & { artifactList: IArtifactVersions[] })[];
  } & Omit<InterviewsViewProperties, 'renderForm' | 'renderArtifacts' | 'interviewList'>
>) {
  return (
    <InterviewsView
      {...properties}
      interviewList={interviewList}
      renderForm={(formKey, renderFieldList) => (
        <InterviewForm key={formKey} reference={reference} renderFieldList={renderFieldList} />
      )}
      renderArtifacts={(interviewNumber) =>
        interviewList
          .find(({ number }) => number === interviewNumber)
          ?.artifactList.map((artifactVersions) => (
            <ArtifactVersions
              key={artifactVersions.artifact}
              reference={reference}
              interviewNumber={interviewNumber}
              {...artifactVersions}
            />
          ))
      }
    />
  );
}
