import { Form } from 'react-router';

import { useCatalogue } from '#/web/catalogue.ts';

interface ICandidate {
  id: string;
  name: string;
}

// A plain form, so the choice also works before React hydrates the page
export function CandidateMenu({
  candidateList,
  candidate,
}: Readonly<{ candidateList: ICandidate[]; candidate: ICandidate | null }>) {
  const { menu } = useCatalogue().settings;
  return (
    <Form method="post" action="/candidate" className="candidate-menu">
      <label htmlFor="candidate">{menu.candidateLabel}</label>
      <select id="candidate" name="candidateId" key={candidate?.id} defaultValue={candidate?.id ?? ''}>
        {candidate === null && (
          <option value="" disabled>
            {menu.namePlaceholder}
          </option>
        )}
        {candidateList.map(({ id, name }) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
      <button type="submit">{menu.choose}</button>
    </Form>
  );
}
