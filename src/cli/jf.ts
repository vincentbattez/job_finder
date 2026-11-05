import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';

import { DEFAULT_LOCALE, localeOf, tFor, type Locale } from '#/actions/i18n.ts';
import { codedError, createActions, formatError, type Actions } from '#/actions/index.ts';

import { readTextFile, writeTextFile } from './acl/files.ts';
import { findDefaultOrigin } from './acl/origin.ts';

const DATA_DIRECTORY = path.join(import.meta.dirname, '..', '..', 'data');

// What jf writes, in a locale (ADR-0012); the words several areas share are read with { ns: 'common' }
type Cli = ReturnType<typeof tFor<'cli'>>;

// What jf says before it knows the Candidate a command acts for, as jf help: the default locale
const DEFAULT_CLI = tFor(DEFAULT_LOCALE, 'cli');

// Through the actions only: the CLI never reaches the domain directly (ADR-0003)
type Posting = Awaited<ReturnType<Actions['listPostings']>>[number];
type Recipients = Awaited<ReturnType<Actions['readRecipients']>>;
type ModuleInstructions = Awaited<ReturnType<Actions['listInstructions']>>[number];

// The fields of an Interview jf interviews takes as options, any left out keeping its value on an edit
interface IInterviewOption {
  start?: string | undefined;
  durationMinutes?: string | undefined;
  place?: string | undefined;
  interviewers?: string | undefined;
}

interface ICommand {
  describe: (t: Cli) => string;
  run: (
    actions: Actions,
    argumentList: string[],
    option: {
      isWaiting: boolean;
      isAutomation: boolean;
      isWithoutLetter: boolean;
      interview: IInterviewOption;
      origin: string | undefined;
    },
  ) => Promise<void>;
}

function cliOf(candidate: Parameters<typeof localeOf>[0]): Cli {
  return tFor(localeOf(candidate), 'cli');
}

async function localeOfCandidate(actions: Actions, candidateId: string): Promise<Locale> {
  const candidateList = await actions.listCandidates();
  return localeOf(candidateList.find(({ id }) => id === candidateId));
}

// Each command speaks the locale of the Candidate it acts for (spec #65)
async function cliOfCandidate(actions: Actions, candidateId: string): Promise<Cli> {
  return tFor(await localeOfCandidate(actions, candidateId), 'cli');
}

async function localeOfPosting(actions: Actions, reference: string): Promise<Locale> {
  return localeOf(await actions.readPostingCandidate({ reference }));
}

async function cliOfPosting(actions: Actions, reference: string): Promise<Cli> {
  return tFor(await localeOfPosting(actions, reference), 'cli');
}

function formatAddress({ email, source }: Recipients['ccList'][number], t: Cli): string {
  const fieldLabel = t(`fieldLabelBySource.${source}`);
  return `${email} (${fieldLabel})`;
}

function formatPosting(posting: Posting, t: Cli): string {
  const { repostOf, repostList, deadline, startDate } = posting;
  // The Status as computed, then Expired, Archived and Unpublished beside it, which they leave as it is
  const statusLabelList = [
    t(`statusLabelByStatus.${posting.step}`, { ns: 'common' }),
    ...(posting.isExpired ? [t('expired', { ns: 'common' })] : []),
    ...(posting.archivedAt === null ? [] : [t('archived', { ns: 'common' })]),
    ...(posting.unpublishedAt === null ? [] : [t('unpublished', { ns: 'common' })]),
  ];
  return [
    posting.reference,
    posting.title,
    posting.workplace ?? '—',
    deadline === null ? '—' : t('deadline', { deadline }),
    // Only on the Postings whose Job Description gives one
    ...(startDate === null ? [] : [t('startDate', { startDate })]),
    statusLabelList.join(', '),
    // The link of a Repost, both ways, only on the Postings that have one
    ...(repostOf === null ? [] : [t('repostOf', { reference: repostOf.reference })]),
    ...repostList.map(({ reference }) => t('repostedAs', { reference })),
  ].join('\t');
}

// The terminal where the Candidate answers, one line per question. Ctrl-C or Ctrl-D closes it,
// which ends the answers instead of leaving a question pending forever.
function openTerminal() {
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  // Iterated from the start, so that no line typed ahead is lost
  const lineIterator = readline[Symbol.asyncIterator]();
  return {
    async ask(question: string): Promise<string | undefined> {
      readline.setPrompt(question);
      readline.prompt();
      const { done: isDone, value } = await lineIterator.next();
      return isDone === true ? undefined : value;
    },
    close(): void {
      readline.close();
    },
  };
}

