# Job Finder

Job Posting watch and Application preparation: spot the Postings that match a Candidate, then produce for each one what it takes to apply and to prepare the Interview.

Each entry keeps its former French term on a `_Formerly_:` line, so that older issues, commits and PRs stay readable.

## Candidates

**Candidate**:
Person looking for a job with the tool; each Posting belongs to a single Candidate.
_Avoid_: user, account
_Formerly_: Candidat

**Locale**:
Language a Candidate reads the tool in, French or English, French unless they chose otherwise; it never changes the language an Artifact is written in, which is that of the Job Description.
_Avoid_: language setting, i18n, translation

**Locale Switcher**:
Control of the front's top bar that sets the Locale: that of the chosen Candidate, or, before one is chosen, the one this browser remembers.
_Avoid_: language button, language picker

**Profile**:
What the tool knows about a Candidate in order to write on their behalf: their CV, the Facts they validated, their past letters and their Annexes.
_Avoid_: file, record, CV
_Formerly_: Profil

**Annex**:
Document of the Profile beyond the CV, the Facts and the past letters, such as a recommendation letter, a transcript or a thesis; it comes from an Upload or is written by the Candidate, and a Custom Artifact can be made into one to reuse it for other Postings.
_Avoid_: attachment, appendix, supporting document

**Facts**:
Part of the Profile that lists, by section, what the Candidate validated about themselves: identity, contact details, degrees, experience, skills, motivations, mobility.
_Avoid_: details, information, sheet
_Formerly_: Faits

**Section**:
Part of the Facts under one heading, such as the degrees or the mobility of the Candidate.
_Avoid_: heading, category, field
_Formerly_: Rubrique

**Upload**:
Original document, such as a CV, a past letter or an Annex as a PDF, that the Candidate drops into their Profile; it is kept as is, and the Profile holds its Markdown conversion.
_Avoid_: attachment, file, source file
_Formerly_: Pièce

**Notification Channel**:
Way the tool alerts a Candidate, such as their Home Assistant sending the notification to their phone; each Candidate picks theirs and sets its Parameters.
_Avoid_: Home Assistant connection, integration, provider
_Formerly_: Canal de notification

**Parameter**:
Value a Notification Channel or a Source needs to work, such as the address and token of a Home Assistant, or the searched title of a Watch; each declares its own, required or optional, and a secret Parameter is never read back.
_Avoid_: setting, option, config
_Formerly_: Paramètre

**Watch**:
Standing search of a Candidate on a Source, defined by the Parameters that Source asks for.
_Avoid_: alert, subscription, saved search
_Formerly_: Veille

**Error Code**:
Name of one kind of failure, which always comes with a message in the Candidate's Locale saying what to do; a failed job keeps its Error Code.
_Avoid_: error type, error number, status code

## Postings

**Posting**:
Job ad published by an employer, identified by its reference in its Source; it is the unit the tool tracks.
_Avoid_: offer, ad, listing, job
_Formerly_: Offre

**Job Description**:
Descriptive content of a Posting (duties, profile sought, conditions, contacts), kept as published.
_Avoid_: description, posting
_Formerly_: Fiche de poste

**Position**:
The actual job behind a Posting; the same Position can be published as several successive Postings.
_Avoid_: posting, role
_Formerly_: Poste

**Repost**:
Posting that announces again a Position already published under another reference.
_Avoid_: duplicate, update, republication
_Formerly_: Republication

**Source**:
Origin of Postings: a job site queried automatically, or a Job Description imported by hand.
_Avoid_: feed, provider, site
_Formerly_: Source

**Detection**:
Run that queries the Source of each Watch, or only those of one Candidate when started from their page, and records the Postings never seen before; one runs at a time, and the last one's verdict stays shown until the next.
_Avoid_: scan, crawl, alert
_Formerly_: Détection

**Near Miss**:
Title a Watch's Source lists that comes close to its searched title without matching it; it is not kept, only shown so the Candidate can widen the Watch.
_Avoid_: rejected title, discarded posting
_Formerly_: Titre écarté de peu

