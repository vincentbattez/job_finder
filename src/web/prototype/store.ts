// PROTOTYPE (branch prototype/v1-ux, never merged). The in-memory stub store: it overlays the
// snapshot the loaders read (data.server.ts) with every mutation of the prototype. Nothing is ever
// written to the database; a reload forgets everything. Every mutation is async (a short fake latency,
// so buttons can show a pending state) and shows a Sonner toast.
//
// ——— API ———
// Provider (mounted once by layout.tsx): <PrototypeStoreProvider data={IPrototypeData}>
//
// Reads (hooks):
//   usePrototype()                 → { candidate, candidateList, postings, watches, profileDocuments,
//                                      instructions, inputRules, runs, detection, now, actions }
//   usePostings()                  → IPosting[] (overlay applied, Detection's synthetic ones first)
//   usePosting(reference)          → IPosting | undefined
//   usePostingDetail(reference, loaderDetail | null) → IPostingDetail | null (Versions overlaid)
//   useInputs(reference, artifactKey, detail) → IInputSpec[] (what a run would read, see model.ts)
//   useInstructions(type)          → { text, defaultText, isCandidate }: the Instructions in effect
//   useRuns(reference?)            → IRunView[] (simulated generations, with progress and phase)
//   useDetection()                 → IDetectionView | null (simulated Detection, one line per Watch)
//   useActions()                   → the mutations below
//
// Mutations (actions.*, each returns a Promise and toasts):
//   keep(reference)                       New → To Apply, and starts its Research (simulated run)
//   dismiss(reference)                    New → Archived (toast with « Annuler »)
//   setStatus(reference, status)          'to_apply' | 'applied' | 'hired' | 'rejected';
//                                         'applied' on a Hired/Rejected one is « Remettre en cours »
//   archive(reference) / unarchive(reference)
//   saveNotes(reference, notes)
//   saveInterview(reference, interview)   adds it without `number`, edits the one with that number
//   deleteInterview(reference, number)
//   validateVersion(reference, artifactKey, number)   makes it Validated and the Chosen Version
//   addVersion(reference, artifactKey, { text, origin, inputs?, instructions? })  → a new Draft
//   editVersion(reference, artifactKey, number, text) a correction: same Version, same state
//   saveInstructions(type, text | null)   the Candidate's own Instructions; null restores the default
//   addCustomArtifact({ reference, interviewNumber?, title, text, scope: 'posting' | 'profile' })
//                                         → the key of the new Input ('artifact:custom:…' or 'profile:…')
//   startGeneration({ reference, artifactKey, inputs, instructions? }) → run id; a Draft appears at the end
//   startDetection()                      one line per Watch, then 2 synthetic New Reposts on top
//   seed(reference, patch, artifacts?)    silent and synchronous (no toast, no latency): a screen's
//                                         demonstrable startup state, e.g. lists/seed.ts keeps a few
//                                         New Postings; a Posting already patched is left as it is
//
// Artifact keys: 'research', 'letter', 'portrait@<interview>', 'interview_brief@<interview>',
// 'custom:<id>' (see model.ts).
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';

import {
  ARTIFACT_LABEL,
  artifactKeyOf,
  formatDateTime,
  listInputs,
  STEP_LABEL,
  stepOf,
  type ArtifactType,
  type GeneratedArtifactType,
  type IArtifact,
  type IArtifactSummary,
  type IInputRef,
  type IInputSpec,
  type IInstructions,
  type IInterview,
  type IPosting,
  type IPostingDetail,
  type IProfileDocument,
  type IPrototypeData,
  type IVersion,
  type PostingStatus,
} from './model.ts';
import { SHOWCASE_REFERENCE, SHOWCASE_VERSION_LIST } from './posting/showcase.ts';

// ——— State ———

type NewVersion = Pick<IVersion, 'text' | 'origin'> &
  Partial<Pick<IVersion, 'inputs' | 'instructions' | 'original' | 'fileName'>>;

type ArtifactOp =
  | { kind: 'addVersion'; artifactKey: string; version: NewVersion; createdAt: string }
  | { kind: 'validate'; artifactKey: string; number: number }
  | { kind: 'edit'; artifactKey: string; number: number; text: string }
  | { kind: 'addArtifact'; artifact: IArtifact };

export interface IRun {
  id: string;
  reference: string;
  artifactKey: string;
  label: string;
  startedAt: number;
  durationMs: number;
  inputs: IInputRef[];
  instructions: string;
  status: 'running' | 'done';
  // The Draft it produced, once done
  versionNumber: number | null;
}

export interface IRunView extends IRun {
  // 0 to 1
  progress: number;
  phase: string;
}

type DetectionStep = 'waiting' | 'searching' | 'reading' | 'done';

interface IDetection {
  startedAt: number;
  finishedAt: number | null;
  watchList: { id: string; label: string; readTotal: number }[];
  foundReferenceList: string[];
}

export interface IDetectionView {
  startedAt: number;
  finishedAt: number | null;
  isRunning: boolean;
  watches: {
    id: string;
    label: string;
    step: DetectionStep;
    stepLabel: string;
    readCount: number;
    readTotal: number;
    foundReferences: string[];
  }[];
  foundReferences: string[];
}

