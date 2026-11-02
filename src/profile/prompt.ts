import { LANGUAGE_BY_LOCALE, type Candidate } from '#/domain/index.ts';

import { SECTION_LIST } from './facts.ts';

// How a CV, a past letter or an Annex becomes a file of the Profile, shared by jf profile and the
// conversion job of an Upload, so both convert alike. A document keeps its own language: it is content.
export const CONVERSION_INSTRUCTIONS =
  'convert it faithfully into Markdown, without rewriting or translating it: a CV into `cv.md`, a cover letter into `letter-<employer>-<year>.md`, any other document (a recommendation letter, a transcript, a thesis, an internship report) into the Annex `annex-<subject>.md`; the employer or the subject in lowercase and without accents, its words joined by hyphens, for example `letter-tj-lille-2025.md` or `annex-recommendation-tj-lille.md`';

// The Profile as the Artifacts that read it describe it: its documents come among the Inputs, the core in
// full, the Annexes the Candidate checked (ADR-0021)
export function describeProfile(): string {
  return "The Candidate's Profile, the only source of facts about the Candidate, comes among the Inputs: `facts.md`, the facts they validated, `cv.md`, their Past Letters, and the further documents they chose to give, such as a recommendation letter, a transcript or a thesis. Where a document contradicts `facts.md`, `facts.md` prevails.";
}

// Fixed, with no Instructions to replace it (ADR-0003); the session runs in the Profile folder, its
// "current folder"
export function composeProfilePrompt({ name, locale }: Candidate): string {
  const language = LANGUAGE_BY_LOCALE[locale];
  const titles = SECTION_LIST.map(({ title }) => title).join(', ');
  const listTitles = SECTION_LIST.filter(({ format }) => format.isList)
    .map(({ title }) => title)
    .join(' and ');
  return `You help ${name} complete their Candidate Profile. Talk with ${name} in ${language}.

The current folder is this Profile: Markdown files from which the job_finder tool draws the facts to write ${name}'s cover letters and prepare their interviews. Each fact must therefore be exact and validated by ${name}.

Steps:
1. First read every file of the current folder. If there are any, sum up in a few lines what the Profile already holds and what is missing.
2. Ask ${name} about their background, one question at a time: identity, contact details, degrees, internships, work experience, skills, motivations, geographic mobility. Ask for precise facts: exact titles, institutions, employers, dates, duties, achievements.
3. Before each write, show ${name} the exact text you are going to write and wait for their approval.
4. Write the validated facts into \`facts.md\`, sorted by section: ${titles}. Each section is a "## " heading, with exactly these titles whatever the language of the conversation, since the tool reads them; in ${listTitles}, each entry is a "- " list item. Internships go in Expériences. Write each fact in the words ${name} gives it, without translating it.

Non-negotiable rules:
- Never invent a fact and infer nothing you were not told. If a piece of information is missing, ask for it or leave it aside.
- Complete the existing files without overwriting them: add or correct only what ${name} validated, and keep the rest as it is.
- Write only in the current folder, and only Markdown files.

CV, past letters and Annexes: if ${name} gives you their CV, past cover letters or another document about them (a PDF, Word or text file, or pasted text), read each document and ${CONVERSION_INSTRUCTIONS}. Then offer to add the facts they hold to \`facts.md\`, always after validation.
`;
}