type Terminal = ReturnType<typeof openTerminal>;

interface IChoice<T> {
  question: string;
  itemList: T[];
  label: (item: T) => string;
  // The failure when there is nothing to choose from
  emptyError: () => Error;
}

// A numbered list to pick from on the terminal; a single item needs no question
async function choose<T>(
  terminal: Terminal,
  locale: Locale,
  { question, itemList, label, emptyError }: IChoice<T>,
): Promise<T> {
  const t = tFor(locale, 'cli');
  const [firstItem, ...otherItemList] = itemList;
  if (firstItem === undefined) {
    throw emptyError();
  }
  if (otherItemList.length === 0) {
    process.stdout.write(t('answered', { question, label: label(firstItem) }));
    return firstItem;
  }
  for (const [index, item] of itemList.entries()) {
    process.stdout.write(`${String(index + 1).padStart(3)}  ${label(item)}\n`);
  }
  const answer = await terminal.ask(t('ask', { question, itemCount: itemList.length }));
  if (answer === undefined) {
    throw codedError('no_choice', {}, { locale });
  }
  const item = itemList[Number(answer) - 1];
  if (item === undefined) {
    throw codedError('invalid_choice', { answer }, { locale });
  }
  return item;
}

// Before a Candidate is chosen, no locale but the default one
async function chooseCandidate(actions: Actions, terminal: Terminal) {
  return choose(terminal, DEFAULT_LOCALE, {
    question: DEFAULT_CLI('candidateQuestion'),
    itemList: await actions.listCandidates(),
    label: ({ name }) => name,
    emptyError: () => codedError('no_candidate'),
  });
}

async function chooseReference(actions: Actions, terminal: Terminal): Promise<string> {
  const candidate = await chooseCandidate(actions, terminal);
  const t = cliOf(candidate);
  const posting = await choose(terminal, candidate.locale, {
    question: t('postingQuestion'),
    itemList: await actions.listPostings({ candidateId: candidate.id }),
    label: (item) => formatPosting(item, t),
    emptyError: () => codedError('no_posting', { candidateName: candidate.name }, { locale: candidate.locale }),
  });
  return posting.reference;
}

// From a list, unless given: the Candidate has no reference to remember. An Artifact of an Interview
// takes its number last.
async function chooseArtifact(actions: Actions, [givenReference, givenArtifact, givenInterview]: string[]) {
  if (givenReference !== undefined && givenArtifact !== undefined) {
    return { reference: givenReference, artifact: givenArtifact, interview: givenInterview };
  }
  const terminal = openTerminal();
  try {
    const reference = givenReference ?? (await chooseReference(actions, terminal));
    const locale = await localeOfPosting(actions, reference);
    const t = tFor(locale, 'cli');
    const version = await choose(terminal, locale, {
      question: t('artifactQuestion'),
      itemList: await actions.listChosenVersions({ reference }),
      label: ({ artifact, number, interview }) => {
        const artifactLabel = t(`artifactLabelByArtifact.${artifact}`, { ns: 'common' });
        return interview === null
          ? t('chosenVersionLabel', { artifactLabel, number })
          : t('chosenInterviewVersionLabel', { artifactLabel, number, interviewNumber: interview.number });
      },
      emptyError: () => codedError('no_artifact', { reference }, { locale }),
    });
    return { reference, artifact: version.artifact, interview: version.interview?.number };
  } finally {
    // Claude Code takes the terminal next
    terminal.close();
  }
}

// Typed or redirected from a file: the Markdown ends with the input (Ctrl-D in a terminal), the
// invitation only shown in a terminal
async function readStandardInput(invitation: string): Promise<string> {
  if (process.stdin.isTTY) {
    process.stderr.write(invitation);
  }
  let text = '';
  for await (const chunk of process.stdin) {
    text += String(chunk);
  }
  return text;
}