**Detection Summary**:
The one notification a Candidate receives after a Detection that found Postings to notify: when it was started, which Watches it covered, what it found and its Near Misses.
_Avoid_: digest, report, recap

**City**:
Municipality of a Posting's place of work, which puts it on the map.
_Avoid_: town, locality, place
_Formerly_: Ville

**Region**:
Administrative region of a Posting's City, by which the Candidate filters their Postings.
_Avoid_: zone, territory
_Formerly_: Région

**Deadline**:
Last day to apply to a Posting; when the Posting gives none, its publication date plus the Default Deadline Period, an imported Job Description being published on the day of its import.
_Avoid_: end date, due date, closing date
_Formerly_: Date limite

**Start Date**:
Day the Position of a Posting is to be filled, as its Job Description gives it; a Posting whose Job Description says nothing has none.
_Avoid_: hiring date, availability, start

**Default Deadline Period**:
Number of months, shared by all Candidates, that gives its Deadline to a Posting published without one.
_Avoid_: validity period, setting
_Formerly_: Délai par défaut

## Status of a Posting

**Status**:
Where a Posting stands in its Application: New, To Apply, Applied, Invited, Interviewed, Hired or Rejected.
_Avoid_: state, stage
_Formerly_: Statut

**New**:
Status of a detected Posting the Candidate has not sorted yet: keeping it puts it To Apply and starts its Research, dismissing it archives it; an imported Job Description skips it and starts To Apply.
_Avoid_: unread, inbox, to review, detected

**Step**:
Status as it stands now: Invited or Interviewed for an Applied Application, from its Interviews, otherwise the Status the Candidate set.
_Avoid_: stage, computed status
_Formerly_: Étape

**To Apply**:
Status of a Posting the Candidate decided to pursue and has not applied to yet.
_Avoid_: pending, to process
_Formerly_: À traiter

**Applied**:
Status of a Posting whose Candidate sent their application and is waiting for its outcome; only the Candidate says so, a Letter written not being a Letter sent. Its Application starts there, and its Letter no longer changes, unless the Candidate puts it back To Apply because they never sent it, which no outcome nor Interview allows anymore.
_Avoid_: sent, submitted
_Formerly_: Postulée

**Application**:
Recruitment process of a Posting, from sending the application to its outcome; a Posting has an Application as soon as it was Applied, even if Archived later.
_Avoid_: process, follow-up, candidacy
_Formerly_: Candidature

**Invited**:
Said of an Application with no outcome that has an upcoming Interview.
_Avoid_: interview scheduled, summoned
_Formerly_: Convoquée

**Interview**:
Appointment the employer sets with the Candidate for an Application, with its start, duration and place; an Application can have several, one per round.
_Avoid_: meeting, appointment, round
_Formerly_: Entretien

**Interviewers**:
People the Candidate meets at an Interview, described by the Candidate in free text (name, role, anything they know).
_Avoid_: panel, recruiters, contacts
_Formerly_: Interlocuteurs

**Interviewed**:
Said of an Application with no outcome whose Interviews have all taken place.
_Avoid_: pending, awaiting result
_Formerly_: Entretien passé

**Hired**:
Outcome of an Application where the Candidate gets the job.
_Avoid_: accepted, won, offer
_Formerly_: Obtenue

**Rejected**:
Outcome of an Application where the employer did not pick the Candidate.
_Avoid_: refused, declined, failed
_Formerly_: Refusée

**In progress**:
Said of an Application with no outcome yet, whether Applied, Invited or Interviewed; putting a Hired or Rejected Application back In progress removes its outcome.
_Avoid_: open, active, ongoing
_Formerly_: En cours

**Archived**:
Said of a Posting the Candidate decided to stop following, whatever its Status, which it keeps; unarchiving it restores it as it was.
_Avoid_: deleted, ignored, hidden
_Formerly_: Archivée

