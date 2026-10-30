import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';

import { catalogueOf, type Catalogue } from '#/actions/catalogue.ts';
import { localeOf, tFor, type Locale } from '#/actions/i18n.ts';
import { createActions, messageOf, type Actions } from '#/actions/index.ts';

import { readTextFile } from './acl/files.ts';

const DATA_DIRECTORY = path.join(import.meta.dirname, '..', '..', 'data');

// The copy of a locale: the former catalogue for the areas not yet moved to i18next, and the t function
// of the common area (ADR-0012)
type Copy = Catalogue & { t: ReturnType<typeof tFor<'common'>> };

function copyOf(candidate: { locale: Locale } | null | undefined): Copy {
  return { ...catalogueOf(candidate), t: tFor(localeOf(candidate), 'common') };
}

// What jf says before it knows the Candidate a command acts for, as jf help: the default locale
const DEFAULT_COPY = copyOf(null);

// Through the actions only: the CLI never reaches the domain directly (ADR-0003)
type Posting = Awaited<ReturnType<Actions['listPostings']>>[number];
type Recipients = Awaited<ReturnType<Actions['readRecipients']>>;
type ModuleInstructions = Awaited<ReturnType<Actions['listInstructions']>>[number];
type Cli = Catalogue['cli'];

interface ICommand {
  describe: (cli: Cli) => string;
  run: (actions: Actions, argumentList: string[], option: { isWaiting: boolean }) => Promise<void>;
}

// Each command speaks the locale of the Candidate it acts for (spec #65)
async function copyOfCandidate(actions: Actions, candidateId: string): Promise<Copy> {
  const candidateList = await actions.listCandidates();
  return copyOf(candidateList.find(({ id }) => id === candidateId));
}

async function copyOfPosting(actions: Actions, reference: string): Promise<Copy> {
  return copyOf(await actions.readPostingCandidate({ reference }));
}

function formatAddress({ email, source }: Recipients['ccList'][number], cli: Cli): string {
  return `${email} (${cli.fieldLabelBySource[source]})`;
}

