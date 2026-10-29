import path from 'node:path';
import { parseArgs } from 'node:util';

import { createActions, type Actions } from '#/actions/index.ts';

const DATA_DIRECTORY = path.join(import.meta.dirname, '..', '..', 'data');

// Through the actions only: the CLI never reaches the domain directly (ADR-0003)
type Offre = Awaited<ReturnType<Actions['listOffres']>>[number];

interface ICommand {
  description: string;
  run: (actions: Actions, argumentList: string[]) => Promise<void>;
}

const STATUT_LABEL_BY_STATUS: Record<Offre['status'], string> = {
  a_traiter: 'À traiter',
  postulee: 'Postulée',
  archivee: 'Archivée',
};

function formatOffre(offre: Offre): string {
  return [
    offre.reference,
    offre.title,
    offre.workplace ?? '—',
    offre.dateLimite?.toLocaleDateString('fr-FR', { timeZone: 'UTC' }) ?? '—',
    STATUT_LABEL_BY_STATUS[offre.status],
    offre.isInZone ? 'Zone' : 'hors Zone',
  ].join('\t');
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
  profil: {
    description: "Complète le Profil d'un Candidat avec Claude Code : jf profil <candidat>",
    run: async (actions, [candidatId]) => {
      if (candidatId === undefined) {
        throw new Error('Usage : jf profil <candidat>. « jf candidats » liste les Candidats.');
      }
      await actions.openProfil({ candidatId });
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
    options: { help: { type: 'boolean', short: 'h' } },
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
  await command.run(await createActions({ dataDirectory: DATA_DIRECTORY }), argumentList);
}

try {
  await run();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