// What a patch may carry beyond the Posting's own fields: the Reposts a simulated Detection found
interface IPostingPatch extends Partial<IPosting> {
  repostAdded?: string[];
}

interface ICandidateOverlay {
  patchByReference: Record<string, IPostingPatch>;
  // Found by a simulated Detection, newest first
  syntheticList: IPosting[];
  opsByReference: Record<string, ArtifactOp[]>;
  // A type absent keeps the loaded Instructions; null restores the default ones
  instructionsByType: Partial<Record<GeneratedArtifactType, string | null>>;
  annexList: IProfileDocument[];
  runList: IRun[];
  detection: IDetection | null;
}

interface IState {
  now: number;
  overlayByCandidate: Record<string, ICandidateOverlay>;
}

const EMPTY_OVERLAY: ICandidateOverlay = {
  patchByReference: {},
  syntheticList: [],
  opsByReference: {},
  instructionsByType: {},
  annexList: [],
  runList: [],
  detection: null,
};

type Action =
  | { type: 'tick'; now: number }
  | { type: 'init'; candidateId: string; overlay: ICandidateOverlay }
  | { type: 'patch'; candidateId: string; reference: string; patch: IPostingPatch }
  | { type: 'op'; candidateId: string; reference: string; op: ArtifactOp }
  | { type: 'instructions'; candidateId: string; artifactType: GeneratedArtifactType; text: string | null }
  | { type: 'annex'; candidateId: string; document: IProfileDocument }
  | { type: 'startRun'; candidateId: string; run: IRun }
  | { type: 'finishRun'; candidateId: string; id: string; versionNumber: number; op: ArtifactOp }
  | { type: 'startDetection'; candidateId: string; detection: IDetection }
  | { type: 'finishDetection'; candidateId: string; now: number; syntheticList: IPosting[] };

function updateOverlay(state: IState, candidateId: string, update: (overlay: ICandidateOverlay) => ICandidateOverlay) {
  return {
    ...state,
    overlayByCandidate: {
      ...state.overlayByCandidate,
      [candidateId]: update(state.overlayByCandidate[candidateId] ?? EMPTY_OVERLAY),
    },
  };
}

function reduce(state: IState, action: Action): IState {
  switch (action.type) {
    case 'tick': {
      return { ...state, now: action.now };
    }
    case 'init': {
      return state.overlayByCandidate[action.candidateId] === undefined
        ? updateOverlay(state, action.candidateId, () => action.overlay)
        : state;
    }
    case 'patch': {
      return updateOverlay(state, action.candidateId, (overlay) => ({
        ...overlay,
        patchByReference: {
          ...overlay.patchByReference,
          [action.reference]: { ...overlay.patchByReference[action.reference], ...action.patch },
        },
      }));
    }
    case 'op': {
      return updateOverlay(state, action.candidateId, (overlay) => ({
        ...overlay,
        opsByReference: {
          ...overlay.opsByReference,
          [action.reference]: [...(overlay.opsByReference[action.reference] ?? []), action.op],
        },
      }));
    }
    case 'instructions': {
      return updateOverlay(state, action.candidateId, (overlay) => ({
        ...overlay,
        instructionsByType: { ...overlay.instructionsByType, [action.artifactType]: action.text },
      }));
    }
    case 'annex': {
      return updateOverlay(state, action.candidateId, (overlay) => ({
        ...overlay,
        annexList: [...overlay.annexList, action.document],
      }));
    }
    case 'startRun': {
      return updateOverlay(state, action.candidateId, (overlay) => ({
        ...overlay,
        runList: [...overlay.runList, action.run],
      }));
    }
    case 'finishRun': {
      return updateOverlay(state, action.candidateId, (overlay) => {
        const run = overlay.runList.find(({ id }) => id === action.id);
        if (run === undefined || run.status === 'done') {
          return overlay;
        }
        return {
          ...overlay,
          runList: overlay.runList.map((other) =>
            other.id === action.id ? { ...other, status: 'done' as const, versionNumber: action.versionNumber } : other,
          ),
          opsByReference: {
            ...overlay.opsByReference,
            [run.reference]: [...(overlay.opsByReference[run.reference] ?? []), action.op],
          },
        };
      });
    }
    case 'startDetection': {
      return updateOverlay(state, action.candidateId, (overlay) => ({ ...overlay, detection: action.detection }));
    }
    case 'finishDetection': {
      return updateOverlay(state, action.candidateId, (overlay) => {
        if (overlay.detection === null || overlay.detection.finishedAt !== null) {
          return overlay;
        }
        const patchByReference = { ...overlay.patchByReference };
        for (const synthetic of action.syntheticList) {
          const original = synthetic.repost.repostOf;
          if (original !== null) {
            const patch = patchByReference[original];
            patchByReference[original] = {
              ...patch,
              repostAdded: [...(patch?.repostAdded ?? []), synthetic.reference],
            };
          }
        }
        return {
          ...overlay,
          patchByReference,
          syntheticList: [...action.syntheticList, ...overlay.syntheticList],
          detection: {
            ...overlay.detection,
            finishedAt: action.now,
            foundReferenceList: action.syntheticList.map(({ reference }) => reference),
          },
        };
      });
    }
  }
}

