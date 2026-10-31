import type { Artifact } from '#/domain/index.ts';

// The default Instructions of each Artifact, which the Candidate sees, edits and may replace entirely
// with their own (candidates/<id>/instructions/<artifact>.md); the fixed part of the prompt stays, and
// sets the language of the Artifact (ADR-0003). The plan of the Interview Brief is here, not in the
// fixed part, so that the Candidate's own Instructions may organize it otherwise.
export const DEFAULT_INSTRUCTIONS_EN = {
  research: `Start from the Job Description and ask yourself what the recruiters of this department really expect from the person they will hire: the concrete duties, the qualities that will make the difference, what sets a good application apart. Look for the context that sheds light on it, where it matters for this Posting, for example the department, the court, the city or the news. Judge for yourself what deserves digging into, and what does not.

Begin with a summary of a few lines: what the recruiters expect, and why. Then develop the context, sticking to the essentials. Prefer precise, dated facts to generalities, and say clearly what you could not establish.
`,
  letter: `Write a one-page cover letter, sober and precise, in the register of the administration it is addressed to.

Open on this specific position and on what draws the Candidate to this department and this place. Then set their background against what the recruiters expect, as the Research establishes it: two or three strengths, each backed by a fact from their Profile. End with their availability for an interview. Keep the voice and style of their past letters, and carry over the corrections they made to the Letters they already sent. Avoid empty phrases and superlatives.
`,
  portrait: `Portray each Interviewer the Candidate will face at this Interview, so that they understand who they are speaking to and adapt their pitch.

Keep to professional and public information: career and positions held, publications, talks, positions taken on the profession. Write nothing about their private life.

Cite your sources: a Markdown link to the page that establishes each piece of information. When you are not sure a page is about the right person, for example in case of a namesake, say so plainly and explain why, rather than ruling either way.

Judge for yourself how deep to go, and stick to the essentials useful for this Interview: what the Interviewer is likely to look at, and the subjects on which the Candidate can connect with them.
`,
  interview_brief: `Prepare the Candidate for this Interview of this specific Posting, not for an interview in general. They will reread the Interview Brief the day before and practice out loud with it: prefer short lists and precise facts to long paragraphs.

Adapt the pitch to the Interviewers: a first round with human resources, a manager of the department or a specialist of the profession do not expect the same answers. Put first what they will look at, in the words of their own job, and build on the previous rounds and the Notes rather than repeating them.

Organize the Interview Brief to revise, then to practice, under these level 2 sections, with these exact titles:

## To revise

What is most likely to come up: the duties of the position, the department and the employer, the figures and news that the Research establishes, and the vocabulary of the profession.

## Memory aids

An acronym, an image or a short sentence for each block to remember, saying what each one recalls.

## Introduce yourself

An answer of about two minutes, in the first person, linking the Candidate's background to what the recruiters expect for this position, ready to be spoken. Keep their voice, as their letters show it.

## Likely questions

About ten questions, from the most expected (motivation, knowledge of the position, role-play scenarios) to the most specialized, including those their Letter invites. For each, what the recruiters want to find out and points for an answer backed by a fact from their Profile. End with two or three questions the Candidate can ask the recruiters.
`,
  visualization: `The Candidate revises with this page the day before the interview, often on their phone: it must read at a glance and be browsed without effort.

Follow the plan of the Interview Brief, one section per part, with a table of contents at the top. Put in a table what compares or lists: the duties, the figures, the actors and their role. Draw a diagram when it sheds light on an organization or a sequence: the department's organization chart, the course of a procedure. Give each memory aid a block that stands out, with what it recalls. Present the likely questions as cards, the question prominent and its points for an answer below.

A sober layout: a single narrow column on a phone, clear headings, colors to tell the parts apart and not to decorate. The page must also print cleanly.
`,
} satisfies Record<Artifact, string>;
