// PROTOTYPE (branch prototype/v1-ux, never merged). The view models every screen reads, shared by
// data.server.ts (which builds them from the snapshot), store.ts (which overlays the stubbed
// mutations) and the screens. Dates are ISO strings; copy is French, hard-coded (DECISIONS.md).

export type PostingStatus = 'new' | 'to_apply' | 'applied' | 'hired' | 'rejected';
// The Status as it stands now: Applied shows as Invited or Interviewed from its Interviews
export type Step = PostingStatus | 'invited' | 'interviewed';
export type ArtifactType = 'research' | 'letter' | 'portrait' | 'interview_brief' | 'custom';
export type GeneratedArtifactType = Exclude<ArtifactType, 'custom'>;
export type VersionState = 'draft' | 'validated';
// What a list shows of an Artifact: none yet, its latest Version a Draft to validate, or validated
export type ArtifactState = 'none' | 'draft' | 'validated';
// The three lists of the Sidebar
export type ListName = 'new' | 'to_apply' | 'applications';

export interface ICandidate {
  id: string;
  name: string;
}

export interface IInterview {
  number: number;
  startAt: string;
  durationMinutes: number;
  place: string;
  interviewers: string;
}

export interface IRepost {
  // The Posting it publishes again, and those that publish it again, by reference
  repostOf: string | null;
  repostList: string[];
  // 1 for the first publication of its Position, 2 for its first Repost…
  publicationNumber: number;
  // Publication date of the first Posting of the Position
  firstPublishedAt: string | null;
  // The Candidate applied to an earlier Posting of the same Position: « Tu as postulé le … · <outcome> »
  earlierApplication: { reference: string; appliedAt: string; step: Step } | null;
}

export interface IContacts {
  applicationEmail: string | null;
  contact1: string | null;
  contact2: string | null;
  workplace: string | null;
}

export interface IArtifactSummary {
  state: ArtifactState;
  latestNumber: number | null;
  chosenNumber: number | null;
}

export interface IPosting {
  reference: string;
  title: string;
  employer: string | null;
  // Its page on the Source, null for an imported Job Description
  url: string | null;
  source: string;
  city: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  status: PostingStatus;
  step: Step;
  publishedAt: string | null;
  deadline: string | null;
  // From « Date de vacance de l'emploi » in the Job Description, null when it says nothing
  startDate: string | null;
  appliedAt: string | null;
  archivedAt: string | null;
  unpublishedAt: string | null;
  isExpired: boolean;
  repost: IRepost;
  contacts: IContacts;
  jobDescription: string;
  notes: string;
  interviews: IInterview[];
  // The two Artifacts a list shows; the Interview ones live in the detail
  research: IArtifactSummary;
  letter: IArtifactSummary;
  // Found by a simulated Detection: it has no folder in the snapshot
  isSynthetic: boolean;
}

// What a Version was produced from, for « Produite à partir de : … »
export interface IInputRef {
  key: string;
  label: string;
}

export interface IVersion {
  number: number;
  state: VersionState;
  isChosen: boolean;
  // Produced by the AI, or brought by the Candidate (then it has no Original)
  origin: 'ai' | 'candidate';
  createdAt: string;
  fileName: string;
  // The text the Candidate reads and corrects; MDX, except for the Letter, plain Markdown
  text: string;
  // The text as the AI produced it, null for a Version the Candidate brought
  original: string | null;
  inputs: IInputRef[];
  instructions: string;
}

export interface IArtifact {
  // Unique on its Posting: 'research', 'letter', 'portrait@1', 'interview_brief@1', 'custom:<id>'
  key: string;
  type: ArtifactType;
  // « Recherche », « Lettre »…, or the title of a Custom Artifact
  label: string;
  interviewNumber: number | null;
  format: 'mdx' | 'markdown';
  // Ascending by number
  versions: IVersion[];
  chosenNumber: number | null;
  // Why the real module refuses to run it now (the Letter frozen once Applied…), null when it can run
  refusal: string | null;
  // The Fixed Part of its Prompt; isExample when the real module refused to compose it for this Posting
  // and it comes from another Posting (its paths and reference are then that Posting's)
  fixedPart: string | null;
  // The same with each value the tool substituted between sentinels (generation/fixed-part.ts)
  fixedPartMarked?: string | null;
  isFixedPartExample: boolean;
}