// ——— Applying the overlay ———

function typeOfKey(artifactKey: string): ArtifactType {
  if (artifactKey.startsWith('custom:')) {
    return 'custom';
  }
  return (artifactKey.split('@')[0] ?? 'research') as GeneratedArtifactType;
}

function interviewOfKey(artifactKey: string): number | null {
  const number = artifactKey.split('@')[1];
  return number === undefined ? null : Number(number);
}

function emptyArtifact(artifactKey: string): IArtifact {
  const type = typeOfKey(artifactKey);
  return {
    key: artifactKey,
    type,
    label: ARTIFACT_LABEL[type],
    interviewNumber: interviewOfKey(artifactKey),
    format: type === 'letter' ? 'markdown' : 'mdx',
    versions: [],
    chosenNumber: null,
    refusal: null,
    fixedPart: null,
    isFixedPartExample: false,
  };
}

function nextNumberOf(artifact: IArtifact): number {
  return Math.max(0, ...artifact.versions.map(({ number }) => number)) + 1;
}

function applyOp(artifactList: IArtifact[], op: ArtifactOp): IArtifact[] {
  if (op.kind === 'addArtifact') {
    return [...artifactList, op.artifact];
  }
  const hasArtifact = artifactList.some(({ key }) => key === op.artifactKey);
  const list = hasArtifact ? artifactList : [...artifactList, emptyArtifact(op.artifactKey)];
  return list.map((artifact) => {
    if (artifact.key !== op.artifactKey) {
      return artifact;
    }
    switch (op.kind) {
      case 'addVersion': {
        const version: IVersion = {
          number: nextNumberOf(artifact),
          state: 'draft',
          isChosen: false,
          origin: op.version.origin,
          createdAt: op.createdAt,
          fileName: op.version.fileName ?? artifact.versions.at(-1)?.fileName ?? `${artifact.type}.md`,
          text: op.version.text,
          original: op.version.original ?? (op.version.origin === 'ai' ? op.version.text : null),
          inputs: op.version.inputs ?? [],
          instructions: op.version.instructions ?? '',
        };
        return { ...artifact, versions: [...artifact.versions, version] };
      }
      case 'validate': {
        return {
          ...artifact,
          chosenNumber: op.number,
          versions: artifact.versions.map((version) => ({
            ...version,
            isChosen: version.number === op.number,
            state: version.number === op.number ? 'validated' : version.state,
          })),
        };
      }
      case 'edit': {
        return {
          ...artifact,
          versions: artifact.versions.map((version) =>
            version.number === op.number ? { ...version, text: op.text } : version,
          ),
        };
      }
    }
  });
}

function applySummary(summary: IArtifactSummary, artifactKey: string, opList: ArtifactOp[]): IArtifactSummary {
  let result = summary;
  for (const op of opList) {
    if (op.kind === 'addVersion' && op.artifactKey === artifactKey) {
      result = { ...result, state: 'draft', latestNumber: (result.latestNumber ?? 0) + 1 };
    }
    if (op.kind === 'validate' && op.artifactKey === artifactKey) {
      result = { ...result, chosenNumber: op.number, state: op.number === result.latestNumber ? 'validated' : 'draft' };
    }
  }
  return result;
}

function applyPosting(posting: IPosting, overlay: ICandidateOverlay, now: Date): IPosting {
  const { repostAdded = [], ...patch }: IPostingPatch = overlay.patchByReference[posting.reference] ?? {};
  const opList = overlay.opsByReference[posting.reference] ?? [];
  const merged = { ...posting, ...patch };
  return {
    ...merged,
    step: stepOf(merged.status, merged.interviews, now),
    repost: { ...merged.repost, repostList: [...merged.repost.repostList, ...repostAdded] },
    research: applySummary(merged.research, 'research', opList),
    letter: applySummary(merged.letter, 'letter', opList),
  };
}

// Why a run is refused now, from the overlaid state rather than the snapshot's: the real module's two
// rules, the Letter frozen once Applied and a required Artifact without a Chosen Version
function refusalOf(
  artifact: IArtifact,
  artifactList: IArtifact[],
  posting: IPosting | undefined,
  inputRules: IPrototypeData['inputRules'],
): string | null {
  if (artifact.type === 'custom') {
    return null;
  }
  if (
    artifact.type === 'letter' &&
    posting !== undefined &&
    (posting.appliedAt !== null || (posting.status !== 'to_apply' && posting.status !== 'new'))
  ) {
    return 'La Lettre est figée : l’Offre est déjà Postulée, la Lettre envoyée ne change plus.';
  }
  for (const required of inputRules[artifact.type].requiredList) {
    const key = artifactKeyOf(required, inputRules[required].isAttachedToInterview ? artifact.interviewNumber : null);
    if (artifactList.find((other) => other.key === key)?.chosenNumber == null) {
      return `Valide d’abord une Version de la ${ARTIFACT_LABEL[required]} : la ${ARTIFACT_LABEL[artifact.type]} s’appuie dessus.`;
    }
  }
  return null;
}

// ——— Simulation ———

