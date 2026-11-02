import { createHash } from 'node:crypto';

// Paul's Postings, which test/seed-front.ts imports, one per journey of e2e/posting-page.test.ts, which
// alone changes them: Léa's list and map stay as seeded
export type Journey = 'applied' | 'interviewed' | 'invited' | 'archive' | 'notes';

// The Job Description the seed imports for a journey, as it writes it
function markdownOf(journey: Journey): string {
  return `# Court clerk – ${journey}\n\nApply by 30 November 2026.\n`;
}

// The reference the import gives a Job Description, from its content (src/modules/source-import)
export function paulReferenceOf(journey: Journey): string {
  return `import-${createHash('sha256').update(markdownOf(journey)).digest('hex').slice(0, 10)}`;
}