export interface IDocument {
  key: string;
  label: string;
  fileName: string;
  text: string;
}

export interface IPostingDetail {
  reference: string;
  // Posting-level and Interview-level Artifacts, Custom ones included
  artifacts: IArtifact[];
  // Recommended by the Chosen Letter
  recipients: { to: string | null; ccList: string[]; salutation: string | null } | null;
  // The Chosen Letters of the Candidate's other Applied Postings: what the Letter reads as sent
  sentLetters: IDocument[];
}

export interface IProfileDocument extends IDocument {
  kind: 'cv' | 'facts' | 'letter' | 'annex';
}

export interface IWatch {
  id: string;
  source: string;
  label: string;
  // Near Misses of the last Detection, shown under the Watch
  nearMisses: { reference: string; title: string }[];
  lastDetectedAt: string | null;
}

export interface IInstructions {
  type: GeneratedArtifactType;
  defaultText: string;
  // The Candidate's own, which replace the default ones; null while they keep the default
  candidateText: string | null;
}

// What a type of Artifact reads, from its real AI module declaration (src/artifact/registry.ts)
export interface IInputRule {
  requiredList: GeneratedArtifactType[];
  optionalList: GeneratedArtifactType[];
  previousInterviewList: GeneratedArtifactType[];
  isReadingNotes: boolean;
  isReadingProfile: boolean;
  isReadingSentVersions: boolean;
  isAttachedToInterview: boolean;
}

export interface IPrototypeData {
  candidate: ICandidate;
  candidateList: ICandidate[];
  postings: IPosting[];
  watches: IWatch[];
  profileDocuments: IProfileDocument[];
  instructions: IInstructions[];
  inputRules: Record<GeneratedArtifactType, IInputRule>;
}

// ——— Labels (French copy, hard-coded in the prototype) ———

export const STEP_LABEL: Record<Step, string> = {
  new: 'Nouvelle',
  to_apply: 'À traiter',
  applied: 'Postulée',
  invited: 'Convoquée',
  interviewed: 'Entretien passé',
  hired: 'Poste obtenu',
  rejected: 'Refusée',
};

export const ARTIFACT_LABEL: Record<ArtifactType, string> = {
  research: 'Recherche',
  letter: 'Lettre de motivation',
  portrait: 'Portrait',
  interview_brief: 'Fiche d’entretien',
  custom: 'Document',
};

export const VERSION_STATE_LABEL: Record<VersionState, string> = { draft: 'Brouillon', validated: 'Validée' };

export const ARTIFACT_STATE_LABEL: Record<ArtifactState, string> = {
  none: 'Pas encore',
  draft: 'Brouillon',
  validated: 'Validée',
};

export const LIST_LABEL: Record<ListName, string> = {
  new: 'Nouvelles',
  to_apply: 'À traiter',
  applications: 'Candidatures',
};

// ——— Rules ———

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

export function interviewEnd({ startAt, durationMinutes }: Pick<IInterview, 'startAt' | 'durationMinutes'>): Date {
  return new Date(new Date(startAt).getTime() + durationMinutes * MINUTE_MS);
}

// As src/status: an outcome wins over the Interviews; Invited while one is to come, else Interviewed
export function stepOf(status: PostingStatus, interviews: IInterview[], now: Date = new Date()): Step {
  if (status !== 'applied' || interviews.length === 0) {
    return status;
  }
  return interviews.every((interview) => interviewEnd(interview).getTime() <= now.getTime())
    ? 'interviewed'
    : 'invited';
}

export function listOf({ status }: Pick<IPosting, 'status'>): ListName {
  if (status === 'new' || status === 'to_apply') {
    return status;
  }
  return 'applications';
}

