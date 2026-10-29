// What became of the last save of a form: under way, then done
export function SaveStatus({
  state,
  isSaved,
}: Readonly<{ state: 'idle' | 'loading' | 'submitting'; isSaved: boolean }>) {
  if (state !== 'idle') {
    return <span role="status">Enregistrement…</span>;
  }
  return isSaved ? <span role="status">Enregistré</span> : null;
}