// The Instructions in effect for a module, or those the operation names; « replace » reads the new
// ones on the standard input
async function runInstructionsOperation(
  actions: Actions,
  locale: Locale,
  { candidateId, module, defaultInstructions, candidateInstructions }: ModuleInstructions & { candidateId: string },
  operation: string | undefined,
): Promise<void> {
  const t = tFor(locale, 'cli');
  switch (operation) {
    case undefined: {
      const headingKey = candidateInstructions === null ? 'defaultInstructionsHeading' : 'candidateInstructionsHeading';
      process.stderr.write(t(headingKey, { module }));
      process.stdout.write(candidateInstructions ?? defaultInstructions);
      return;
    }
    case 'default': {
      process.stdout.write(defaultInstructions);
      return;
    }
    case 'replace': {
      await actions.saveInstructions({
        candidateId,
        module,
        instructions: await readStandardInput(t('typeInstructions')),
      });
      process.stdout.write(t('instructionsReplaced', { module }));
      return;
    }
    case 'delete': {
      await actions.deleteInstructions({ candidateId, module });
      process.stdout.write(t('instructionsDeleted', { module }));
      return;
    }
    default: {
      throw codedError('unknown_operation', { operation }, { locale });
    }
  }
}

// One line per Interview, by date: its number, its start in Paris, its duration, its place and its
// Interviewers on one line
async function printInterviews(actions: Actions, reference: string, t: Cli): Promise<void> {
  const interviewList = await actions.listInterviews({ reference });
  if (interviewList.length === 0) {
    process.stdout.write(t('noInterview', { reference }));
  }
  for (const { number, startAt, durationMinutes, place, interviewers } of interviewList) {
    const columnList = [
      `#${String(number)}`,
      t('dateTime', { ns: 'common', date: startAt }),
      t('interviewMinutes', { minutes: durationMinutes }),
      place === '' ? '—' : place,
      interviewers === '' ? '—' : interviewers.replaceAll('\n', ' / '),
    ];
    process.stdout.write(`${columnList.join('\t')}\n`);
  }
}

function changeStatusCommand(status: Posting['status'], name: string, describe: (t: Cli) => string): ICommand {
  return {
    describe: (t) => t('statusCommandDescription', { description: describe(t), name }),
    run: async (actions, [reference], { isWithoutLetter }) => {
      if (reference === undefined) {
        throw codedError('status_usage', { name });
      }
      await actions.changeStatus({ reference, status, isWithoutLetter });
      const t = await cliOfPosting(actions, reference);
      const statusLabel = t(`statusLabelByStatus.${status}`, { ns: 'common' });
      process.stdout.write(t('statusChanged', { reference, statusLabel }));
    },
  };
}

