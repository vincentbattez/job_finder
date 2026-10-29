// A text in lower case and without accents, so that « Béthune » and « BETHUNE » compare equal
export function foldText(text: string): string {
  return text.normalize('NFD').replaceAll(/\p{M}/gu, '').toLowerCase();
}

// A text as its words, whatever their case, accents, hyphens or spacing: « Boulogne sur mer » and
// « Boulogne-sur-Mer » have the same ones
export function wordListOf(text: string): string[] {
  return foldText(text)
    .split(/[^a-z0-9]+/)
    .filter((word) => word !== '');
}

// What anything thrown says: JavaScript lets code throw values that are not Errors
export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
