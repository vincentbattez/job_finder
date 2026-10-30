import { useId } from 'react';
import { useFetcher } from 'react-router';

import { EtatBadge, type Etat } from './badge.tsx';
import { DateText } from './date.tsx';
import { DropZone } from './drop-zone.tsx';
import { useIsHydrated } from './use-is-hydrated.ts';
import { useRevalidateWhile } from './use-revalidate-while.ts';

// What the Profil action answers a fetcher: a refusal, in the words of the action, or none
interface IPieceRefusal {
  refusal: { message: string } | null;
}

interface IConversion {
  etat: Etat;
  log: string;
}

// The worker converts a Pièce in its own process (ADR-0003); its file then shows among those of the
// Profil. A failed conversion says why, and runs again on demand.
function PieceConversion({ fileName, conversion }: Readonly<{ fileName: string; conversion: IConversion }>) {
  const fetcher = useFetcher<IPieceRefusal>();
  const isHydrated = useIsHydrated();
  const labelId = useId();
  const { etat, log } = conversion;
  return (
    <fetcher.Form method="post" action="/profil" className="module-launch pieces__conversion" aria-labelledby={labelId}>
      <input type="hidden" name="fileName" value={fileName} />
      <span id={labelId}>
        Conversion en Markdown<span className="visually-hidden"> de {fileName}</span>
      </span>
      <span role="status">
        <EtatBadge etat={etat} />
      </span>
      {(etat === 'absent' || etat === 'en_echec') && (
        <button type="submit" name="intent" value="convertPiece" disabled={!isHydrated || fetcher.state !== 'idle'}>
          {etat === 'absent' ? 'Convertir' : 'Relancer la conversion'}
          <span className="visually-hidden"> de {fileName}</span>
        </button>
      )}
      {etat === 'en_echec' && <p className="module-launch__refusal">{log}</p>}
      {fetcher.state === 'idle' && fetcher.data?.refusal != null && <p role="alert">{fetcher.data.refusal.message}</p>}
    </fetcher.Form>
  );
}

// The PDFs the Candidat dropped, kept as is; the action says why a file is refused
export function Pieces({
  pieceList,
}: Readonly<{ pieceList: { fileName: string; savedAt: Date; conversion: IConversion }[] }>) {
  const headingId = useId();
  const fetcher = useFetcher<IPieceRefusal>();
  const isSending = fetcher.state !== 'idle';
  useRevalidateWhile(pieceList.some(({ conversion }) => conversion.etat === 'en_cours'));

  // Multipart, so the PDF reaches the action byte for byte, unlike the text of a Fiche de poste
  async function savePiece(file: File): Promise<void> {
    const formData = new FormData();
    formData.set('intent', 'piece');
    formData.set('piece', file);
    await fetcher.submit(formData, { method: 'post', action: '/profil', encType: 'multipart/form-data' });
  }

  return (
    <section className="pieces" aria-labelledby={headingId}>
      <h2 id={headingId}>Pièces</h2>
      {pieceList.length === 0 ? (
        <p className="pieces__empty">Aucune Pièce pour l’instant.</p>
      ) : (
        <ul className="pieces__list">
          {pieceList.map(({ fileName, savedAt, conversion }) => (
            <li key={fileName} className="pieces__item">
              <span className="reference">{fileName}</span>
              <span className="pieces__date">
                déposée le <DateText date={savedAt} />
              </span>
              {/* Folded, so a deletion always takes a second, deliberate click */}
              <details className="profil-file__delete">
                {/* The name is read aloud only: the row already shows it */}
                <summary>
                  Supprimer<span className="visually-hidden"> {fileName}</span>…
                </summary>
                <fetcher.Form method="post" action="/profil" className="edition">
                  <input type="hidden" name="fileName" value={fileName} />
                  <button type="submit" name="intent" value="deletePiece" className="button--danger">
                    Supprimer définitivement<span className="visually-hidden"> {fileName}</span>
                  </button>
                </fetcher.Form>
              </details>
              <PieceConversion fileName={fileName} conversion={conversion} />
            </li>
          ))}
        </ul>
      )}
      <DropZone
        intro="Glissez ici votre CV ou une lettre passée, en PDF de 10 Mo au plus. Une Pièce du même nom est remplacée."
        accept=".pdf,application/pdf"
        label="Déposer une Pièce"
        isBusy={isSending}
        onFile={(file) => void savePiece(file)}
      >
        {!isSending && fetcher.data?.refusal != null && (
          <p role="alert" className="drop-zone__error">
            {fetcher.data.refusal.message}
          </p>
        )}
      </DropZone>
    </section>
  );
}
