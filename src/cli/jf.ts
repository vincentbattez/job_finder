import path from 'node:path';
import { parseArgs } from 'node:util';

import { createActions, type Actions } from '#/actions/index.ts';

const DATA_DIRECTORY = path.join(import.meta.dirname, '..', '..', 'data');

interface ICommand {
  description: string;
  run: (actions: Actions) => Promise<void>;
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
  const [commandName] = positionalList;
  if (commandName === undefined || commandName === 'help' || values.help === true) {
    process.stdout.write(HELP);
    return;
  }
  const command = COMMAND_BY_NAME[commandName];
  if (command === undefined) {
    throw new Error(`Commande inconnue : ${commandName}. « jf help » liste les commandes.`);
  }
  await command.run(await createActions({ dataDirectory: DATA_DIRECTORY }));
}

try {
  await run();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
