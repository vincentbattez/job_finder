import path from 'node:path';
import { parseArgs } from 'node:util';

import { createActions, type Actions } from '#/actions/index.ts';

const DATA_DIRECTORY = path.join(import.meta.dirname, '..', '..', 'data');

// Through the actions only: the CLI never reaches the domain directly (ADR-0003)
type Offre = Awaited<ReturnType<Actions['listOffres']>>[number];
type Version = Awaited<ReturnType<Actions['listVersions']>>[number];

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

function formatOffre(offre: Offre): string {
  return [
    offre.reference,
    offre.title,
    offre.workplace ?? '—',
    offre.dateLimite?.toLocaleDateString('fr-FR', { timeZone: 'UTC' }) ?? '—',
    offre.isExpiree ? `${STATUT_LABEL_BY_STATUS[offre.status]}, Expirée` : STATUT_LABEL_BY_STATUS[offre.status],
    offre.isInZone ? 'Zone' : 'hors Zone',
  ].join('\t');
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
      "Met en file une nouvelle Version d'un Artefact, que le worker produit avec Claude Code ; --wait attend la fin : jf run recherche <offre> [--wait]",
    run: async (actions, [module, reference], { isWaiting }) => {
      if (module === undefined || reference === undefined) {
        throw new Error('Usage : jf run <module> <offre> [--wait], par exemple jf run recherche 2026-2445600.');
      }
      const queuedJob = await actions.runModule({ module, reference });
      process.stdout.write(`${module} de l'Offre ${reference} en file (job ${String(queuedJob.id)}).\n`);
      if (!isWaiting) {
        process.stdout.write(`Le worker la produira. « jf versions ${reference} ${module} » suit ses Versions.\n`);
        return;
      }
      process.stdout.write('Attente du worker (service lpm worker) : Claude Code peut prendre plusieurs minutes…\n');
      const { state, version, log } = await actions.followJob({ jobId: queuedJob.id });
      const name = version === null ? module : `${module} v${String(version.number)}`;
      if (state === 'failed') {
        throw new Error(`${name} en échec :\n${log}\nRelancer : jf run ${module} ${reference}`);
      }
      process.stdout.write(`${name} prête et retenue. « jf versions ${reference} ${module} » liste ses Versions.\n`);
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