// The CLI only relays to the actions: no business rule here (ADR-0003). A usage error comes before
// any Candidate is known: in the default locale.
const COMMAND_BY_NAME: Record<string, ICommand> = {
  candidates: {
    describe: (t) => t('candidatesDescription'),
    run: async (actions) => {
      const candidateList = await actions.listCandidates();
      for (const candidate of candidateList) {
        process.stdout.write(`${candidate.id}\t${candidate.name}\n`);
      }
    },
  },
  detect: {
    describe: (t) => t('detectDescription'),
    // The daily automation says so with --automation (.lpm.yml): the front shows how it was started
    run: async (actions, argumentList, { isAutomation }) => {
      const detectionList = await actions.detect({ origin: isAutomation ? 'automation' : 'cli' });
      const candidateList = await actions.listCandidates();
      for (const detection of detectionList) {
        const { watchId, candidateId, isFirstLaunch, newPostingList, nearMissList } = detection;
        const t = cliOf(candidateList.find(({ id }) => id === candidateId));
        const newCount = newPostingList.length;
        const newPostings = newCount === 0 ? t('noNewPosting') : t('newPostings', { newCount });
        const firstLaunch = isFirstLaunch ? t('firstLaunch') : '';
        process.stdout.write(t('detectionSummary', { watchId, candidateId, newPostings, firstLaunch }));
        for (const posting of newPostingList) {
          process.stdout.write(`  ${formatPosting(posting, t)}\n`);
        }
        if (nearMissList.length > 0) {
          process.stdout.write(t('nearMissHeading'));
        }
        for (const { reference, title } of nearMissList) {
          process.stdout.write(`  ${reference}\t${title}\n`);
        }
        // API Géo down fails nothing: the next Detection locates these Postings
        if (detection.locationFailure !== null) {
          process.stderr.write(`${detection.locationFailure}\n`);
        }
      }
      // What the Detection found is printed first; a Detection Summary not sent then fails the run in lpm,
      // said once even when it told the Postings of several Watches
      const failureList = [...new Set(detectionList.flatMap(({ notificationFailureList }) => notificationFailureList))];
      if (failureList.length > 0) {
        throw codedError('notifications_not_sent', { failures: failureList.join('\n') });
      }
    },
  },
  import: {
    describe: (t) => t('importDescription'),
    run: async (actions, [filePath, givenCandidateId], { isWaiting }) => {
      if (filePath === undefined) {
        throw codedError('import_usage');
      }
      // Read before any question, in the locale of the Candidate named, if any
      const givenLocale =
        givenCandidateId === undefined ? DEFAULT_LOCALE : await localeOfCandidate(actions, givenCandidateId);
      const markdown = readTextFile(filePath, givenLocale);
      let candidateId = givenCandidateId;
      if (candidateId === undefined) {
        const terminal = openTerminal();
        try {
          ({ id: candidateId } = await chooseCandidate(actions, terminal));
        } finally {
          terminal.close();
        }
      }
      const locale = await localeOfCandidate(actions, candidateId);
      const t = tFor(locale, 'cli');
      const job = await actions.importJobDescription({ candidateId, fileName: path.basename(filePath), markdown });
      const { reference } = job.posting;
      process.stdout.write(t('imported', { reference, jobId: job.id }));
      if (!isWaiting) {
        process.stdout.write(t('importQueued', { candidateId }));
        return;
      }
      process.stdout.write(t('extractionWaiting'));
      const { state, posting, log, errorCode } = await actions.followJob({ jobId: job.id });
      if (state === 'failed') {
        throw codedError('extraction_failed', { reference, log, errorCode }, { locale });
      }
      process.stdout.write(t('extracted', { postingLine: formatPosting(posting, t), reference }));
    },
  },
  list: {
    describe: (t) => t('listDescription'),
    run: async (actions, [candidateId]) => {
      if (candidateId === undefined) {
        throw codedError('list_usage');
      }
      const postingList = await actions.listPostings({ candidateId });
      const t = await cliOfCandidate(actions, candidateId);
      for (const posting of postingList) {
        process.stdout.write(`${formatPosting(posting, t)}\n`);
      }
    },
  },
  run: {
    describe: (t) => t('runDescription'),
    run: async (actions, [module, reference, interview], { isWaiting }) => {
      if (module === undefined || reference === undefined) {
        throw codedError('run_usage');
      }
      const queuedJob = await actions.runModule({ module, reference, interview });
      const locale = await localeOfPosting(actions, reference);
      const t = tFor(locale, 'cli');
      // jf versions takes the Artifact, which the module of jf run brief is not named after
      const versionsCommand = [
        'jf versions',
        reference,
        queuedJob.module,
        ...(interview === undefined ? [] : [interview]),
      ].join(' ');
      process.stdout.write(t('queued', { module, reference, jobId: queuedJob.id }));
      if (!isWaiting) {
        process.stdout.write(t('runQueued', { versionsCommand }));
        return;
      }
      process.stdout.write(t('runWaiting'));
      const { state, version, log, errorCode } = await actions.followJob({ jobId: queuedJob.id });
      const name = version === null ? module : `${module} v${String(version.number)}`;
      if (state === 'failed') {
        const command = ['jf run', module, reference, ...(interview === undefined ? [] : [interview])].join(' ');
        throw codedError('run_failed', { name, log, command, errorCode }, { locale });
      }
      process.stdout.write(t('runReady', { name, versionsCommand }));
    },
  },
  recipients: {
    describe: (t) => t('recipientsDescription'),
    run: async (actions, [reference]) => {
      if (reference === undefined) {
        throw codedError('recipients_usage');
      }
      const { to, ccList, salutation, justification } = await actions.readRecipients({ reference });
      const t = await cliOfPosting(actions, reference);
      const salutationFieldLabel = salutation.source === null ? null : t(`fieldLabelBySource.${salutation.source}`);
      const salutationSource = salutationFieldLabel === null ? '' : ` (${salutationFieldLabel})`;
      const addresses = ccList.length === 0 ? t('noCc') : ccList.map((address) => formatAddress(address, t)).join(', ');
      const lineList = [
        t('recipient', { address: to === null ? t('noRecipientAddress') : formatAddress(to, t) }),
        t('ccList', { addresses }),
        t('salutation', { text: `${salutation.text}${salutationSource}` }),
        t('justification', { text: justification }),
      ];
      process.stdout.write(`${lineList.join('\n')}\n`);
    },
  },
  versions: {
    describe: (t) => t('versionsDescription'),
    run: async (actions, [reference, artifact, interview]) => {
      if (reference === undefined || artifact === undefined) {
        throw codedError('versions_usage');
      }
      const versionList = await actions.listVersions({ reference, artifact, interview });
      const t = await cliOfPosting(actions, reference);
      for (const { number, state, validation, isChosen, hasCandidateInstructions, createdAt } of versionList) {
        const columnList = [
          `v${String(number)}`,
          t(`versionStateLabelByState.${state}`),
          t(`validationLabelByValidation.${validation}`),
          isChosen ? t('chosenVersion') : '—',
          hasCandidateInstructions ? t('candidateInstructions') : t('defaultInstructions'),
          t('createdAt', { createdAt }),
        ];
        process.stdout.write(`${columnList.join('\t')}\n`);
      }
      // Without --wait, the reason of a failed job is read here, even one that failed before its
      // Version, and why a queued or running one makes no progress (#41)
      const { failure, workerFailure } = await actions.readArtifactState({ reference, artifact, interview });
      if (failure !== null) {
        process.stdout.write(t('lastJobFailed', { errorCode: failure.errorCode ?? '—', log: failure.log }));
      }
      if (workerFailure !== null) {
        process.stdout.write(t('lastJobStalled', workerFailure));
      }
    },
  },
  validate: {
    describe: (t) => t('validateDescription'),
    run: async (actions, [reference, artifact, version, interview]) => {
      if (reference === undefined || artifact === undefined || version === undefined) {
        throw codedError('validate_usage');
      }
      await actions.validateVersion({ reference, artifact, number: version.replace(/^v/, ''), interview });
      const t = await cliOfPosting(actions, reference);
      process.stdout.write(t('versionValidated', { artifact, version, reference }));
    },
  },
  apply: changeStatusCommand('applied', 'apply', (t) => t('applyDescription')),
  'to-apply': changeStatusCommand('to_apply', 'to-apply', (t) => t('toApplyDescription')),
  hired: changeStatusCommand('hired', 'hired', (t) => t('hiredDescription')),
  rejected: changeStatusCommand('rejected', 'rejected', (t) => t('rejectedDescription')),
  'in-progress': changeStatusCommand('applied', 'in-progress', (t) => t('inProgressDescription')),
  archive: {
    describe: (t) => t('statusCommandDescription', { description: t('archiveDescription'), name: 'archive' }),
    run: async (actions, [reference]) => {
      if (reference === undefined) {
        throw codedError('status_usage', { name: 'archive' });
      }
      await actions.archive({ reference });
      const t = await cliOfPosting(actions, reference);
      process.stdout.write(t('postingArchived', { reference }));
    },
  },
  unarchive: {
    describe: (t) => t('statusCommandDescription', { description: t('unarchiveDescription'), name: 'unarchive' }),
    run: async (actions, [reference]) => {
      if (reference === undefined) {
        throw codedError('status_usage', { name: 'unarchive' });
      }
      await actions.unarchive({ reference });
      const t = await cliOfPosting(actions, reference);
      process.stdout.write(t('postingUnarchived', { reference }));
    },
  },
  profile: {
    describe: (t) => t('profileDescription'),
    run: async (actions, [candidateId]) => {
      if (candidateId === undefined) {
        throw codedError('profile_usage');
      }
      await actions.openProfile({ candidateId });
    },
  },
  instructions: {
    describe: (t) => t('instructionsDescription'),
    run: async (actions, [candidateId, module, operation]) => {
      if (candidateId === undefined) {
        throw codedError('instructions_usage');
      }
      const locale = await localeOfCandidate(actions, candidateId);
      const t = tFor(locale, 'cli');
      if (module === undefined) {
        const instructionsList = await actions.listInstructions({ candidateId });
        for (const { module: name, candidateInstructions } of instructionsList) {
          const origin = candidateInstructions === null ? t('defaultInstructions') : t('candidateInstructions');
          process.stdout.write(`${name}\t${origin}\n`);
        }
        return;
      }
      const instructions = await actions.readInstructions({ candidateId, module });
      await runInstructionsOperation(actions, locale, { ...instructions, candidateId }, operation);
    },
  },
  // The same Markdown editing as jf instructions: shown, or replaced by the standard input
  notes: {
    describe: (t) => t('notesDescription'),
    run: async (actions, [reference, operation]) => {
      if (reference === undefined || (operation !== undefined && operation !== 'replace')) {
        throw codedError('notes_usage');
      }
      const t = await cliOfPosting(actions, reference);
      if (operation === undefined) {
        const { posting } = await actions.readPosting({ reference });
        process.stdout.write(posting.notes);
        return;
      }
      await actions.saveNotes({ reference, notes: await readStandardInput(t('typeNotes')) });
      process.stdout.write(t('notesReplaced', { reference }));
    },
  },
  // Numbered per Posting, listed by date; the start is typed in Paris time, as on the front
  interviews: {
    describe: (t) => t('interviewsDescription'),
    run: async (actions, [reference, operation, number], { interview }) => {
      if (reference === undefined) {
        throw codedError('interviews_usage');
      }
      const t = await cliOfPosting(actions, reference);
      switch (operation) {
        case undefined: {
          await printInterviews(actions, reference, t);
          return;
        }
        case 'add': {
          await actions.addInterview({ reference, place: '', interviewers: '', ...interview });
          process.stdout.write(t('interviewAdded', { reference }));
          return;
        }
        case 'edit': {
          await actions.editInterview({ reference, number, ...interview });
          process.stdout.write(t('interviewEdited', { reference, number }));
          return;
        }
        case 'delete': {
          await actions.deleteInterview({ reference, number });
          process.stdout.write(t('interviewDeleted', { reference, number }));
          return;
        }
        default: {
          throw codedError('interviews_usage');
        }
      }
    },
  },
  // Written where the Candidate stands, its links on the address of the front
  ical: {
    describe: (t) => t('icalDescription'),
    run: async (actions, [reference, number], { origin = findDefaultOrigin() }) => {
      if (reference === undefined || number === undefined) {
        throw codedError('ical_usage');
      }
      const locale = await localeOfPosting(actions, reference);
      const { fileName, text } = await actions.readIcalFile({ reference, number, origin });
      writeTextFile(fileName, text, locale);
      process.stdout.write(tFor(locale, 'cli')('icalWritten', { filePath: path.resolve(fileName) }));
    },
  },
  edit: {
    describe: (t) => t('editDescription'),
    run: async (actions, argumentList) => {
      await actions.openArtifact(await chooseArtifact(actions, argumentList));
    },
  },
};