const LATENCY_MS = 350;
const TICK_MS = 250;
const RUN_DURATION_MS: Record<GeneratedArtifactType, number> = {
  research: 9000,
  letter: 7000,
  portrait: 8000,
  interview_brief: 10_000,
};
const RUN_PHASE_LIST = ['Lancement de la session', 'Lecture des Inputs', 'Rédaction', 'Vérification du format'];
const DETECTION_SEARCH_MS = 1500;
const DETECTION_READ_MS = 700;
const DETECTION_STEP_LABEL: Record<DetectionStep, string> = {
  waiting: 'En attente de son tour',
  searching: 'Recherche dans la Source',
  reading: 'Lecture des Fiches de poste',
  done: 'Terminé',
};

function wait(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, LATENCY_MS));
}

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function runView(run: IRun, now: number): IRunView {
  const progress = run.status === 'done' ? 1 : Math.min(0.99, (now - run.startedAt) / run.durationMs);
  const phase =
    run.status === 'done'
      ? 'Terminé'
      : (RUN_PHASE_LIST[Math.min(RUN_PHASE_LIST.length - 1, Math.floor(progress * RUN_PHASE_LIST.length))] ?? '');
  return { ...run, progress, phase };
}

function detectionWatchDuration(readTotal: number): number {
  return DETECTION_SEARCH_MS + readTotal * DETECTION_READ_MS;
}

function detectionEnd(detection: IDetection): number {
  return (
    detection.startedAt +
    detection.watchList.reduce((total, { readTotal }) => total + detectionWatchDuration(readTotal), 0)
  );
}

function detectionView(detection: IDetection, now: number): IDetectionView {
  let watchStart = detection.startedAt;
  const isFinished = detection.finishedAt !== null;
  const watches = detection.watchList.map((watch, index) => {
    const elapsed = now - watchStart;
    watchStart += detectionWatchDuration(watch.readTotal);
    const readCount = Math.max(
      0,
      Math.min(watch.readTotal, Math.floor((elapsed - DETECTION_SEARCH_MS) / DETECTION_READ_MS)),
    );
    let step: DetectionStep = 'done';
    if (!isFinished) {
      if (elapsed < 0) {
        step = 'waiting';
      } else if (elapsed < DETECTION_SEARCH_MS) {
        step = 'searching';
      } else if (readCount < watch.readTotal) {
        step = 'reading';
      }
    }
    // The first Watch finds what the Detection found, the others nothing
    const foundReferences = index === 0 ? detection.foundReferenceList : [];
    return {
      id: watch.id,
      label: watch.label,
      step,
      stepLabel: DETECTION_STEP_LABEL[step],
      readCount: step === 'done' ? watch.readTotal : readCount,
      readTotal: watch.readTotal,
      foundReferences,
    };
  });
  return {
    startedAt: detection.startedAt,
    finishedAt: detection.finishedAt,
    isRunning: !isFinished,
    watches,
    foundReferences: detection.foundReferenceList,
  };
}

// A Repost of an existing Posting, published today: one the Candidate applied to if any, so the
// Sheet shows « Tu as postulé le … »
function syntheticPostingsOf(postingList: IPosting[], now: Date): IPosting[] {
  const applied = postingList.find(({ appliedAt, latitude }) => appliedAt !== null && latitude !== null);
  const toApply = postingList.find(
    ({ status, latitude, reference }) => status === 'to_apply' && latitude !== null && reference !== applied?.reference,
  );
  const deadline = new Date(now.getTime() + 30 * 86_400_000).toISOString();
  return [applied, toApply]
    .filter((posting) => posting !== undefined)
    .map((original, index) => ({
      ...original,
      reference: `2026-99${String(now.getTime()).slice(-5)}${String(index)}`,
      status: 'new',
      step: 'new',
      publishedAt: now.toISOString(),
      deadline,
      appliedAt: null,
      archivedAt: null,
      unpublishedAt: null,
      isExpired: false,
      notes: '',
      interviews: [],
      research: { state: 'none', latestNumber: null, chosenNumber: null },
      letter: { state: 'none', latestNumber: null, chosenNumber: null },
      repost: {
        repostOf: original.reference,
        repostList: [],
        publicationNumber: original.repost.publicationNumber + 1,
        firstPublishedAt: original.repost.firstPublishedAt ?? original.publishedAt,
        earlierApplication:
          original.appliedAt === null
            ? original.repost.earlierApplication
            : { reference: original.reference, appliedAt: original.appliedAt, step: original.step },
      },
      isSynthetic: true,
    }));
}

// What a simulated run writes: the previous Version under a note, else a skeleton from the Job
// Description
function simulatedText(artifact: IArtifact | undefined, artifactKey: string, posting: IPosting, now: Date): string {
  const type = typeOfKey(artifactKey);
  const note = `> Version simulée par le prototype le ${formatDateTime(now.toISOString())} : aucune session Claude n’a tourné.`;
  const previous = artifact?.versions.find(({ isChosen }) => isChosen) ?? artifact?.versions.at(-1);
  if (previous !== undefined) {
    // One note only, however many times it was regenerated
    return `${note}\n\n${previous.text.replaceAll(/^> Version simulée par le prototype .*\n+/gmu, '')}`;
  }
  if (type === 'letter') {
    return `${note}\n\nMadame, Monsieur,\n\nJe vous adresse ma candidature au poste de ${posting.title}.\n\n…`;
  }
  const excerpt = posting.jobDescription.replaceAll(/[{}<>]/gu, '').slice(0, 900);
  return `# ${ARTIFACT_LABEL[type]} · ${posting.title}\n\n${note}\n\n## Ce que dit la Fiche de poste\n\n${excerpt}…`;
}

