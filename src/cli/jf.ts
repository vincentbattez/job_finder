import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';

import { createActions, type Actions } from '#/actions/index.ts';

const DATA_DIRECTORY = path.join(import.meta.dirname, '..', '..', 'data');

// Through the actions only: the CLI never reaches the domain directly (ADR-0003)
type Offre = Awaited<ReturnType<Actions['listOffres']>>[number];
type Version = Awaited<ReturnType<Actions['listVersions']>>[number];
type Recipients = Awaited<ReturnType<Actions['readRecipients']>>;

interface ICommand {
  description: string;
  run: (actions: Actions, argumentList: string[], option: { isWaiting: boolean }) => Promise<void>;
}

const STATUT_LABEL_BY_STATUS: Record<Offre['status'], string> = {
  a_traiter: 'À traiter',
  postulee: 'Postulée',
  archivee: 'Archivée',
};

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
    offre.isExpiree ? `${STATUT_LABEL_BY_STATUS[offre.status]}, Expirée` : STATUT_LABEL_BY_STATUS[offre.status],
    offre.isInZone ? 'Zone' : 'hors Zone',
    // The link of a Republication, both ways, only on the Offres that have one
    ...(republicationOf === null ? [] : [`Republication de ${republicationOf.reference}`]),
    ...republicationList.map(({ reference }) => `Republiée en ${reference}`),
  ].join('\t');
}

const ARTEFACT_LABEL_BY_ARTEFACT: Record<Version['artefact'], string> = {
  recherche: 'Recherche',
  lettre: 'Lettre',
  fiche_entretien: "Fiche d'entretien",
  visualisation: 'Visualisation',
};

// The terminal where the Candidat answers, one line per question. Ctrl-C or Ctrl-D closes it,
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
    throw new Error('jf edit abandonné : aucun choix.');
  }
  const item = itemList[Number(answer) - 1];
  if (item === undefined) {
    throw new Error(`Choix invalide : ${answer}. Relancer jf edit.`);
  }
  return item;
}

async function chooseReference(actions: Actions, terminal: Terminal): Promise<string> {
  const candidat = await choose(terminal, {
    question: 'Candidat',
    itemList: await actions.listCandidats(),
    label: ({ name }) => name,
    emptyMessage: 'Aucun Candidat : les déclarer dans data/config.json.',
  });
  const offre = await choose(terminal, {
    question: 'Offre à modifier',
    itemList: await actions.listOffres({ candidatId: candidat.id }),
    label: formatOffre,
    emptyMessage: `Aucune Offre pour ${candidat.name} : « jf detect » cherche les nouvelles Offres.`,
  });
  return offre.reference;
}

// The Offre then the Artefact, unless given, from a list: the Candidat has no reference to
// remember (spec « Claude Code interactif »)
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

function changeStatusCommand(status: 'postulee' | 'archivee', description: string): ICommand {
  const name = status === 'postulee' ? 'postuler' : 'archiver';
  return {
    description: `${description} : jf ${name} <offre>`,
    run: async (actions, [reference]) => {
      if (reference === undefined) {
        throw new Error(`Usage : jf ${name} <offre>. « jf list <candidat> » liste les Offres.`);
      }
      await actions.changeStatus({ reference, status });
      process.stdout.write(`${reference} : ${STATUT_LABEL_BY_STATUS[status]}\n`);
    },
  };
}

// The CLI only relays to the actions: no business rule here (ADR-0003)
const COMMAND_BY_NAME: Record<string, ICommand> = {
  candidats: {
    description: 'Liste les Candidats déclarés dans data/config.json',
    run: async (actions) => {
      const candidatList = await actions.listCandidats();
      for (const candidat of candidatList) {
        process.stdout.write(`${candidat.id}\t${candidat.name}\n`);
      }
    },
  },
  detect: {
    description: 'Cherche les nouvelles Offres de chaque Veille',
    run: async (actions) => {
      const detectionList = await actions.detect();
      for (const detection of detectionList) {
        const { veilleId, candidatId, isFirstLaunch, newOffreList, nearMissList } = detection;
        const summary =
          newOffreList.length === 0 ? 'aucune nouvelle Offre' : `${String(newOffreList.length)} nouvelles Offres`;
        const firstLaunch = isFirstLaunch ? ', premier lancement : importées sans rien déclencher' : '';
        process.stdout.write(`Veille ${veilleId} (${candidatId}) : ${summary}${firstLaunch}\n`);
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
    },
  },
  list: {
    description: "Liste les Offres d'un Candidat : jf list <candidat>",
    run: async (actions, [candidatId]) => {
      if (candidatId === undefined) {
        throw new Error('Usage : jf list <candidat>. « jf candidats » liste les Candidats.');
      }
      const offreList = await actions.listOffres({ candidatId });
      for (const offre of offreList) {
        process.stdout.write(`${formatOffre(offre)}\n`);
      }
    },
  },
  run: {
    description:
      "Met en file une nouvelle Version d'un Artefact, que le worker produit avec Claude Code ; --wait attend la fin : jf run recherche|lettre|fiche <offre> [--wait]",
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
      for (const { number, state, isRetenue, createdAt } of versionList) {
        const columnList = [`v${String(number)}`, VERSION_STATE_LABEL_BY_STATE[state], isRetenue ? 'retenue' : '—'];
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
  postuler: changeStatusCommand('postulee', 'Passe une Offre en Postulée, avec ou sans Lettre, et fige sa Lettre'),
  archiver: changeStatusCommand('archivee', 'Passe une Offre en Archivée'),
  profil: {
    description: "Complète le Profil d'un Candidat avec Claude Code : jf profil <candidat>",
    run: async (actions, [candidatId]) => {
      if (candidatId === undefined) {
        throw new Error('Usage : jf profil <candidat>. « jf candidats » liste les Candidats.');
      }
      await actions.openProfil({ candidatId });
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
  await command.run(await createActions({ dataDirectory: DATA_DIRECTORY }), argumentList, {
    isWaiting: values.wait === true,
  });
}

try {
  await run();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
