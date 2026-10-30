import { Form } from 'react-router';

interface ICandidate {
  id: string;
  name: string;
}

// A plain form, so the choice also works before React hydrates the page
export function CandidateMenu({
  candidateList,
  candidate,
}: Readonly<{ candidateList: ICandidate[]; candidate: ICandidate | null }>) {
  return (
    <Form method="post" action="/candidate" className="candidate-menu">
      <label htmlFor="candidate">Candidat</label>
      <select id="candidate" name="candidateId" key={candidate?.id} defaultValue={candidate?.id ?? ''}>
        {candidate === null && (
          <option value="" disabled>
            Votre nom
          </option>
        )}
        {candidateList.map(({ id, name }) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
      <button type="submit">Choisir</button>
    </Form>
  );
}