// ——— Context ———

interface IPrototypeContext {
  data: IPrototypeData;
  overlay: ICandidateOverlay;
  now: number;
  actions: IPrototypeActions;
  detailOf: (reference: string, base: IPostingDetail | null) => IPostingDetail | null;
}

export interface IAddVersionInput {
  text: string;
  origin: 'ai' | 'candidate';
  inputs?: IInputRef[];
  instructions?: string;
}

export interface IAddCustomArtifactInput {
  reference: string;
  interviewNumber?: number | null;
  title: string;
  text: string;
  // « Pour cette Offre » (a Custom Artifact) or « Dans mon Profil » (an Annex, reusable)
  scope: 'posting' | 'profile';
}

export interface IStartGenerationInput {
  reference: string;
  artifactKey: string;
  // The Inputs checked in the panel
  inputs: (IInputSpec | IInputRef)[];
  // The Instructions in effect; defaults to the Candidate's or the default ones
  instructions?: string;
}

export interface IPrototypeActions {
  keep: (reference: string) => Promise<void>;
  dismiss: (reference: string) => Promise<void>;
  setStatus: (reference: string, status: Exclude<PostingStatus, 'new'>) => Promise<void>;
  archive: (reference: string) => Promise<void>;
  unarchive: (reference: string) => Promise<void>;
  saveNotes: (reference: string, notes: string) => Promise<void>;
  saveInterview: (
    reference: string,
    interview: Omit<IInterview, 'number'> & { number?: number | undefined },
  ) => Promise<void>;
  deleteInterview: (reference: string, number: number) => Promise<void>;
  validateVersion: (reference: string, artifactKey: string, number: number) => Promise<void>;
  addVersion: (reference: string, artifactKey: string, version: IAddVersionInput) => Promise<void>;
  editVersion: (reference: string, artifactKey: string, number: number, text: string) => Promise<void>;
  saveInstructions: (type: GeneratedArtifactType, text: string | null) => Promise<void>;
  addCustomArtifact: (input: IAddCustomArtifactInput) => Promise<string>;
  startGeneration: (input: IStartGenerationInput) => Promise<string>;
  startDetection: () => Promise<void>;
  seed: (reference: string, patch: Partial<IPosting>, artifacts?: ISeedArtifact[]) => void;
}

// A simulated Version 1 a seeded Posting starts with, a Draft or Validated
export interface ISeedArtifact {
  artifactKey: 'research' | 'letter';
  isValidated: boolean;
}

// A Candidate's overlay before any mutation: the hand-written MDX showcase (posting/showcase.ts) as the
// newest Versions of the Béziers Posting, so every screen reads them from the store, never from a loader
function initialOverlayOf(data: IPrototypeData): ICandidateOverlay {
  if (!data.postings.some(({ reference }) => reference === SHOWCASE_REFERENCE)) {
    return EMPTY_OVERLAY;
  }
  const opList: ArtifactOp[] = SHOWCASE_VERSION_LIST.map(({ artifactKey, createdAt, ...version }) => ({
    kind: 'addVersion',
    artifactKey,
    createdAt,
    version: { ...version, origin: 'ai' },
  }));
  return { ...EMPTY_OVERLAY, opsByReference: { [SHOWCASE_REFERENCE]: opList } };
}

const PrototypeContext = createContext<IPrototypeContext | null>(null);

function instructionsOf(data: IPrototypeData, overlay: ICandidateOverlay): IInstructions[] {
  return data.instructions.map((instructions) => {
    const overridden = overlay.instructionsByType[instructions.type];
    return overridden === undefined ? instructions : { ...instructions, candidateText: overridden };
  });
}

