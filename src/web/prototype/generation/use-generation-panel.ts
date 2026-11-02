// PROTOTYPE (branch prototype/v1-ux, never merged). The state every variant of the generation panel
// shares, so switching ?panel= keeps what the Candidate checked: the Inputs (required locked, default
// checked, Annexes to add, prefilled from the previous Version on a regeneration), the Instructions
// edited in place, the plain-words explanation of the run, then the run itself once launched.
import { useMemo, useState } from 'react';

import {
  ARTIFACT_LABEL,
  latestVersionOf,
  type GeneratedArtifactType,
  type IArtifact,
  type IInputSpec,
  type IInterview,
  type IPosting,
  type IVersion,
} from '../model.ts';
import {
  useActions,
  useInputs,
  useInstructions,
  usePostingDetail,
  usePostings,
  useRuns,
  type IRunView,
} from '../store.ts';

export type InputGroup = 'posting' | 'profile' | 'annex';

export interface IPanelInput extends IInputSpec {
  group: InputGroup;
  isChecked: boolean;
  wordCount: number;
}

export const GROUP_LABEL: Record<InputGroup, string> = {
  posting: 'De l’Offre',
  profile: 'De ton Profil',
  annex: 'Annexes de ton Profil',
};

export const GROUP_HINT: Record<InputGroup, string> = {
  posting: '',
  profile: '',
  annex: 'Non lues par défaut : coche celles qui servent cette Offre.',
};

// Grammar of the French copy: « la Lettre », « le Portrait »
const ARTICLE: Record<GeneratedArtifactType, { the: string; a: string; new: string }> = {
  research: { the: 'la ', a: 'une ', new: 'nouvelle' },
  letter: { the: 'la ', a: 'une ', new: 'nouvelle' },
  portrait: { the: 'le ', a: 'un ', new: 'nouveau' },
  interview_brief: { the: 'la ', a: 'une ', new: 'nouvelle' },
};

// What a real Claude session takes, roughly; the prototype simulates it in seconds
const DURATION: Record<GeneratedArtifactType, string> = {
  research: '5 à 10 min',
  letter: '2 à 4 min',
  portrait: '3 à 6 min',
  interview_brief: '5 à 10 min',
};

export interface IExplanation {
  // « Générer la Lettre », « Regénérer le Portrait »
  title: string;
  // « la Lettre »
  theLabel: string;
  // « de la Lettre », « du Portrait »
  ofLabel: string;
  // What Claude does, in one sentence
  does: string;
  usesWeb: boolean;
  // « Lettre v3, en Brouillon »
  writes: string;
  // What stays as is meanwhile
  keeps: string;
  duration: string;
}

function explanationOf(
  type: GeneratedArtifactType,
  artifact: IArtifact,
  interview: IInterview | undefined,
  isRegeneration: boolean,
): IExplanation {
  const label = ARTIFACT_LABEL[type];
  const article = ARTICLE[type];
  const nextNumber = (latestVersionOf(artifact)?.number ?? 0) + 1;
  const interviewers = interview?.interviewers.trim() ?? '';
  const interviewName = interview === undefined ? 'l’Entretien' : `l’Entretien ${String(interview.number)}`;
  const doesByType: Record<GeneratedArtifactType, string> = {
    research:
      'Cherche sur le web ce que l’employeur, le service et le lieu attendent de ce poste, et cite chaque source.',
    letter:
      'Rédige ta Lettre de motivation à partir de la Recherche validée et de ton Profil, dans la langue de la Fiche de poste.',
    portrait: `Cherche sur le web ce qui est public sur le parcours et les prises de position de ${interviewers === '' ? 'tes interlocuteurs' : interviewers}, et cite chaque source.`,
    interview_brief: `Croise l’Offre, la Recherche, ta Lettre de motivation et le Portrait pour préparer ${interviewName} : quoi leur dire, quoi réviser, comment t’entraîner.`,
  };
  const chosenNumber = artifact.chosenNumber;
  return {
    title: `${isRegeneration ? 'Regénérer' : 'Générer'} ${article.the}${label}`,
    theLabel: `${article.the}${label}`,
    ofLabel: `${article.the === 'le ' ? 'du ' : 'de la '}${label}`,
    does: doesByType[type],
    usesWeb: type === 'research' || type === 'portrait',
    writes: `${article.a}${article.new} Version, ${label} v${String(nextNumber)}, en Brouillon`,
    keeps:
      chosenNumber === null
        ? 'Rien d’autre ne la lira tant que tu ne l’as pas validée.'
        : `Ta Version retenue (v${String(chosenNumber)}) reste celle que lisent les autres documents tant que tu n’as pas validé le Brouillon.`,
    duration: DURATION[type],
  };
}

