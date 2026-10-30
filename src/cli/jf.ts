import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';

import { createActions, messageOf, type Actions } from '#/actions/index.ts';
import { ARTEFACT_LABEL_BY_ARTEFACT, STATUT_LABEL_BY_STATUT } from '#/actions/labels.ts';

import { readTextFile } from './acl/files.ts';

const DATA_DIRECTORY = path.join(import.meta.dirname, '..', '..', 'data');

// Through the actions only: the CLI never reaches the domain directly (ADR-0003)
type Offre = Awaited<ReturnType<Actions['listOffres']>>[number];
type Version = Awaited<ReturnType<Actions['listVersions']>>[number];
type Recipients = Awaited<ReturnType<Actions['readRecipients']>>;
type ModuleInstructions = Awaited<ReturnType<Actions['listInstructions']>>[number];

interface ICommand {
  description: string;
  run: (actions: Actions, argumentList: string[], option: { isWaiting: boolean }) => Promise<void>;
}

const VERSION_STATE_LABEL_BY_STATE: Record<Version['state'], string> = {
  running: 'en cours',
  ready: 'prête',
  failed: 'en échec',
};

const FIELD_LABEL_BY_SOURCE: Record<Recipients['ccList'][number]['source'], string> = {
  applicationEmail: 'mail de candidature',
  contact1: 'contact 1',
  contact2: 'contact 2',
};

function formatAddress({ email, source }: Recipients['ccList'][number]): string {
  return `${email} (${FIELD_LABEL_BY_SOURCE[source]})`;
}

