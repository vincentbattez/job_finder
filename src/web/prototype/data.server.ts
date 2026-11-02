// PROTOTYPE (branch prototype/v1-ux, never merged). Read-only loaders of the prototype: they call the
// read actions of src/actions/ on this worktree's data/ snapshot (never raw SQL, never a write) and map
// the snapshot to the V1 model of DECISIONS.md:
// - a To Apply Posting with no Research Version is New;
// - the Chosen Version of each Artifact is Validated, a newer one a Draft, an older one Validated;
// - a Letter Version's draft.md is its Original and letter.md its text (no draft.md: brought by the
//   Candidate, no Original); the Visualization is dropped (ADR-0020);
// - the Start Date comes from « Date de vacance de l'emploi » in the Job Description.
// The snapshot never changes, so each Candidate is read once per server and kept in memory.
import { AI_MODULE_BY_ARTIFACT } from '#/artifact/registry.ts';
import type { Posting, PostingDetail } from '#/domain/index.ts';
import { ACTIONS } from '#/web/acl/actions.server.ts';

import {
  ARTIFACT_LABEL,
  artifactKeyOf,
  summaryOf,
  type GeneratedArtifactType,
  type IArtifact,
  type ICandidate,
  type IDocument,
  type IInputRule,
  type IInstructions,
  type IPosting,
  type IPostingDetail,
  type IProfileDocument,
  type IPrototypeData,
  type IRepost,
  type IVersion,
  type IWatch,
  type PostingStatus,
} from './model.ts';

// The Candidate the prototype shows, remembered apart from the real front's cookie
export const CANDIDATE_COOKIE_NAME = 'prototype_candidate';
// A second, empty Candidate, so the switcher has somewhere to go: the snapshot has Léa only
const DEMO_CANDIDATE: ICandidate = { id: 'prototype-demo', name: 'Démo (vide)' };

const GENERATED_TYPE_LIST: GeneratedArtifactType[] = ['research', 'letter', 'portrait', 'interview_brief'];

type ArtifactEntry = PostingDetail['artifactList'][number];

interface ICandidateSnapshot {
  data: Omit<IPrototypeData, 'candidateList'>;
  detailByReference: Map<string, IPostingDetail>;
}

const snapshotByCandidate = new Map<string, Promise<ICandidateSnapshot>>();

function iso(date: Date | null): string | null {
  return date === null ? null : date.toISOString();
}

function isGenerated(artifact: string): artifact is GeneratedArtifactType {
  return GENERATED_TYPE_LIST.some((type) => type === artifact);
}

// « Date de vacance de l'emploi » then a blank line and « 01/12/2026 »
function findStartDate(jobDescription: string): string | null {
  const match = /### Date de vacance de l['’]emploi\s+(\d{2})\/(\d{2})\/(\d{4})/u.exec(jobDescription);
  return match === null ? null : `${match[3] ?? ''}-${match[2] ?? ''}-${match[1] ?? ''}`;
}

function repostOf(posting: Posting, byReference: Map<string, Posting>): IRepost {
  // The earlier Postings of the same Position, the nearest first
  const earlierList: Posting[] = [];
  let current = posting;
  while (current.repostOf !== null) {
    const earlier = byReference.get(current.repostOf.reference);
    if (earlier === undefined || earlierList.includes(earlier)) {
      break;
    }
    earlierList.push(earlier);
    current = earlier;
  }
  const applied = earlierList.find(({ appliedAt }) => appliedAt !== null);
  return {
    repostOf: posting.repostOf?.reference ?? null,
    repostList: posting.repostList.map(({ reference }) => reference),
    publicationNumber: earlierList.length + 1,
    firstPublishedAt: iso((earlierList.at(-1) ?? posting).publishedAt),
    earlierApplication:
      applied?.appliedAt == null
        ? null
        : { reference: applied.reference, appliedAt: applied.appliedAt.toISOString(), step: applied.step },
  };
}