function groupOf(input: IInputSpec): InputGroup {
  if (input.mode === 'optional') {
    return 'annex';
  }
  return input.kind === 'profile' || input.kind === 'sent_letter' ? 'profile' : 'posting';
}

// A line of the list: one Input, or a bundle of many alike (the Letters already sent can be dozens)
export type InputItem =
  | { kind: 'input'; input: IPanelInput }
  | { kind: 'bundle'; key: string; title: string; hint: string; inputs: IPanelInput[] };

const BUNDLE_MIN = 3;

export function itemsOf(inputList: IPanelInput[]): InputItem[] {
  const sentList = inputList.filter(({ kind }) => kind === 'sent_letter');
  const isBundled = sentList.length >= BUNDLE_MIN;
  const itemList: InputItem[] = inputList
    .filter((input) => !isBundled || input.kind !== 'sent_letter')
    .map((input) => ({ kind: 'input', input }));
  if (isBundled) {
    itemList.push({
      kind: 'bundle',
      key: 'sent_letter',
      title: 'Lettres de motivation déjà envoyées',
      hint: 'Les Lettres de motivation retenues de tes autres Candidatures, avec leur premier jet : Claude compare les deux pour reprendre ton style. Les 5 plus récentes sont cochées ; ajoute les autres si utile.',
      inputs: sentList,
    });
  }
  return itemList;
}

export function countWords(text: string): number {
  return text.split(/\s+/u).filter((word) => word !== '').length;
}

const NUMBER_FORMAT = new Intl.NumberFormat('fr-FR');

// The checked Inputs in a few words, alike ones counted: « Fiche de poste, Recherche v1, CV, Faits,
// 4 lettres passées, 37 Lettres déjà envoyées »
export function summarizeInputs(inputList: IPanelInput[]): string[] {
  const count = (filter: (input: IPanelInput) => boolean, one: string, many: string) => {
    const total = inputList.filter(filter).length;
    if (total === 0) {
      return [];
    }
    return [total === 1 ? one : `${String(total)} ${many}`];
  };
  const isPastLetter = (input: IPanelInput) =>
    input.kind === 'profile' && input.label.startsWith('Lettre de motivation passée');
  const isAnnex = (input: IPanelInput) => input.kind === 'profile' && input.label.startsWith('Annexe');
  return [
    ...inputList
      .filter((input) => input.kind !== 'sent_letter' && !isPastLetter(input) && !isAnnex(input))
      .map(({ label }) => label.replaceAll(' · ', ' ')),
    ...count(isPastLetter, '1 lettre de motivation passée', 'lettres de motivation passées'),
    ...count(isAnnex, '1 Annexe', 'Annexes'),
    ...count(
      ({ kind }) => kind === 'sent_letter',
      '1 Lettre de motivation déjà envoyée',
      'Lettres de motivation déjà envoyées',
    ),
  ];
}

// « 1 document », « 10 documents »
export function formatDocuments(count: number): string {
  return `${NUMBER_FORMAT.format(count)} document${count > 1 ? 's' : ''}`;
}