// The Applications tabs
export function applicationTabOf({ status }: Pick<IPosting, 'status'>): 'in_progress' | 'hired' | 'rejected' {
  return status === 'hired' || status === 'rejected' ? status : 'in_progress';
}

// The next Interview, else the last one once none is to come
export function nextInterviewOf(interviews: IInterview[], now: Date = new Date()): IInterview | null {
  const sorted = interviews.toSorted((first, second) => first.startAt.localeCompare(second.startAt));
  return sorted.find((interview) => interviewEnd(interview) > now) ?? sorted.at(-1) ?? null;
}

// Whole days from today to the day, in Paris time: 0 today, negative once past
export function daysUntil(iso: string, now: Date = new Date()): number {
  const day = (date: Date) => Date.parse(PARIS_DAY.format(date));
  return Math.round((day(new Date(iso)) - day(now)) / DAY_MS);
}

export function artifactKeyOf(type: GeneratedArtifactType, interviewNumber: number | null): string {
  return interviewNumber === null ? type : `${type}@${String(interviewNumber)}`;
}

export function chosenVersionOf(artifact: IArtifact): IVersion | undefined {
  return artifact.versions.find(({ isChosen }) => isChosen);
}

export function latestVersionOf(artifact: IArtifact): IVersion | undefined {
  return artifact.versions.at(-1);
}

export function summaryOf(artifact: IArtifact | undefined): IArtifactSummary {
  const latest = artifact === undefined ? undefined : latestVersionOf(artifact);
  if (artifact === undefined || latest === undefined) {
    return { state: 'none', latestNumber: null, chosenNumber: null };
  }
  return {
    state: latest.isChosen ? 'validated' : 'draft',
    latestNumber: latest.number,
    chosenNumber: artifact.chosenNumber,
  };
}

// ——— Formatting (Paris time, French, the same on the server and in the browser) ———

const PARIS_DAY = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris' });
const DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeZone: 'Europe/Paris' });
const DATE_TIME_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Paris',
});

// « 20 nov. 2026 », or « — » without a date
export function formatDate(iso: string | null): string {
  return iso === null ? '—' : DATE_FORMAT.format(new Date(iso));
}

export function formatDateTime(iso: string | null): string {
  return iso === null ? '—' : DATE_TIME_FORMAT.format(new Date(iso));
}

// « aujourd’hui », « dans 3 j », « il y a 2 j »
export function formatCountdown(iso: string | null, now: Date = new Date()): string {
  if (iso === null) {
    return '—';
  }
  const days = daysUntil(iso, now);
  if (days === 0) {
    return 'aujourd’hui';
  }
  return days > 0 ? `dans ${String(days)} j` : `il y a ${String(-days)} j`;
}

// ——— Inputs of a run (the generation panel) ———

export type InputMode = 'required' | 'default' | 'optional';

export interface IInputSpec {
  key: string;
  kind: 'job_description' | 'artifact' | 'notes' | 'profile' | 'sent_letter' | 'custom';
  label: string;
  // required: locked, checked; default: checked, can be unchecked; optional: unchecked, added on demand
  mode: InputMode;
  // Why it is required, for its tooltip
  reason: string | null;
  // A required Artifact with no Chosen Version yet: the run is refused until it has one
  isAvailable: boolean;
  // Its exact content, for the preview
  content: string;
}

export interface IInputContext {
  posting: IPosting;
  detail: IPostingDetail;
  rules: Record<GeneratedArtifactType, IInputRule>;
  profileDocuments: IProfileDocument[];
}

function findArtifact(detail: IPostingDetail, key: string): IArtifact | undefined {
  return detail.artifacts.find((artifact) => artifact.key === key);
}