function artifactOf(
  reference: string,
  entry: ArtifactEntry,
  interviewNumber: number | null,
  fixedPartExampleByType: Map<GeneratedArtifactType, string>,
): IArtifact | null {
  const type = entry.artifact;
  if (!isGenerated(type)) {
    return null;
  }
  const { fileName } = AI_MODULE_BY_ARTIFACT[type];
  const readyList = entry.versionList.filter(({ version }) => version.state === 'ready');
  const chosenNumber = readyList.find(({ version }) => version.isChosen)?.version.number ?? null;
  const versions = readyList.map(({ version, documentList }): IVersion => {
    const text = documentList.find((document) => document.fileName === fileName)?.markdown ?? '';
    const draft = documentList.find((document) => document.fileName === 'draft.md');
    const isBrought = type === 'letter' && draft === undefined;
    return {
      number: version.number,
      state: version.isChosen || (chosenNumber !== null && version.number < chosenNumber) ? 'validated' : 'draft',
      isChosen: version.isChosen,
      origin: isBrought ? 'candidate' : 'ai',
      createdAt: version.createdAt.toISOString(),
      fileName,
      text,
      original: isBrought ? null : type === 'letter' ? (draft?.markdown ?? null) : text,
      inputs: version.inputList
        .filter((read) => isGenerated(read.artifact))
        .map((read) => {
          const readType = read.artifact === 'visualization' ? 'research' : read.artifact;
          const readInterview = read.interview?.number ?? null;
          const where = read.posting.reference === reference ? '' : ` · Offre ${read.posting.reference}`;
          const interview = readInterview === null ? '' : ` · Entretien ${String(readInterview)}`;
          return {
            key: `artifact:${artifactKeyOf(readType, readInterview)}`,
            label: `${ARTIFACT_LABEL[readType]}${interview} v${String(read.number)}${where}`,
          };
        }),
      instructions: version.instructions,
    };
  });
  const fixedPart = entry.module.prompt?.fixedPart ?? null;
  return {
    key: artifactKeyOf(type, interviewNumber),
    type,
    label: ARTIFACT_LABEL[type],
    interviewNumber,
    format: type === 'letter' ? 'markdown' : 'mdx',
    versions,
    chosenNumber,
    refusal: entry.module.refusal,
    fixedPart: fixedPart ?? fixedPartExampleByType.get(type) ?? null,
    isFixedPartExample: fixedPart === null && fixedPartExampleByType.has(type),
  };
}

function profileDocumentOf({ fileName, markdown }: { fileName: string; markdown: string }): IProfileDocument {
  const name = fileName.replace(/\.md$/u, '');
  const kind = name === 'cv' ? 'cv' : name === 'facts' ? 'facts' : name.startsWith('letter-') ? 'letter' : 'annex';
  const labelByKind = { cv: 'CV', facts: 'Faits', letter: 'Lettre passée', annex: 'Annexe' };
  const subject = name.replace(/^(?:letter|annex)-/u, '').replaceAll('-', ' ');
  return {
    key: fileName,
    kind,
    fileName,
    label: kind === 'cv' || kind === 'facts' ? labelByKind[kind] : `${labelByKind[kind]} · ${subject}`,
    text: markdown,
  };
}

function inputRules(): Record<GeneratedArtifactType, IInputRule> {
  const ruleOf = (type: GeneratedArtifactType): IInputRule => {
    const aiModule = AI_MODULE_BY_ARTIFACT[type];
    return {
      requiredList: (aiModule.requiredArtifactList ?? []).filter(isGenerated),
      optionalList: (aiModule.optionalArtifactList ?? []).filter(isGenerated),
      previousInterviewList: (aiModule.previousInterviewArtifactList ?? []).filter(isGenerated),
      isReadingNotes: aiModule.isReadingNotes === true,
      isReadingProfile: aiModule.isReadingProfile === true,
      isReadingSentVersions: aiModule.isReadingSentVersions === true,
      isAttachedToInterview: aiModule.isAttachedToInterview === true,
    };
  };
  return {
    research: ruleOf('research'),
    letter: ruleOf('letter'),
    portrait: ruleOf('portrait'),
    interview_brief: ruleOf('interview_brief'),
  };
}