// « le document coché », « les 10 documents cochés »
export function checkedPhrase(count: number): string {
  return count === 1 ? 'le document coché' : `les ${String(count)} documents cochés`;
}

export function formatWords(count: number): string {
  return `${NUMBER_FORMAT.format(count)} mot${count > 1 ? 's' : ''}`;
}

// How many Letters already sent a run reads by default, the most recent; the others can be added
export const RECENT_SENT_LETTER_COUNT = 5;

// Checked by default: required and default ones, but only the most recent Letters already sent; on a
// regeneration, as the previous Version read them. The snapshot only records the Artifacts a Version
// read: then only those follow the previous Version.
function initialCheckOf(input: IInputSpec, previous: IVersion | undefined, recentSentKeys: Set<string>): boolean {
  if (input.mode === 'required') {
    return true;
  }
  const isDefault = input.kind === 'sent_letter' ? recentSentKeys.has(input.key) : input.mode === 'default';
  if (previous === undefined || previous.inputs.length === 0) {
    return isDefault;
  }
  const previousKeys = new Set(previous.inputs.map(({ key }) => key));
  const isFullRecord = previous.inputs.some(({ key }) => !key.startsWith('artifact:'));
  if (isFullRecord || input.kind === 'artifact') {
    return previousKeys.has(input.key);
  }
  return isDefault;
}

export interface IGenerationPanelInit {
  artifact: IArtifact;
  posting: IPosting;
  interview?: IInterview | undefined;
}