**Unpublished**:
Said of a Posting its Source no longer publishes, whatever its Status, as the last Detection found it; a Posting the Source puts back online is no longer Unpublished.
_Avoid_: removed, withdrawn, offline, deleted

**Expired**:
Said of a Posting whose Deadline has passed, whatever its Status.
_Avoid_: closed, outdated
_Formerly_: Expirée

**Notes**:
Free text the Candidate keeps on a Posting, whatever its Status, and rewrites at will.
_Avoid_: log, comments, journal
_Formerly_: Notes

## Artifacts

**Artifact**:
Document produced by the AI or brought by the Candidate for a Posting, or for one of its Interviews, and attached to it: Research, Letter, Portrait, Interview Brief, Custom Artifact.
_Avoid_: deliverable, output, file
_Formerly_: Artefact

**Version**:
One copy of an Artifact, produced each time its generation is run again or the Candidate brings their own; a human correction changes the Version without creating a new one.
_Avoid_: revision, iteration
_Formerly_: Version

**Chosen Version**:
The Version of an Artifact the Candidate validated last; it stays chosen while a newer Version is still a Draft, the following Artifacts build on it and, for the Letter, it is the one that is sent.
_Avoid_: current version, active version, selected version
_Formerly_: Version retenue

**Draft**:
Version the Candidate has not validated yet, whether the AI produced it or the Candidate brought it; no other Artifact reads it.
_Avoid_: first version, rough copy, pending version
_Formerly_: Brouillon

**Validated**:
Said of a Version the Candidate read and approved, which makes it the Chosen Version; correcting it afterwards keeps it Validated.
_Avoid_: approved, accepted, final

**Original**:
Text of a Version as the AI produced it, kept so the Candidate can compare their corrections with it; a Version the Candidate brought has none.
_Avoid_: draft, AI version, initial text
**Instructions**:
Directions that tell the AI how to produce a type of Artifact; each type has default Instructions in each Locale, which a Candidate reads in theirs and can replace with their own. Whatever their language, the Artifact is written in the language of the Job Description.
_Avoid_: prompt, template, guidelines
_Formerly_: Consignes

**Prompt**:
Everything an AI session producing an Artifact receives: its Fixed Part, the Inputs of the run, then the Instructions in effect.
_Avoid_: instructions, template

**Fixed Part**:
The part of a Prompt that comes with the type of Artifact and that no Instructions can lift: its objective, the files it reads and writes, its rules.
_Avoid_: system prompt, base prompt

**Research**:
Artifact that establishes, with sources, what the recruiters expect for a Posting and in which context (employer, department, place).
_Avoid_: analysis, study, report
_Formerly_: Recherche

**Letter**:
Cover letter of a Posting, written by the AI or brought by the Candidate; its Chosen Version is the one that is sent.
_Avoid_: final letter, cover letter, CL
_Formerly_: Lettre

**Portrait**:
Artifact of an Interview that establishes, with sources, what is publicly known about the career and professional positions of its Interviewers.
_Avoid_: research, profile, bio
_Formerly_: Portrait

**Interview Brief**:
Artifact that prepares a given Interview by crossing the Posting and its Interviewers: what to tell them, what to review and how to practice.
_Avoid_: review sheet, cheat sheet, study notes
_Formerly_: Fiche d'entretien

**Custom Artifact**:
Artifact the Candidate writes or drops for one Posting, or one of its Interviews, so a run can read it: a text of their own or a file; it is Validated from the start and has a single Version.
_Avoid_: note, attachment, extra input

**Input**:
What a run producing an Artifact reads: the Job Description, the Chosen Version of another Artifact of the Posting, Custom Artifacts included, or a document of the Profile; each type of Artifact checks some by default and requires some, which cannot be unchecked, the Candidate adds the others, and each Version keeps the Inputs it was produced from. An Artifact that reads the Profile requires the CV and the Facts, checks each past letter, and leaves the Annexes to add.
_Avoid_: source, context, data
