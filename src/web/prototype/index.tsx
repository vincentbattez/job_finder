// PROTOTYPE. No Home: the app opens on New (DECISIONS.md « Navigation »)
import { redirect } from 'react-router';

export function loader() {
  return redirect('/prototype/new');
}

export default function PrototypeIndex() {
  return null;
}
