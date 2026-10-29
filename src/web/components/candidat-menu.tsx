import { Form } from 'react-router';

interface ICandidat {
  id: string;
  name: string;
}

// A plain form, so the choice also works before React hydrates the page
export function CandidatMenu({
  candidatList,
  candidat,
}: Readonly<{ candidatList: ICandidat[]; candidat: ICandidat | null }>) {
  return (
    <Form method="post" action="/candidat" className="candidat-menu">
      <label htmlFor="candidat">Candidat</label>
      <select id="candidat" name="candidatId" key={candidat?.id} defaultValue={candidat?.id ?? ''}>
        {candidat === null && (
          <option value="" disabled>
            Votre nom
          </option>
        )}
        {candidatList.map(({ id, name }) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
      <button type="submit">Choisir</button>
    </Form>
  );
}
