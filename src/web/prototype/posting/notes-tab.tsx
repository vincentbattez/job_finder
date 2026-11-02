// PROTOTYPE · Posting page agent. The Notes tab: the Candidate's free text on the Posting, rewritten at
// will; the Research and the Letter read it as an Input.
import { SaveIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '#/web/prototype/components/ui/button.tsx';
import { Textarea } from '#/web/prototype/components/ui/textarea.tsx';

import type { IPosting } from '../model.ts';
import { useActions } from '../store.ts';

export function NotesTab({ posting }: { posting: IPosting }) {
  const { saveNotes } = useActions();
  const [notes, setNotes] = useState(posting.notes);
  const [isPending, setIsPending] = useState(false);
  useEffect(() => setNotes(posting.notes), [posting.notes]);
  const isDirty = notes !== posting.notes;

  async function save() {
    setIsPending(true);
    await saveNotes(posting.reference, notes);
    setIsPending(false);
  }

  return (
    <div className="mx-auto max-w-[72ch] space-y-3">
      <p className="text-sm text-muted-foreground">
        Tes notes sur cette Offre : un appel, une impression, ce qu’il ne faut pas oublier. La Recherche et la Lettre de
        motivation les lisent.
      </p>
      <Textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Écris ici…"
        className="min-h-[50vh] resize-y bg-card text-[15px] leading-relaxed"
      />
      <div className="flex items-center justify-end gap-3">
        {isDirty ? <span className="text-xs text-muted-foreground">Modifications non enregistrées</span> : null}
        <Button size="sm" disabled={!isDirty || isPending} onClick={() => void save()}>
          <SaveIcon />
          {isPending ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </div>
    </div>
  );
}