async function readWatches(candidateId: string): Promise<IWatch[]> {
  const watchList = await ACTIONS.listWatches({ candidateId });
  const { last } = await ACTIONS.followDetection({ candidateId });
  return watchList.map((watch) => {
    const recorded = last?.watchList.find(({ watchId }) => watchId === watch.id);
    return {
      id: watch.id,
      source: watch.source,
      label: recorded?.label ?? watch.id,
      nearMisses: recorded?.nearMissList ?? [],
      lastDetectedAt: iso(watch.detectedAt),
    };
  });
}

async function readCandidate(candidateId: string): Promise<ICandidateSnapshot> {
  const postingList = await ACTIONS.listPostings({ candidateId });
  const rawDetailList: PostingDetail[] = [];
  for (const { reference } of postingList) {
    rawDetailList.push(await ACTIONS.readPosting({ reference }));
  }
  const byReference = new Map(postingList.map((posting) => [posting.reference, posting]));
  // The Fixed Part of a type as another Posting composes it, for a Posting whose module refuses to run
  const fixedPartExampleByType = new Map<GeneratedArtifactType, string>();
  for (const detail of rawDetailList) {
    for (const entry of [...detail.artifactList, ...detail.interviewList.flatMap(({ artifactList }) => artifactList)]) {
      const fixedPart = entry.module.prompt?.fixedPart;
      if (isGenerated(entry.artifact) && fixedPart !== undefined && !fixedPartExampleByType.has(entry.artifact)) {
        fixedPartExampleByType.set(entry.artifact, fixedPart);
      }
    }
  }
  const detailList = rawDetailList.map((detail): IPostingDetail => {
    const { reference } = detail.posting;
    const artifacts = [
      ...detail.artifactList.map((entry) => artifactOf(reference, entry, null, fixedPartExampleByType)),
      ...detail.interviewList.flatMap((interview) =>
        interview.artifactList.map((entry) => artifactOf(reference, entry, interview.number, fixedPartExampleByType)),
      ),
    ].filter((artifact) => artifact !== null);
    const { recipients } = detail;
    return {
      reference,
      artifacts,
      recipients:
        recipients === null
          ? null
          : {
              to: recipients.to?.email ?? null,
              ccList: recipients.ccList.map(({ email }) => email),
              salutation: recipients.salutation.text,
            },
      sentLetters: [],
    };
  });
  // The Chosen Letter of each Applied Posting: what the Letter module reads as already sent
  const sentLetterList: IDocument[] = detailList.flatMap((detail) => {
    const posting = byReference.get(detail.reference);
    const letter = detail.artifacts.find(({ key }) => key === 'letter');
    const chosen = letter?.versions.find(({ isChosen }) => isChosen);
    return posting?.appliedAt == null || chosen === undefined
      ? []
      : [
          {
            key: detail.reference,
            label: `Lettre envoyée · ${posting.title}`,
            fileName: chosen.fileName,
            text: chosen.text,
          },
        ];
  });
  for (const detail of detailList) {
    detail.sentLetters = sentLetterList.filter(({ key }) => key !== detail.reference);
  }
  const detailByReference = new Map(detailList.map((detail) => [detail.reference, detail]));
  const postings = postingList.map((posting, index): IPosting => {
    const detail = detailByReference.get(posting.reference);
    const research = detail?.artifacts.find(({ key }) => key === 'research');
    const letter = detail?.artifacts.find(({ key }) => key === 'letter');
    const isNew = posting.status === 'to_apply' && (research?.versions.length ?? 0) === 0;
    const status: PostingStatus = isNew ? 'new' : posting.status;
    const jobDescription = rawDetailList[index]?.jobDescription ?? '';
    return {
      reference: posting.reference,
      title: posting.title,
      employer: posting.employer,
      url: posting.url,
      source: posting.source,
      city: posting.city,
      region: posting.region,
      latitude: posting.latitude,
      longitude: posting.longitude,
      status,
      step: isNew ? 'new' : posting.step,
      publishedAt: iso(posting.publishedAt),
      deadline: iso(posting.deadline),
      startDate: findStartDate(jobDescription),
      appliedAt: iso(posting.appliedAt),
      archivedAt: iso(posting.archivedAt),
      unpublishedAt: iso(posting.unpublishedAt),
      isExpired: posting.isExpired,
      repost: repostOf(posting, byReference),
      contacts: {
        applicationEmail: posting.applicationEmail,
        contact1: posting.contact1,
        contact2: posting.contact2,
        workplace: posting.workplace,
      },
      jobDescription,
      notes: posting.notes,
      interviews: (rawDetailList[index]?.interviewList ?? []).map((interview) => ({
        number: interview.number,
        startAt: interview.startAt.toISOString(),
        durationMinutes: interview.durationMinutes,
        place: interview.place,
        interviewers: interview.interviewers,
      })),
      research: summaryOf(research),
      letter: summaryOf(letter),
      isSynthetic: false,
    };
  });
  const instructions = (await ACTIONS.listInstructions({ candidateId })).flatMap(
    ({ module, defaultInstructions, candidateInstructions }): IInstructions[] =>
      isGenerated(module)
        ? [{ type: module, defaultText: defaultInstructions, candidateText: candidateInstructions }]
        : [],
  );
  const candidate = (await ACTIONS.listCandidates()).find(({ id }) => id === candidateId);
  return {
    data: {
      candidate: { id: candidateId, name: candidate?.name ?? candidateId },
      postings,
      watches: await readWatches(candidateId),
      profileDocuments: (await ACTIONS.listProfileFiles({ candidateId })).map(profileDocumentOf),
      instructions,
      inputRules: inputRules(),
    },
    detailByReference,
  };
}