function artifactInput(
  detail: IPostingDetail,
  type: GeneratedArtifactType,
  interviewNumber: number | null,
  mode: InputMode,
  reason: string | null,
): IInputSpec | null {
  const key = artifactKeyOf(type, interviewNumber);
  const artifact = findArtifact(detail, key);
  const chosen = artifact === undefined ? undefined : chosenVersionOf(artifact);
  if (chosen === undefined && mode !== 'required') {
    return null;
  }
  const interviewLabel = interviewNumber === null ? '' : ` · Entretien ${String(interviewNumber)}`;
  return {
    key: `artifact:${key}`,
    kind: 'artifact',
    label: `${ARTIFACT_LABEL[type]}${interviewLabel}${chosen === undefined ? '' : ` · v${String(chosen.number)}`}`,
    mode,
    reason,
    isAvailable: chosen !== undefined,
    content: chosen?.text ?? '',
  };
}

// What a run of the Artifact would read, as the real module declares it: the Job Description, the
// Artifacts it requires (locked) or also reads (checked), the Notes, the Custom Artifacts, the
// Profile (CV and Facts locked, past letters checked, Annexes to add) and the Letters already sent
export function listInputs(artifactKey: string, context: IInputContext): IInputSpec[] {
  const [rawType, rawNumber] = artifactKey.split('@');
  const type = rawType as GeneratedArtifactType;
  const rule = context.rules[type];
  const interviewNumber = rawNumber === undefined ? null : Number(rawNumber);
  const { posting, detail } = context;
  const label = ARTIFACT_LABEL[type];
  const inputList: (IInputSpec | null)[] = [
    {
      key: 'job_description',
      kind: 'job_description',
      label: 'Fiche de poste',
      mode: 'required',
      reason: 'Toute génération part de la Fiche de poste de l’Offre.',
      isAvailable: true,
      content: posting.jobDescription,
    },
  ];
  const placeOf = (other: GeneratedArtifactType) =>
    context.rules[other].isAttachedToInterview ? interviewNumber : null;
  for (const required of rule.requiredList) {
    inputList.push(
      artifactInput(
        detail,
        required,
        placeOf(required),
        'required',
        `La ${label} a besoin de la ${ARTIFACT_LABEL[required]} validée.`,
      ),
    );
  }
  for (const optional of rule.optionalList) {
    inputList.push(artifactInput(detail, optional, placeOf(optional), 'default', null));
  }
  for (const previous of rule.previousInterviewList) {
    for (const interview of posting.interviews.filter(({ number }) => number < (interviewNumber ?? 0))) {
      inputList.push(artifactInput(detail, previous, interview.number, 'default', null));
    }
  }
  if (rule.isReadingNotes && posting.notes.trim() !== '') {
    inputList.push({
      key: 'notes',
      kind: 'notes',
      label: 'Notes',
      mode: 'default',
      reason: null,
      isAvailable: true,
      content: posting.notes,
    });
  }
  for (const custom of detail.artifacts.filter(({ type: customType }) => customType === 'custom')) {
    const chosen = chosenVersionOf(custom);
    if (chosen !== undefined && (custom.interviewNumber === null || custom.interviewNumber === interviewNumber)) {
      inputList.push({
        key: `artifact:${custom.key}`,
        kind: 'custom',
        label: custom.label,
        mode: 'default',
        reason: null,
        isAvailable: true,
        content: chosen.text,
      });
    }
  }
  if (rule.isReadingProfile) {
    for (const document of context.profileDocuments) {
      const isCore = document.kind === 'cv' || document.kind === 'facts';
      inputList.push({
        key: `profile:${document.fileName}`,
        kind: 'profile',
        label: document.label,
        mode: isCore ? 'required' : document.kind === 'letter' ? 'default' : 'optional',
        reason: isCore ? 'Un Artifact qui lit le Profil exige le CV et les Faits.' : null,
        isAvailable: true,
        content: document.text,
      });
    }
  }
  if (rule.isReadingSentVersions) {
    for (const letter of detail.sentLetters) {
      inputList.push({
        key: `sent:${letter.key}`,
        kind: 'sent_letter',
        label: letter.label,
        mode: 'default',
        reason: null,
        isAvailable: true,
        content: letter.text,
      });
    }
  }
  return inputList.filter((input) => input !== null);
}