export function useGenerationPanel({ artifact: artifactProp, posting, interview }: IGenerationPanelInit) {
  const { reference } = posting;
  const detail = usePostingDetail(reference, null);
  // The live Artifact, with the Versions added since the page rendered
  const artifact = detail?.artifacts.find(({ key }) => key === artifactProp.key) ?? artifactProp;
  const type = (artifact.type === 'custom' ? 'research' : artifact.type) satisfies GeneratedArtifactType;
  const specList = useInputs(reference, artifact.key, detail);
  const instructions = useInstructions(type);
  const actions = useActions();
  const runs = useRuns(reference);
  const postings = usePostings();

  // The Version the panel was opened on: the run's own Draft must not prefill it again
  const [previous] = useState(() => latestVersionOf(artifact));
  const isRegeneration = previous !== undefined;
  const [checkOverride, setCheckOverride] = useState<Record<string, boolean>>({});
  const [instructionsDraft, setInstructionsDraft] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const [isSavingInstructions, setIsSavingInstructions] = useState(false);

  // The Letters already sent, most recently applied first: the key of a sent Letter is sent:<reference>
  const recentSentKeys = useMemo(() => {
    const appliedAtByReference = new Map(postings.map(({ reference: other, appliedAt }) => [other, appliedAt ?? '']));
    const appliedAtOf = (key: string) => appliedAtByReference.get(key.replace(/^sent:/u, '')) ?? '';
    return new Set(
      specList
        .filter(({ kind }) => kind === 'sent_letter')
        .map(({ key }) => key)
        .toSorted((first, second) => appliedAtOf(second).localeCompare(appliedAtOf(first)))
        .slice(0, RECENT_SENT_LETTER_COUNT),
    );
  }, [specList, postings]);

  const inputs = useMemo(
    (): IPanelInput[] =>
      specList.map((spec) => ({
        ...spec,
        group: groupOf(spec),
        isChecked:
          spec.mode === 'required' || (checkOverride[spec.key] ?? initialCheckOf(spec, previous, recentSentKeys)),
        wordCount: countWords(spec.content),
      })),
    [specList, checkOverride, previous, recentSentKeys],
  );
  const checkedInputs = inputs.filter(({ isChecked }) => isChecked);
  const checkedWords = checkedInputs.reduce((total, { wordCount }) => total + wordCount, 0);

  const instructionsText = instructionsDraft ?? instructions.text;
  const isInstructionsDirty = instructionsDraft !== null && instructionsDraft !== instructions.text;

  const blockers = [
    ...(artifact.refusal === null ? [] : [artifact.refusal]),
    // Saving the Instructions is its own act: they then apply to every later generation
    ...(isInstructionsDirty
      ? ['Tes modifications des Consignes ne sont pas enregistrées : enregistre-les ou annule-les avant de lancer.']
      : []),
    ...inputs
      .filter(({ mode, isAvailable }) => mode === 'required' && !isAvailable)
      .map(({ label }) => `${label} n’a pas encore de Version validée : valide-la d’abord.`),
  ];

  const run: IRunView | undefined = runs.find(({ id }) => id === runId);
  const explanation = explanationOf(type, artifact, interview, isRegeneration);

  function setChecked(key: string, isChecked: boolean) {
    setCheckOverride((current) => ({ ...current, [key]: isChecked }));
  }

  function setManyChecked(keys: string[], isChecked: boolean) {
    setCheckOverride((current) => ({ ...current, ...Object.fromEntries(keys.map((key) => [key, isChecked])) }));
  }

  async function saveInstructions() {
    if (!isInstructionsDirty) {
      setInstructionsDraft(null);
      return;
    }
    setIsSavingInstructions(true);
    await actions.saveInstructions(type, instructionsDraft);
    setIsSavingInstructions(false);
    setInstructionsDraft(null);
  }

  async function restoreDefaultInstructions() {
    setIsSavingInstructions(true);
    await actions.saveInstructions(type, null);
    setIsSavingInstructions(false);
    setInstructionsDraft(null);
  }

  // « + Ajouter un texte ou un fichier »: a Custom Artifact of the Posting or an Annex, checked at once
  async function addInput({ title, text, scope }: { title: string; text: string; scope: 'posting' | 'profile' }) {
    const key = await actions.addCustomArtifact({
      reference,
      // From a Portrait or an Interview Brief panel, it belongs to that Interview
      interviewNumber: scope === 'posting' ? artifact.interviewNumber : null,
      title,
      text,
      scope,
    });
    setChecked(key, true);
    return key;
  }

  async function launch() {
    setIsLaunching(true);
    const id = await actions.startGeneration({
      reference,
      artifactKey: artifact.key,
      inputs: checkedInputs,
      instructions: instructions.text,
    });
    setRunId(id === '' ? null : id);
    setIsLaunching(false);
  }

  // Everything the AI receives, in Markdown: the Fixed Part, the checked Inputs, then the Instructions
  const promptMarkdown = [
    artifact.fixedPart ?? '',
    '---',
    '# Inputs',
    ...checkedInputs.map(({ label, content }) => `## ${label}\n\n${content.trim()}`),
    '---',
    '# Consignes',
    instructionsText.trim(),
  ].join('\n\n');

  return {
    artifact,
    promptMarkdown,
    posting,
    interview,
    type,
    previous,
    isRegeneration,
    explanation,
    inputs,
    checkedInputs,
    checkedWords,
    blockers,
    canLaunch: blockers.length === 0 && !isLaunching && run === undefined,
    setChecked,
    setManyChecked,
    instructions: {
      text: instructionsText,
      defaultText: instructions.defaultText,
      isCandidate: instructions.isCandidate,
      isDirty: isInstructionsDirty,
      isSaving: isSavingInstructions,
      edit: setInstructionsDraft,
      discard: () => setInstructionsDraft(null),
      save: saveInstructions,
      restoreDefault: restoreDefaultInstructions,
    },
    addInput,
    // Profile-reading Artifacts only: an Annex added elsewhere would not be read
    canAddAnnex: inputs.some(({ kind }) => kind === 'profile'),
    launch,
    isLaunching,
    run,
  };
}

export type GenerationPanelState = ReturnType<typeof useGenerationPanel>;