// The default Instructions, as the first real Candidate reads them
async function demoSnapshot(): Promise<ICandidateSnapshot> {
  const [first] = await ACTIONS.listCandidates();
  const instructions = first === undefined ? [] : await ACTIONS.listInstructions({ candidateId: first.id });
  return {
    data: {
      candidate: DEMO_CANDIDATE,
      postings: [],
      watches: [],
      profileDocuments: [],
      instructions: instructions.flatMap(({ module, defaultInstructions }): IInstructions[] =>
        isGenerated(module) ? [{ type: module, defaultText: defaultInstructions, candidateText: null }] : [],
      ),
      inputRules: inputRules(),
    },
    detailByReference: new Map(),
  };
}

function snapshotOf(candidateId: string): Promise<ICandidateSnapshot> {
  let snapshot = snapshotByCandidate.get(candidateId);
  if (snapshot === undefined) {
    snapshot = candidateId === DEMO_CANDIDATE.id ? demoSnapshot() : readCandidate(candidateId);
    snapshotByCandidate.set(candidateId, snapshot);
  }
  return snapshot;
}

async function chosenCandidateOf(request: Request): Promise<{ candidate: ICandidate; candidateList: ICandidate[] }> {
  const candidateList: ICandidate[] = [
    ...(await ACTIONS.listCandidates()).map(({ id, name }) => ({ id, name })),
    DEMO_CANDIDATE,
  ];
  const cookie = request.headers.get('Cookie') ?? '';
  const chosenId = new RegExp(`(?:^|;\\s*)${CANDIDATE_COOKIE_NAME}=([^;]+)`, 'u').exec(cookie)?.[1];
  const candidate =
    candidateList.find(({ id }) => id === (chosenId === undefined ? undefined : decodeURIComponent(chosenId))) ??
    candidateList[0] ??
    DEMO_CANDIDATE;
  return { candidate, candidateList };
}

// Everything the layout of /prototype gives every screen: the Candidates, the Postings of the chosen
// one with their Job Description, Watches, Profile documents, Instructions and Input rules
export async function loadPrototype(request: Request): Promise<IPrototypeData> {
  const { candidate, candidateList } = await chosenCandidateOf(request);
  const { data } = await snapshotOf(candidate.id);
  return { ...data, candidateList };
}

// A Posting's Artifacts with every Version and its files, null when the snapshot has no such Posting
// (a Posting found by a simulated Detection lives in the store only)
export async function loadPostingDetail(request: Request, reference: string): Promise<IPostingDetail | null> {
  const { candidate } = await chosenCandidateOf(request);
  const { detailByReference } = await snapshotOf(candidate.id);
  return detailByReference.get(reference) ?? null;
}