export function PrototypeStoreProvider({ data, children }: { data: IPrototypeData; children: ReactNode }) {
  const candidateId = data.candidate.id;
  const [state, dispatch] = useReducer(reduce, null, () => ({
    now: Date.now(),
    overlayByCandidate: { [candidateId]: initialOverlayOf(data) },
  }));
  // A Candidate seen for the first time (a switch): its initial overlay, during this very render
  const knownOverlay = state.overlayByCandidate[candidateId];
  if (knownOverlay === undefined) {
    dispatch({ type: 'init', candidateId, overlay: initialOverlayOf(data) });
  }
  const overlay = knownOverlay ?? EMPTY_OVERLAY;
  // The mutations read the latest state without being recreated at each tick
  const latest = useRef({ data, overlay });
  latest.current = { data, overlay };

  const postingOf = useCallback((reference: string): IPosting | undefined => {
    const { data: currentData, overlay: currentOverlay } = latest.current;
    const posting =
      currentData.postings.find((other) => other.reference === reference) ??
      currentOverlay.syntheticList.find((other) => other.reference === reference);
    return posting === undefined ? undefined : applyPosting(posting, currentOverlay, new Date());
  }, []);

  // Each Posting's loaded detail, kept so a run finishing elsewhere can still number its Version
  const detailCache = useRef(new Map<string, IPostingDetail>());
  const detailOf = useCallback(
    (reference: string, base: IPostingDetail | null): IPostingDetail | null => {
      if (base !== null) {
        detailCache.current.set(reference, base);
      }
      const isSynthetic = overlay.syntheticList.some((posting) => posting.reference === reference);
      const known =
        base ??
        detailCache.current.get(reference) ??
        (isSynthetic ? { reference, artifacts: [], recipients: null, sentLetters: [] } : null);
      if (known === null) {
        return null;
      }
      const opList = overlay.opsByReference[reference] ?? [];
      const artifacts = opList.reduce(applyOp, known.artifacts);
      const posting =
        data.postings.find((other) => other.reference === reference) ??
        overlay.syntheticList.find((other) => other.reference === reference);
      const overlaid = posting === undefined ? undefined : applyPosting(posting, overlay, new Date());
      return {
        ...known,
        artifacts: artifacts.map((artifact) => ({
          ...artifact,
          refusal: refusalOf(artifact, artifacts, overlaid, data.inputRules),
        })),
      };
    },
    [data, overlay],
  );

  const patch = useCallback(
    (reference: string, postingPatch: IPostingPatch) => {
      dispatch({ type: 'patch', candidateId, reference, patch: postingPatch });
    },
    [candidateId],
  );

  const actions = useMemo((): IPrototypeActions => {
    const titleOf = (reference: string) => postingOf(reference)?.title ?? reference;

    async function startGeneration({ reference, artifactKey, inputs, instructions }: IStartGenerationInput) {
      await wait();
      const posting = postingOf(reference);
      const type = typeOfKey(artifactKey);
      if (posting === undefined || type === 'custom') {
        toast.error('Génération impossible : Offre ou Artifact inconnu');
        return '';
      }
      const { data: currentData, overlay: currentOverlay } = latest.current;
      const instructionsInEffect =
        instructions ??
        instructionsOf(currentData, currentOverlay)
          .filter(({ type: other }) => other === type)
          .map(({ candidateText, defaultText }) => candidateText ?? defaultText)[0] ??
        '';
      const label = `${ARTIFACT_LABEL[type]} · ${posting.title}`;
      const run: IRun = {
        id: newId(),
        reference,
        artifactKey,
        label,
        startedAt: Date.now(),
        durationMs: RUN_DURATION_MS[type],
        inputs: inputs.map(({ key, label: inputLabel }) => ({ key, label: inputLabel })),
        instructions: instructionsInEffect,
        status: 'running',
        versionNumber: null,
      };
      dispatch({ type: 'startRun', candidateId, run });
      toast.loading(`${ARTIFACT_LABEL[type]} en cours de génération`, { id: run.id, description: posting.title });
      return run.id;
    }

    return {
      async keep(reference) {
        await wait();
        patch(reference, { status: 'to_apply' });
        toast.success('Offre gardée : elle passe À traiter', { description: titleOf(reference) });
        await startGeneration({
          reference,
          artifactKey: 'research',
          inputs: [{ key: 'job_description', label: 'Fiche de poste' }],
        });
      },
      async dismiss(reference) {
        await wait();
        patch(reference, { archivedAt: new Date().toISOString() });
        toast.success('Offre écartée', {
          description: titleOf(reference),
          action: { label: 'Annuler', onClick: () => patch(reference, { archivedAt: null }) },
        });
      },
      async setStatus(reference, status) {
        await wait();
        const posting = postingOf(reference);
        const wasOutcome = posting?.status === 'hired' || posting?.status === 'rejected';
        patch(reference, {
          status,
          appliedAt: status === 'to_apply' ? null : (posting?.appliedAt ?? new Date().toISOString()),
        });
        const message =
          status === 'applied' && wasOutcome ? 'Candidature remise en cours' : `Marquée ${STEP_LABEL[status]}`;
        toast.success(message, { description: titleOf(reference) });
      },
      async archive(reference) {
        await wait();
        patch(reference, { archivedAt: new Date().toISOString() });
        toast.success('Offre archivée', {
          description: titleOf(reference),
          action: { label: 'Annuler', onClick: () => patch(reference, { archivedAt: null }) },
        });
      },
      async unarchive(reference) {
        await wait();
        patch(reference, { archivedAt: null });
        toast.success('Offre désarchivée', { description: titleOf(reference) });
      },
      async saveNotes(reference, notes) {
        await wait();
        patch(reference, { notes });
        toast.success('Notes enregistrées');
      },
      async saveInterview(reference, interview) {
        await wait();
        const interviewList = postingOf(reference)?.interviews ?? [];
        const { number } = interview;
        const saved: IInterview = {
          ...interview,
          number: number ?? Math.max(0, ...interviewList.map((other) => other.number)) + 1,
        };
        patch(reference, {
          interviews: (number === undefined
            ? [...interviewList, saved]
            : interviewList.map((other) => (other.number === number ? saved : other))
          ).toSorted((first, second) => first.startAt.localeCompare(second.startAt)),
        });
        toast.success(number === undefined ? 'Entretien ajouté' : 'Entretien modifié', {
          description: formatDateTime(saved.startAt),
        });
      },
      async deleteInterview(reference, number) {
        await wait();
        const interviewList = postingOf(reference)?.interviews ?? [];
        patch(reference, { interviews: interviewList.filter((other) => other.number !== number) });
        toast.success('Entretien supprimé');
      },
      async validateVersion(reference, artifactKey, number) {
        await wait();
        dispatch({ type: 'op', candidateId, reference, op: { kind: 'validate', artifactKey, number } });
        toast.success(`Version ${String(number)} validée : c’est la Version retenue`, {
          description: ARTIFACT_LABEL[typeOfKey(artifactKey)],
        });
      },
      async addVersion(reference, artifactKey, version) {
        await wait();
        dispatch({
          type: 'op',
          candidateId,
          reference,
          op: { kind: 'addVersion', artifactKey, version, createdAt: new Date().toISOString() },
        });
        toast.success('Nouvelle Version ajoutée en Brouillon', {
          description: 'Valide-la pour qu’elle devienne la Version retenue.',
        });
      },
      async editVersion(reference, artifactKey, number, text) {
        await wait();
        dispatch({ type: 'op', candidateId, reference, op: { kind: 'edit', artifactKey, number, text } });
        toast.success(`Version ${String(number)} corrigée`);
      },
      async saveInstructions(type, text) {
        await wait();
        dispatch({ type: 'instructions', candidateId, artifactType: type, text });
        toast.success(
          text === null
            ? `Consignes par défaut rétablies pour la ${ARTIFACT_LABEL[type]}`
            : `Tes Consignes s’appliquent désormais à chaque ${ARTIFACT_LABEL[type]}`,
        );
      },
      async addCustomArtifact({ reference, interviewNumber = null, title, text, scope }) {
        await wait();
        const now = new Date().toISOString();
        if (scope === 'profile') {
          const fileName = `annex-${title
            .toLowerCase()
            .normalize('NFD')
            .replaceAll(/[̀-ͯ]/gu, '')
            .replaceAll(/[^a-z0-9]+/gu, '-')
            .replaceAll(/^-|-$/gu, '')}.md`;
          dispatch({
            type: 'annex',
            candidateId,
            document: { key: fileName, kind: 'annex', fileName, label: `Annexe · ${title}`, text },
          });
          toast.success('Annexe ajoutée à ton Profil', { description: title });
          return `profile:${fileName}`;
        }
        const key = `custom:${newId()}`;
        const artifact: IArtifact = {
          key,
          type: 'custom',
          label: title,
          interviewNumber,
          format: 'mdx',
          versions: [
            {
              number: 1,
              state: 'validated',
              isChosen: true,
              origin: 'candidate',
              createdAt: now,
              fileName: `${key.replace(':', '-')}.md`,
              text,
              original: null,
              inputs: [],
              instructions: '',
            },
          ],
          chosenNumber: 1,
          refusal: null,
          fixedPart: null,
          isFixedPartExample: false,
        };
        dispatch({ type: 'op', candidateId, reference, op: { kind: 'addArtifact', artifact } });
        toast.success('Document ajouté à l’Offre', { description: title });
        return `artifact:${key}`;
      },
      startGeneration,
      seed(reference, postingPatch, artifacts = []) {
        const posting = postingOf(reference);
        if (posting === undefined || latest.current.overlay.patchByReference[reference] !== undefined) {
          return;
        }
        patch(reference, postingPatch);
        const now = new Date();
        for (const { artifactKey, isValidated } of artifacts) {
          const number = (posting[artifactKey].latestNumber ?? 0) + 1;
          const text = simulatedText(undefined, artifactKey, posting, now);
          const version: NewVersion = { text, origin: 'ai' };
          const createdAt = now.toISOString();
          dispatch({ type: 'op', candidateId, reference, op: { kind: 'addVersion', artifactKey, version, createdAt } });
          if (isValidated) {
            dispatch({ type: 'op', candidateId, reference, op: { kind: 'validate', artifactKey, number } });
          }
        }
      },
      async startDetection() {
        await wait();
        const { data: currentData, overlay: currentOverlay } = latest.current;
        if (currentOverlay.detection?.finishedAt === null) {
          toast.warning('Une Détection est déjà en cours');
          return;
        }
        const watchList =
          currentData.watches.length === 0
            ? [{ id: 'prototype', label: 'Veille (simulée)', readTotal: 4 }]
            : currentData.watches.map(({ id, label }) => ({ id, label, readTotal: 6 }));
        dispatch({
          type: 'startDetection',
          candidateId,
          detection: { startedAt: Date.now(), finishedAt: null, watchList, foundReferenceList: [] },
        });
      },
    };
  }, [candidateId, patch, postingOf]);

  // The clock of the simulated runs and Detection, and their endings
  const hasRunning =
    overlay.runList.some(({ status }) => status === 'running') ||
    (overlay.detection !== null && overlay.detection.finishedAt === null);
  useEffect(() => {
    if (!hasRunning) {
      return;
    }
    const interval = setInterval(() => {
      const now = Date.now();
      dispatch({ type: 'tick', now });
      const { data: currentData, overlay: currentOverlay } = latest.current;
      for (const run of currentOverlay.runList) {
        if (run.status === 'running' && now >= run.startedAt + run.durationMs) {
          const posting = postingOf(run.reference);
          if (posting === undefined) {
            continue;
          }
          const detail = detailOf(run.reference, null);
          const artifact = detail?.artifacts.find(({ key }) => key === run.artifactKey);
          const versionNumber = artifact === undefined ? 1 : nextNumberOf(artifact);
          const text = simulatedText(artifact, run.artifactKey, posting, new Date(now));
          dispatch({
            type: 'finishRun',
            candidateId,
            id: run.id,
            versionNumber,
            op: {
              kind: 'addVersion',
              artifactKey: run.artifactKey,
              version: { text, origin: 'ai', inputs: run.inputs, instructions: run.instructions },
              createdAt: new Date(now).toISOString(),
            },
          });
          toast.success(`Version ${String(versionNumber)} prête, en Brouillon`, { id: run.id, description: run.label });
        }
      }
      const { detection } = currentOverlay;
      if (detection !== null && detection.finishedAt === null && now >= detectionEnd(detection)) {
        const allPostings = [...currentOverlay.syntheticList, ...currentData.postings];
        const syntheticList = syntheticPostingsOf(allPostings, new Date(now));
        dispatch({ type: 'finishDetection', candidateId, now, syntheticList });
        toast.success(
          syntheticList.length === 0 ? 'Aucune nouvelle Offre' : `${String(syntheticList.length)} nouvelles Offres`,
          { description: 'Détection terminée' },
        );
      }
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [hasRunning, candidateId, detailOf, postingOf]);

  // Agent eyes: a puppeteer script can drive the store, e.g. `window.__prototype.actions.startDetection()`
  useEffect(() => {
    Object.assign(globalThis, { __prototype: { actions, overlay } });
  }, [actions, overlay]);

  const value = useMemo(
    (): IPrototypeContext => ({ data, overlay, now: state.now, actions, detailOf }),
    [data, overlay, state.now, actions, detailOf],
  );
  return createElement(PrototypeContext.Provider, { value }, children);
}

function useContextValue(): IPrototypeContext {
  const value = useContext(PrototypeContext);
  if (value === null) {
    throw new Error('Prototype hooks need <PrototypeStoreProvider>, mounted by prototype/layout.tsx');
  }
  return value;
}

// ——— Hooks ———

export function usePostings(): IPosting[] {
  const { data, overlay } = useContextValue();
  return useMemo(() => {
    const now = new Date();
    return [...overlay.syntheticList, ...data.postings].map((posting) => applyPosting(posting, overlay, now));
  }, [data.postings, overlay]);
}

export function usePosting(reference: string): IPosting | undefined {
  return usePostings().find((posting) => posting.reference === reference);
}

export function usePostingDetail(reference: string, loaderDetail: IPostingDetail | null): IPostingDetail | null {
  const { detailOf } = useContextValue();
  return useMemo(() => detailOf(reference, loaderDetail), [detailOf, reference, loaderDetail]);
}

export function useActions(): IPrototypeActions {
  return useContextValue().actions;
}

export function useInstructions(type: GeneratedArtifactType): {
  text: string;
  defaultText: string;
  isCandidate: boolean;
} {
  const { data, overlay } = useContextValue();
  const instructions = instructionsOf(data, overlay).find((entry) => entry.type === type);
  return {
    text: instructions?.candidateText ?? instructions?.defaultText ?? '',
    defaultText: instructions?.defaultText ?? '',
    isCandidate: instructions?.candidateText != null,
  };
}

export function useInputs(reference: string, artifactKey: string, detail: IPostingDetail | null): IInputSpec[] {
  const { data, overlay } = useContextValue();
  const posting = usePosting(reference);
  return useMemo(() => {
    if (posting === undefined || detail === null) {
      return [];
    }
    return listInputs(artifactKey, {
      posting,
      detail,
      rules: data.inputRules,
      profileDocuments: [...data.profileDocuments, ...overlay.annexList],
    });
  }, [posting, detail, artifactKey, data.inputRules, data.profileDocuments, overlay.annexList]);
}

export function useRuns(reference?: string): IRunView[] {
  const { overlay, now } = useContextValue();
  return overlay.runList
    .filter((run) => reference === undefined || run.reference === reference)
    .map((run) => runView(run, now));
}

export function useDetection(): IDetectionView | null {
  const { overlay, now } = useContextValue();
  return overlay.detection === null ? null : detectionView(overlay.detection, now);
}

export function usePrototype() {
  const { data, overlay, now, actions } = useContextValue();
  const postings = usePostings();
  return {
    candidate: data.candidate,
    candidateList: data.candidateList,
    postings,
    watches: data.watches,
    profileDocuments: [...data.profileDocuments, ...overlay.annexList],
    instructions: instructionsOf(data, overlay),
    inputRules: data.inputRules,
    runs: overlay.runList.map((run) => runView(run, now)),
    detection: overlay.detection === null ? null : detectionView(overlay.detection, now),
    now,
    actions,
  };
}