function formatOffre(offre: Offre): string {
  const { republicationOf, republicationList } = offre;
  return [
    offre.reference,
    offre.title,
    offre.workplace ?? '—',
    offre.dateLimite?.toLocaleDateString('fr-FR', { timeZone: 'UTC' }) ?? '—',
    offre.isExpiree ? `${STATUT_LABEL_BY_STATUT[offre.statut]}, Expirée` : STATUT_LABEL_BY_STATUT[offre.statut],
    offre.isInZone ? 'Zone' : 'hors Zone',
    // The link of a Republication, both ways, only on the Offres that have one
    ...(republicationOf === null ? [] : [`Republication de ${republicationOf.reference}`]),
    ...republicationList.map(({ reference }) => `Republiée en ${reference}`),
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
async function choose<T>(terminal: Terminal, { question, itemList, label, emptyMessage }: IChoice<T>): Promise<T> {
  const [firstItem, ...otherItemList] = itemList;
  if (firstItem === undefined) {
    throw new Error(emptyMessage);
  }
  if (otherItemList.length === 0) {
    process.stdout.write(`${question} : ${label(firstItem)}\n`);
    return firstItem;
  }
  for (const [index, item] of itemList.entries()) {
    process.stdout.write(`${String(index + 1).padStart(3)}  ${label(item)}\n`);
  }
  const answer = await terminal.ask(`${question} (1 à ${String(itemList.length)}) : `);
  if (answer === undefined) {
    throw new Error('Abandonné : aucun choix.');
  }
  const item = itemList[Number(answer) - 1];
  if (item === undefined) {
    throw new Error(`Choix invalide : ${answer}. Relancer la commande.`);
  }
  return item;
}

async function chooseCandidate(actions: Actions, terminal: Terminal) {
  return choose(terminal, {
    question: 'Candidat',
    itemList: await actions.listCandidates(),
    label: ({ name }) => name,
    emptyMessage: 'Aucun Candidat : en créer un dans la page Candidats du front.',
  });
}

async function chooseReference(actions: Actions, terminal: Terminal): Promise<string> {
  const candidate = await chooseCandidate(actions, terminal);
  const offre = await choose(terminal, {
    question: 'Offre à modifier',
    itemList: await actions.listOffres({ candidateId: candidate.id }),
    label: formatOffre,
    emptyMessage: `Aucune Offre pour ${candidate.name} : « jf detect » cherche les nouvelles Offres.`,
  });
  return offre.reference;
}

// From a list, unless given: the Candidate has no reference to remember
async function chooseArtefact(actions: Actions, [givenReference, givenArtefact]: string[]) {
  if (givenReference !== undefined && givenArtefact !== undefined) {
    return { reference: givenReference, artefact: givenArtefact };
  }
  const terminal = openTerminal();
  try {
    const reference = givenReference ?? (await chooseReference(actions, terminal));
    const version = await choose(terminal, {
      question: 'Artefact à modifier',
      itemList: await actions.listVersionsRetenues({ reference }),
      label: ({ artefact, number }) => `${ARTEFACT_LABEL_BY_ARTEFACT[artefact]} (v${String(number)}, retenue)`,
      emptyMessage: `L'Offre ${reference} n'a aucun Artefact à modifier : « jf run recherche ${reference} » produit sa Recherche.`,
    });
    return { reference, artefact: version.artefact };
  } finally {
    // Claude Code takes the terminal next
    terminal.close();
  }
}

// Typed or redirected from a file: the Instructions end with the input (Ctrl-D in a terminal)
async function readStandardInput(): Promise<string> {
  if (process.stdin.isTTY) {
    process.stderr.write('Tapez ou collez les Consignes, puis Ctrl-D :\n');
  }
  let text = '';
  for await (const chunk of process.stdin) {
    text += String(chunk);
  }
  return text;
}

const INSTRUCTIONS_USAGE =
  'Usage : jf instructions <candidat> [<module> [default|replace|delete]], par exemple jf instructions lea lettre.';

// The Instructions in effect for a module, or those the operation names; « replace » reads the new
// ones on the standard input
async function runInstructionsOperation(
  actions: Actions,
  { candidateId, module, defaultInstructions, candidateInstructions }: ModuleInstructions & { candidateId: string },
  operation: string | undefined,
): Promise<void> {
  switch (operation) {
    case undefined: {
      const origin = candidateInstructions === null ? 'par défaut' : 'du Candidat';
      process.stderr.write(`Consignes ${origin} de ${module} :\n`);
      process.stdout.write(candidateInstructions ?? defaultInstructions);
      return;
    }
    case 'default': {
      process.stdout.write(defaultInstructions);
      return;
    }
    case 'replace': {
      await actions.saveInstructions({ candidateId, module, instructions: await readStandardInput() });
      process.stdout.write(`${module} suivra ces Consignes du Candidat dans ses prochaines Versions.\n`);
      return;
    }
    case 'delete': {
      await actions.deleteInstructions({ candidateId, module });
      process.stdout.write(`${module} revient à ses Consignes par défaut.\n`);
      return;
    }
    default: {
      throw new Error(`Opération inconnue : ${operation}. ${INSTRUCTIONS_USAGE}`);
    }
  }
}

function changeStatutCommand(statut: Offre['statut'], name: string, description: string): ICommand {
  return {
    description: `${description} : jf ${name} <offre>`,
    run: async (actions, [reference]) => {
      if (reference === undefined) {
        throw new Error(`Usage : jf ${name} <offre>. « jf list <candidat> » liste les Offres.`);
      }
      await actions.changeStatut({ reference, statut });
      process.stdout.write(`${reference} : ${STATUT_LABEL_BY_STATUT[statut]}\n`);
    },
  };
}

// The CLI only relays to the actions: no business rule here (ADR-0003)
const COMMAND_BY_NAME: Record<string, ICommand> = {
  candidates: {
    description: 'Liste les Candidats, que la page Candidats du front crée et renomme',
    run: async (actions) => {
      const candidateList = await actions.listCandidates();
      for (const candidate of candidateList) {
        process.stdout.write(`${candidate.id}\t${candidate.name}\n`);
      }
    },
  },
  detect: {
    description: 'Cherche les nouvelles Offres de chaque Veille',
    run: async (actions) => {
      const detectionList = await actions.detect();
      for (const detection of detectionList) {
        const { watchId, candidateId, isFirstLaunch, newOffreList, nearMissList } = detection;
        const summary =
          newOffreList.length === 0 ? 'aucune nouvelle Offre' : `${String(newOffreList.length)} nouvelles Offres`;
        const firstLaunch = isFirstLaunch ? ', premier lancement : importées sans rien déclencher' : '';
        process.stdout.write(`Veille ${watchId} (${candidateId}) : ${summary}${firstLaunch}\n`);
        for (const offre of newOffreList) {
          process.stdout.write(`  ${formatOffre(offre)}\n`);
        }
        if (nearMissList.length > 0) {
          process.stdout.write('Titres écartés de justesse :\n');
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
    description:
      "Importe une Fiche de poste en Markdown trouvée ailleurs : le worker en relève les champs avec Claude Code, puis met sa Recherche en file ; Candidat proposé si absent, --wait attend l'extraction : jf import <fichier> [<candidat>] [--wait]",
    run: async (actions, [filePath, givenCandidateId], { isWaiting }) => {
      if (filePath === undefined) {
        throw new Error(
          'Usage : jf import <fichier> [<candidat>] [--wait], par exemple jf import offre-greffier.md lea.',
        );
      }
      const markdown = readTextFile(filePath);
      let candidateId = givenCandidateId;
      if (candidateId === undefined) {
        const terminal = openTerminal();
        try {
          ({ id: candidateId } = await chooseCandidate(actions, terminal));
        } finally {
          terminal.close();
        }
      }
      const job = await actions.importFicheDePoste({ candidateId, fileName: path.basename(filePath), markdown });
      const { reference } = job.offre;
      process.stdout.write(`Offre ${reference} importée, extraction de ses champs en file (job ${String(job.id)}).\n`);
      if (!isWaiting) {
        process.stdout.write(
          `Le worker la lance, puis met sa Recherche en file. « jf list ${candidateId} » la montre.\n`,
        );
        return;
      }
      process.stdout.write('Attente du worker (service lpm worker) : Claude Code relève les champs…\n');
      const { state, offre, log } = await actions.followJob({ jobId: job.id });
      if (state === 'failed') {
        throw new Error(
          `Extraction des champs de l'Offre ${reference} en échec :\n${log}\nRelancer : jf run extraction ${reference}`,
        );
      }
      process.stdout.write(
        `${formatOffre(offre)}\nSa Recherche est en file : « jf versions ${reference} recherche » la suit.\n`,
      );
    },
  },
  list: {
    description: "Liste les Offres d'un Candidat : jf list <candidat>",
    run: async (actions, [candidateId]) => {
      if (candidateId === undefined) {
        throw new Error('Usage : jf list <candidat>. « jf candidates » liste les Candidats.');
      }
      const offreList = await actions.listOffres({ candidateId });
      for (const offre of offreList) {
        process.stdout.write(`${formatOffre(offre)}\n`);
      }
    },
  },
  run: {
    description:
      "Met en file une nouvelle Version d'un Artefact, que le worker produit avec Claude Code ; --wait attend la fin : jf run recherche|lettre|fiche|visualisation <offre> [--wait]",
    run: async (actions, [module, reference], { isWaiting }) => {
      if (module === undefined || reference === undefined) {
        throw new Error('Usage : jf run <module> <offre> [--wait], par exemple jf run recherche 2026-2445600.');
      }
      const queuedJob = await actions.runModule({ module, reference });
      // jf versions takes the Artefact, which the module of jf run fiche is not named after
      const versionsCommand = `jf versions ${reference} ${queuedJob.module}`;
      process.stdout.write(`${module} de l'Offre ${reference} en file (job ${String(queuedJob.id)}).\n`);
      if (!isWaiting) {
        process.stdout.write(`Le worker la produira. « ${versionsCommand} » suit ses Versions.\n`);
        return;
      }
      process.stdout.write('Attente du worker (service lpm worker) : Claude Code peut prendre plusieurs minutes…\n');
      const { state, version, log } = await actions.followJob({ jobId: queuedJob.id });
      const name = version === null ? module : `${module} v${String(version.number)}`;
      if (state === 'failed') {
        throw new Error(`${name} en échec :\n${log}\nRelancer : jf run ${module} ${reference}`);
      }
      process.stdout.write(`${name} prête et retenue. « ${versionsCommand} » liste ses Versions.\n`);
    },
  },
  destinataires: {
    description: 'Affiche à qui adresser la candidature, selon la Lettre retenue : jf destinataires <offre>',
    run: async (actions, [reference]) => {
      if (reference === undefined) {
        throw new Error('Usage : jf destinataires <offre>, par exemple jf destinataires 2026-2445600.');
      }
      const { to, ccList, salutation, justification } = await actions.readRecipients({ reference });
      const salutationSource = salutation.source === null ? '' : ` (${FIELD_LABEL_BY_SOURCE[salutation.source]})`;
      const lineList = [
        `Destinataire : ${to === null ? "aucune adresse dans l'Offre" : formatAddress(to)}`,
        `Copie : ${ccList.length === 0 ? 'aucune' : ccList.map((address) => formatAddress(address)).join(', ')}`,
        `Formule d'appel : ${salutation.text}${salutationSource}`,
        `Justification : ${justification}`,
      ];
      process.stdout.write(`${lineList.join('\n')}\n`);
    },
  },
  versions: {
    description: "Liste les Versions d'un Artefact : jf versions <offre> recherche",
    run: async (actions, [reference, artefact]) => {
      if (reference === undefined || artefact === undefined) {
        throw new Error('Usage : jf versions <offre> <artefact>, par exemple jf versions 2026-2445600 recherche.');
      }
      const versionList = await actions.listVersions({ reference, artefact });
      for (const { number, state, isRetenue, hasCandidateInstructions, createdAt } of versionList) {
        const columnList = [
          `v${String(number)}`,
          VERSION_STATE_LABEL_BY_STATE[state],
          isRetenue ? 'retenue' : '—',
          hasCandidateInstructions ? 'Consignes du Candidat' : 'Consignes par défaut',
        ];
        process.stdout.write(`${[...columnList, createdAt.toLocaleString('fr-FR')].join('\t')}\n`);
      }
    },
  },
  retenir: {
    description: "Change la Version retenue d'un Artefact : jf retenir <offre> recherche <version>",
    run: async (actions, [reference, artefact, version]) => {
      if (reference === undefined || artefact === undefined || version === undefined) {
        throw new Error(
          'Usage : jf retenir <offre> <artefact> <version>, par exemple jf retenir 2026-2445600 recherche 2.',
        );
      }
      await actions.retenirVersion({ reference, artefact, number: version.replace(/^v/, '') });
      process.stdout.write(`${artefact} ${version} retenue pour l'Offre ${reference}.\n`);
    },
  },
  postuler: changeStatutCommand(
    'postulee',
    'postuler',
    'Passe une Offre en Postulée, avec ou sans Lettre, ce qui fige sa Lettre pour de bon ; remet en Postulée une Offre Postulée puis Archivée',
  ),
  archiver: changeStatutCommand('archivee', 'archiver', 'Passe une Offre en Archivée, Postulée ou non'),
  traiter: changeStatutCommand(
    'a_traiter',
    'traiter',
    "Remet À traiter une Offre Archivée qui n'a jamais été Postulée",
  ),
  profile: {
    description: "Complète le Profil d'un Candidat avec Claude Code : jf profile <candidat>",
    run: async (actions, [candidateId]) => {
      if (candidateId === undefined) {
        throw new Error('Usage : jf profile <candidat>. « jf candidates » liste les Candidats.');
      }
      await actions.openProfile({ candidateId });
    },
  },
  instructions: {
    description:
      "Montre, remplace (lues sur l'entrée standard) ou supprime les Consignes d'un module : jf instructions <candidat> [<module> [default|replace|delete]]",
    run: async (actions, [candidateId, module, operation]) => {
      if (candidateId === undefined) {
        throw new Error(`${INSTRUCTIONS_USAGE} « jf candidates » liste les Candidats.`);
      }
      if (module === undefined) {
        const instructionsList = await actions.listInstructions({ candidateId });
        for (const { module: name, candidateInstructions } of instructionsList) {
          process.stdout.write(
            `${name}\t${candidateInstructions === null ? 'Consignes par défaut' : 'Consignes du Candidat'}\n`,
          );
        }
        return;
      }
      const instructions = await actions.readInstructions({ candidateId, module });
      await runInstructionsOperation(actions, { ...instructions, candidateId }, operation);
    },
  },
  edit: {
    description:
      'Modifie un Artefact avec Claude Code, Offre et Artefact proposés si absents : jf edit [<offre> [<artefact>]]',
    run: async (actions, argumentList) => {
      await actions.openArtefact(await chooseArtefact(actions, argumentList));
    },
  },
};

const COMMAND_LINE_LIST = [
  ...Object.entries(COMMAND_BY_NAME).map(([name, command]) => [name, command.description]),
  ['help', 'Affiche cette aide'],
];

const HELP = [
  "jf : veille d'offres et préparation des candidatures",
  '',
  'Usage : jf <commande>',
  '',
  'Commandes :',
  ...COMMAND_LINE_LIST.map(([name = '', description = '']) => `  ${name.padEnd(12)}${description}`),
  '',
].join('\n');

async function run(): Promise<void> {
  const { values, positionals: positionalList } = parseArgs({
    options: { help: { type: 'boolean', short: 'h' }, wait: { type: 'boolean' } },
    allowPositionals: true,
  });
  const [commandName, ...argumentList] = positionalList;
  if (commandName === undefined || commandName === 'help' || values.help === true) {
    process.stdout.write(HELP);
    return;
  }
  const command = COMMAND_BY_NAME[commandName];
  if (command === undefined) {
    throw new Error(`Commande inconnue : ${commandName}. « jf help » liste les commandes.`);
  }
  const actions = await createActions({ dataDirectory: DATA_DIRECTORY });
  // Imported once by the first launch that found it, then never read again (ADR-0011)
  const obsoleteConfig = await actions.findObsoleteConfig();
  if (obsoleteConfig.path !== null) {
    process.stderr.write(
      `${obsoleteConfig.path} n'est plus lu : son contenu est en base, et les Candidats, leurs Veilles et le Délai par défaut se règlent désormais dans le front. Le supprimer.\n`,
    );
  }
  await command.run(actions, argumentList, { isWaiting: values.wait === true });
}

try {
  await run();
} catch (error) {
  process.stderr.write(`${messageOf(error)}\n`);
  process.exitCode = 1;
}