function formatPosting(posting: Posting, { cli, t }: Copy): string {
  const { repostOf, repostList } = posting;
  const statusLabel = t(`statusLabelByStatus.${posting.status}`);
  return [
    posting.reference,
    posting.title,
    posting.workplace ?? '—',
    posting.deadline === null ? '—' : cli.formatDeadline(posting.deadline),
    posting.isExpired ? `${statusLabel}, ${t('expired')}` : statusLabel,
    posting.isInZone ? cli.inZone : cli.outOfZone,
    // The link of a Repost, both ways, only on the Postings that have one
    ...(repostOf === null ? [] : [cli.repostOf(repostOf.reference)]),
    ...repostList.map(({ reference }) => cli.repostedAs(reference)),
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
  emptyMessage: string;
}

// A numbered list to pick from on the terminal; a single item needs no question
async function choose<T>(
  terminal: Terminal,
  cli: Cli,
  { question, itemList, label, emptyMessage }: IChoice<T>,
): Promise<T> {
  const [firstItem, ...otherItemList] = itemList;
  if (firstItem === undefined) {
    throw new Error(emptyMessage);
  }
  if (otherItemList.length === 0) {
    process.stdout.write(cli.answered(question, label(firstItem)));
    return firstItem;
  }
  for (const [index, item] of itemList.entries()) {
    process.stdout.write(`${String(index + 1).padStart(3)}  ${label(item)}\n`);
  }
  const answer = await terminal.ask(cli.ask(question, itemList.length));
  if (answer === undefined) {
    throw new Error(cli.noChoice);
  }
  const item = itemList[Number(answer) - 1];
  if (item === undefined) {
    throw new Error(cli.invalidChoice(answer));
  }
  return item;
}

// Before a Candidate is chosen, no locale but the default one
async function chooseCandidate(actions: Actions, terminal: Terminal) {
  const { cli } = DEFAULT_COPY;
  return choose(terminal, cli, {
    question: cli.candidateQuestion,
    itemList: await actions.listCandidates(),
    label: ({ name }) => name,
    emptyMessage: cli.noCandidate,
  });
}

async function chooseReference(actions: Actions, terminal: Terminal): Promise<string> {
  const candidate = await chooseCandidate(actions, terminal);
  const catalogue = copyOf(candidate);
  const posting = await choose(terminal, catalogue.cli, {
    question: catalogue.cli.postingQuestion,
    itemList: await actions.listPostings({ candidateId: candidate.id }),
    label: (item) => formatPosting(item, catalogue),
    emptyMessage: catalogue.cli.noPosting(candidate.name),
  });
  return posting.reference;
}

// From a list, unless given: the Candidate has no reference to remember
async function chooseArtifact(actions: Actions, [givenReference, givenArtifact]: string[]) {
  if (givenReference !== undefined && givenArtifact !== undefined) {
    return { reference: givenReference, artifact: givenArtifact };
  }
  const terminal = openTerminal();
  try {
    const reference = givenReference ?? (await chooseReference(actions, terminal));
    const { cli, t } = await copyOfPosting(actions, reference);
    const version = await choose(terminal, cli, {
      question: cli.artifactQuestion,
      itemList: await actions.listChosenVersions({ reference }),
      label: ({ artifact, number }) => cli.chosenVersionLabel(t(`artifactLabelByArtifact.${artifact}`), number),
      emptyMessage: cli.noArtifact(reference),
    });
    return { reference, artifact: version.artifact };
  } finally {
    // Claude Code takes the terminal next
    terminal.close();
  }
}

// Typed or redirected from a file: the Instructions end with the input (Ctrl-D in a terminal)
async function readStandardInput(cli: Cli): Promise<string> {
  if (process.stdin.isTTY) {
    process.stderr.write(cli.typeInstructions);
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
  cli: Cli,
  { candidateId, module, defaultInstructions, candidateInstructions }: ModuleInstructions & { candidateId: string },
  operation: string | undefined,
): Promise<void> {
  switch (operation) {
    case undefined: {
      process.stderr.write(cli.instructionsHeading(module, candidateInstructions !== null));
      process.stdout.write(candidateInstructions ?? defaultInstructions);
      return;
    }
    case 'default': {
      process.stdout.write(defaultInstructions);
      return;
    }
    case 'replace': {
      await actions.saveInstructions({ candidateId, module, instructions: await readStandardInput(cli) });
      process.stdout.write(cli.instructionsReplaced(module));
      return;
    }
    case 'delete': {
      await actions.deleteInstructions({ candidateId, module });
      process.stdout.write(cli.instructionsDeleted(module));
      return;
    }
    default: {
      throw new Error(cli.unknownOperation(operation));
    }
  }
}

function changeStatusCommand(status: Posting['status'], name: string, describe: (cli: Cli) => string): ICommand {
  return {
    describe: (cli) => cli.statusCommandDescription(describe(cli), name),
    run: async (actions, [reference]) => {
      if (reference === undefined) {
        throw new Error(DEFAULT_COPY.cli.statusUsage(name));
      }
      await actions.changeStatus({ reference, status });
      const { cli, t } = await copyOfPosting(actions, reference);
      process.stdout.write(cli.statusChanged(reference, t(`statusLabelByStatus.${status}`)));
    },
  };
}

// The CLI only relays to the actions: no business rule here (ADR-0003). A usage error comes before
// any Candidate is known: in the default locale.
const COMMAND_BY_NAME: Record<string, ICommand> = {
  candidates: {
    describe: (cli) => cli.candidatesDescription,
    run: async (actions) => {
      const candidateList = await actions.listCandidates();
      for (const candidate of candidateList) {
        process.stdout.write(`${candidate.id}\t${candidate.name}\n`);
      }
    },
  },
  detect: {
    describe: (cli) => cli.detectDescription,
    run: async (actions) => {
      const detectionList = await actions.detect();
      const candidateList = await actions.listCandidates();
      for (const detection of detectionList) {
        const { watchId, candidateId, isFirstLaunch, newPostingList, nearMissList } = detection;
        const catalogue = copyOf(candidateList.find(({ id }) => id === candidateId));
        const { cli } = catalogue;
        process.stdout.write(cli.detectionSummary(watchId, candidateId, newPostingList.length, isFirstLaunch));
        for (const posting of newPostingList) {
          process.stdout.write(`  ${formatPosting(posting, catalogue)}\n`);
        }
        if (nearMissList.length > 0) {
          process.stdout.write(cli.nearMissHeading);
        }
        for (const { reference, title } of nearMissList) {
          process.stdout.write(`  ${reference}\t${title}\n`);
        }
      }
      // What the Detection found is printed first; a notification not sent then fails the run in lpm
      const failureList = detectionList.flatMap(({ notificationFailureList }) => notificationFailureList);
      if (failureList.length > 0) {
        throw new Error(failureList.join('\n'));
      }
    },
  },
  import: {
    describe: (cli) => cli.importDescription,
    run: async (actions, [filePath, givenCandidateId], { isWaiting }) => {
      if (filePath === undefined) {
        throw new Error(DEFAULT_COPY.cli.importUsage);
      }
      // Read before any question, in the locale of the Candidate named, if any
      const { cli: givenCli } =
        givenCandidateId === undefined ? DEFAULT_COPY : await copyOfCandidate(actions, givenCandidateId);
      const markdown = readTextFile(filePath, givenCli.unreadableFile);
      let candidateId = givenCandidateId;
      if (candidateId === undefined) {
        const terminal = openTerminal();
        try {
          ({ id: candidateId } = await chooseCandidate(actions, terminal));
        } finally {
          terminal.close();
        }
      }
      const catalogue = await copyOfCandidate(actions, candidateId);
      const { cli } = catalogue;
      const job = await actions.importJobDescription({ candidateId, fileName: path.basename(filePath), markdown });
      const { reference } = job.posting;
      process.stdout.write(cli.imported(reference, job.id));
      if (!isWaiting) {
        process.stdout.write(cli.importQueued(candidateId));
        return;
      }
      process.stdout.write(cli.extractionWaiting);
      const { state, posting, log } = await actions.followJob({ jobId: job.id });
      if (state === 'failed') {
        throw new Error(cli.extractionFailed(reference, log));
      }
      process.stdout.write(cli.extracted(formatPosting(posting, catalogue), reference));
    },
  },
  list: {
    describe: (cli) => cli.listDescription,
    run: async (actions, [candidateId]) => {
      if (candidateId === undefined) {
        throw new Error(DEFAULT_COPY.cli.listUsage);
      }
      const postingList = await actions.listPostings({ candidateId });
      const catalogue = await copyOfCandidate(actions, candidateId);
      for (const posting of postingList) {
        process.stdout.write(`${formatPosting(posting, catalogue)}\n`);
      }
    },
  },
  run: {
    describe: (cli) => cli.runDescription,
    run: async (actions, [module, reference], { isWaiting }) => {
      if (module === undefined || reference === undefined) {
        throw new Error(DEFAULT_COPY.cli.runUsage);
      }
      const queuedJob = await actions.runModule({ module, reference });
      const { cli } = await copyOfPosting(actions, reference);
      // jf versions takes the Artifact, which the module of jf run brief is not named after
      const versionsCommand = `jf versions ${reference} ${queuedJob.module}`;
      process.stdout.write(cli.queued(module, reference, queuedJob.id));
      if (!isWaiting) {
        process.stdout.write(cli.runQueued(versionsCommand));
        return;
      }
      process.stdout.write(cli.runWaiting);
      const { state, version, log } = await actions.followJob({ jobId: queuedJob.id });
      const name = version === null ? module : `${module} v${String(version.number)}`;
      if (state === 'failed') {
        throw new Error(cli.runFailed(name, log, module, reference));
      }
      process.stdout.write(cli.runReady(name, versionsCommand));
    },
  },
  recipients: {
    describe: (cli) => cli.recipientsDescription,
    run: async (actions, [reference]) => {
      if (reference === undefined) {
        throw new Error(DEFAULT_COPY.cli.recipientsUsage);
      }
      const { to, ccList, salutation, justification } = await actions.readRecipients({ reference });
      const { cli } = await copyOfPosting(actions, reference);
      const salutationSource = salutation.source === null ? '' : ` (${cli.fieldLabelBySource[salutation.source]})`;
      const lineList = [
        cli.recipient(to === null ? null : formatAddress(to, cli)),
        cli.ccList(ccList.map((address) => formatAddress(address, cli))),
        cli.salutation(`${salutation.text}${salutationSource}`),
        cli.justification(justification),
      ];
      process.stdout.write(`${lineList.join('\n')}\n`);
    },
  },
  versions: {
    describe: (cli) => cli.versionsDescription,
    run: async (actions, [reference, artifact]) => {
      if (reference === undefined || artifact === undefined) {
        throw new Error(DEFAULT_COPY.cli.versionsUsage);
      }
      const versionList = await actions.listVersions({ reference, artifact });
      const { cli } = await copyOfPosting(actions, reference);
      for (const { number, state, isChosen, hasCandidateInstructions, createdAt } of versionList) {
        const columnList = [
          `v${String(number)}`,
          cli.versionStateLabelByState[state],
          isChosen ? cli.chosenVersion : '—',
          hasCandidateInstructions ? cli.candidateInstructions : cli.defaultInstructions,
          cli.formatCreatedAt(createdAt),
        ];
        process.stdout.write(`${columnList.join('\t')}\n`);
      }
    },
  },
  choose: {
    describe: (cli) => cli.chooseDescription,
    run: async (actions, [reference, artifact, version]) => {
      if (reference === undefined || artifact === undefined || version === undefined) {
        throw new Error(DEFAULT_COPY.cli.chooseUsage);
      }
      await actions.chooseVersion({ reference, artifact, number: version.replace(/^v/, '') });
      const { cli } = await copyOfPosting(actions, reference);
      process.stdout.write(cli.versionChosen(artifact, version, reference));
    },
  },
  apply: changeStatusCommand('applied', 'apply', (cli) => cli.applyDescription),
  archive: changeStatusCommand('archived', 'archive', (cli) => cli.archiveDescription),
  'to-apply': changeStatusCommand('to_apply', 'to-apply', (cli) => cli.toApplyDescription),
  profile: {
    describe: (cli) => cli.profileDescription,
    run: async (actions, [candidateId]) => {
      if (candidateId === undefined) {
        throw new Error(DEFAULT_COPY.cli.profileUsage);
      }
      await actions.openProfile({ candidateId });
    },
  },
  instructions: {
    describe: (cli) => cli.instructionsDescription,
    run: async (actions, [candidateId, module, operation]) => {
      if (candidateId === undefined) {
        throw new Error(DEFAULT_COPY.cli.instructionsUsage);
      }
      const { cli } = await copyOfCandidate(actions, candidateId);
      if (module === undefined) {
        const instructionsList = await actions.listInstructions({ candidateId });
        for (const { module: name, candidateInstructions } of instructionsList) {
          const origin = candidateInstructions === null ? cli.defaultInstructions : cli.candidateInstructions;
          process.stdout.write(`${name}\t${origin}\n`);
        }
        return;
      }
      const instructions = await actions.readInstructions({ candidateId, module });
      await runInstructionsOperation(actions, cli, { ...instructions, candidateId }, operation);
    },
  },
  edit: {
    describe: (cli) => cli.editDescription,
    run: async (actions, argumentList) => {
      await actions.openArtifact(await chooseArtifact(actions, argumentList));
    },
  },
};

// jf help opens no workspace, so knows no Candidate: in the default locale
function composeHelp({ cli }: Catalogue): string {
  const commandLineList = [
    ...Object.entries(COMMAND_BY_NAME).map(([name, command]) => [name, command.describe(cli)]),
    ['help', cli.help.help],
  ];
  return [
    cli.help.title,
    '',
    cli.help.usage,
    '',
    cli.help.commandsHeading,
    ...commandLineList.map(([name = '', description = '']) => `  ${name.padEnd(12)}${description}`),
    '',
  ].join('\n');
}

async function run(): Promise<void> {
  const { values, positionals: positionalList } = parseArgs({
    options: { help: { type: 'boolean', short: 'h' }, wait: { type: 'boolean' } },
    allowPositionals: true,
  });
  const [commandName, ...argumentList] = positionalList;
  if (commandName === undefined || commandName === 'help' || values.help === true) {
    process.stdout.write(composeHelp(DEFAULT_COPY));
    return;
  }
  const command = COMMAND_BY_NAME[commandName];
  if (command === undefined) {
    throw new Error(DEFAULT_COPY.cli.unknownCommand(commandName));
  }
  const actions = await createActions({ dataDirectory: DATA_DIRECTORY });
  // Imported once by the first launch that found it, then never read again (ADR-0011)
  const obsoleteConfig = await actions.findObsoleteConfig();
  if (obsoleteConfig.path !== null) {
    process.stderr.write(`${DEFAULT_COPY.cli.obsoleteConfig(obsoleteConfig.path)}\n`);
  }
  await command.run(actions, argumentList, { isWaiting: values.wait === true });
}

try {
  await run();
} catch (error) {
  process.stderr.write(`${messageOf(error)}\n`);
  process.exitCode = 1;
}
