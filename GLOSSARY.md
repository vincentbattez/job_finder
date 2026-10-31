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
What the tool knows about a Candidate in order to write on their behalf: their CV, the Facts they validated and their past letters.
_Avoid_: file, record, CV
_Formerly_: Profil

**Facts**:
Part of the Profile that lists, by section, what the Candidate validated about themselves: identity, contact details, degrees, experience, skills, motivations, mobility.
_Avoid_: details, information, sheet
_Formerly_: Faits

**Section**:
Part of the Facts under one heading, such as the degrees or the mobility of the Candidate.
_Avoid_: heading, category, field
_Formerly_: Rubrique

**Upload**:
Original document, such as a CV or a past letter as a PDF, that the Candidate drops into their Profile; it is kept as is, and the Profile holds its Markdown conversion.
_Avoid_: attachment, file, source file
_Formerly_: Pièce

**Notification Channel**:
Way the tool alerts a Candidate, such as their Home Assistant sending the notification to their phone; each Candidate picks theirs and sets its Parameters.
_Avoid_: Home Assistant connection, integration, provider
_Formerly_: Canal de notification

**Parameter**:
Value a Notification Channel or a Source needs to work, such as the address and token of a Home Assistant, or the searched title and the Zone of a Watch; each declares its own, required or optional, and a secret Parameter is never read back.
_Avoid_: setting, option, config
_Formerly_: Paramètre

**Watch**:
Standing search of a Candidate on a Source, defined by the Parameters that Source asks for, its Zone included.
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

**Zone**:
Territory of a Watch where a detected Posting automatically starts its Research; each Source expresses it its own way, and a Posting outside the Zone is kept but not processed.
_Avoid_: perimeter, area
_Formerly_: Zone

**City**:
Municipality of a Posting's place of work, which puts it on the map.
_Avoid_: town, locality, place
_Formerly_: Ville

**Region**:
Administrative region of a Posting's City, by which the Candidate filters their Postings; it has nothing to do with the Zone.
_Avoid_: zone, territory
_Formerly_: Région

**Deadline**:
Last day to apply to a Posting; when the Posting gives none, its publication date plus the Default Deadline Period, an imported Job Description being published on the day of its import.
_Avoid_: end date, due date, closing date
_Formerly_: Date limite

**Default Deadline Period**:
Number of months, shared by all Candidates, that gives its Deadline to a Posting published without one.
_Avoid_: validity period, setting
_Formerly_: Délai par défaut

## Status of a Posting

**Status**:
Where a Posting stands in its Application: To Apply, Applied, Invited, Interviewed, Hired or Rejected.
_Avoid_: state, stage
_Formerly_: Statut

**Step**:
Status as it stands now: Invited or Interviewed for an Applied Application, from its Interviews, otherwise the Status the Candidate set.
_Avoid_: stage, computed status
_Formerly_: Étape

**To Apply**:
Status of a Posting the Candidate has not applied to yet.
_Avoid_: new, pending, to process
_Formerly_: À traiter

**Applied**:
Status of a Posting whose Candidate sent their application and is waiting for its outcome; its Application starts there, and its Letter never changes afterwards.
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
Document produced for a Posting, or for one of its Interviews, and attached to it: Research, Draft, Letter, Portrait, Interview Brief, Visualization.
_Avoid_: deliverable, output, file
_Formerly_: Artefact

**Version**:
One copy of an Artifact, produced each time its generation is run again; a human correction changes the Version without creating a new one.
_Avoid_: revision, iteration
_Formerly_: Version

**Chosen Version**:
The Version of an Artifact the Candidate picked; the following Artifacts build on it and, for the Letter, it is the one that is sent.
_Avoid_: current version, active version, selected version
_Formerly_: Version retenue

**Instructions**:
Directions that tell the AI how to produce a type of Artifact; each type has default Instructions in each Locale, which a Candidate reads in theirs and can replace with their own. Whatever their language, the Artifact is written in the language of the Job Description.
_Avoid_: prompt, template, guidelines
_Formerly_: Consignes

**Prompt**:
Everything an AI session producing an Artifact receives: its Fixed Part, then the Instructions in effect.
_Avoid_: instructions, template

**Fixed Part**:
The part of a Prompt that comes with the type of Artifact and that no Instructions can lift: its objective, the files it reads and writes, its rules.
_Avoid_: system prompt, base prompt

**Research**:
Artifact that establishes, with sources, what the recruiters expect for a Posting and in which context (employer, department, place).
_Avoid_: analysis, study, report
_Formerly_: Recherche

**Draft**:
Cover letter written by the AI for a Posting; it is never changed afterwards.
_Avoid_: first version, rough copy
_Formerly_: Brouillon

**Letter**:
Cover letter corrected by the human from the Draft; it is the one that is sent.
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

**Visualization**:
HTML rendering of an Interview Brief, with the same content.
_Avoid_: rendering, HTML version
_Formerly_: Visualisation