// jf help opens no workspace, so knows no Candidate: in the default locale
function composeHelp(t: Cli): string {
  const commandLineList = [
    ...Object.entries(COMMAND_BY_NAME).map(([name, command]) => [name, command.describe(t)]),
    ['help', t('help.help')],
  ];
  return [
    t('help.title'),
    '',
    t('help.usage'),
    '',
    t('help.commandsHeading'),
    ...commandLineList.map(([name = '', description = '']) => `  ${name.padEnd(12)}${description}`),
    '',
  ].join('\n');
}

async function run(): Promise<void> {
  const { values, positionals: positionalList } = parseArgs({
    options: {
      help: { type: 'boolean', short: 'h' },
      wait: { type: 'boolean' },
      automation: { type: 'boolean' },
      // jf apply: no Letter was sent, not even an older Chosen Version
      'without-letter': { type: 'boolean' },
      // The fields of an Interview, for jf interviews
      start: { type: 'string' },
      duration: { type: 'string' },
      place: { type: 'string' },
      interviewers: { type: 'string' },
      // The address of the front the links of jf ical start with
      origin: { type: 'string' },
    },
    allowPositionals: true,
  });
  const [commandName, ...argumentList] = positionalList;
  if (commandName === undefined || commandName === 'help' || values.help === true) {
    process.stdout.write(composeHelp(DEFAULT_CLI));
    return;
  }
  const command = COMMAND_BY_NAME[commandName];
  if (command === undefined) {
    throw codedError('unknown_command', { commandName });
  }
  const actions = await createActions({ dataDirectory: DATA_DIRECTORY });
  // Imported once by the first launch that found it, then never read again (ADR-0011)
  const obsoleteConfig = await actions.findObsoleteConfig();
  if (obsoleteConfig.path !== null) {
    process.stderr.write(`${DEFAULT_CLI('obsoleteConfig', { configPath: obsoleteConfig.path })}\n`);
  }
  await command.run(actions, argumentList, {
    isWaiting: values.wait === true,
    isAutomation: values.automation === true,
    isWithoutLetter: values['without-letter'] === true,
    origin: values.origin,
    // Only those given: an edit keeps the others
    interview: Object.fromEntries(
      Object.entries({
        start: values.start,
        durationMinutes: values.duration,
        place: values.place,
        interviewers: values.interviewers,
      }).filter(([, value]) => value !== undefined),
    ),
  });
}

try {
  await run();
} catch (error) {
  // The code tells which failure it is, the message what to do (ADR-0015)
  process.stderr.write(`${formatError(error)}\n`);
  process.exitCode = 1;
}
