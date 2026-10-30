import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT_DIRECTORY = path.join(import.meta.dirname, '..');
const CSPELL_CLI_PATH = path.join(ROOT_DIRECTORY, 'node_modules', 'cspell', 'bin.mjs');

// The two passes of scripts/spellcheck.sh: everything in English, then the French copy alone
const PASS_OPTION_LIST = [[], ['--config', 'cspell.fr.config.yaml', '--no-config-search']];

// The spellcheck of the pre-commit hook and of CI, on a file that would sit at filePath: whether it
// passes both passes
function isSpelledRight(filePath: string, content: string): boolean {
  return PASS_OPTION_LIST.every((optionList) => {
    const { status } = spawnSync(
      process.execPath,
      [
        CSPELL_CLI_PATH,
        'lint',
        ...optionList,
        '--no-progress',
        '--no-summary',
        '--no-must-find-files',
        `stdin://${filePath}`,
      ],
      { cwd: ROOT_DIRECTORY, input: content, encoding: 'utf8' },
    );
    return status === 0;
  });
}

// A file of the French catalogue holding a single label
function frenchCatalogue(label: string): string {
  return `export const FIXTURE_FR = { saveLetter: '${label}' };\n`;
}

// A module's copy file, as src/modules/*/copy.ts writes it
function moduleCopy({ name = 'COPY_FR', comment = 'What the module tells', label = 'Le site est injoignable.' }) {
  return `// ${comment}\nconst ${name} = { unreachable: '${label}' };\n`;
}

// The command a configuration file runs, as written there
function commandOf(filePath: string, pattern: RegExp): string {
  const command = pattern.exec(readFileSync(path.join(ROOT_DIRECTORY, filePath), 'utf8'))?.[1];
  if (command === undefined) {
    throw new Error(`No spellcheck command in ${filePath}`);
  }
  return command;
}

const WIRING_LIST = [
  {
    name: 'the pre-commit hook',
    command: commandOf('lefthook.yml', /- name: spelling\n\s+run: (.+)/),
  },
  {
    name: 'mise run lint:spelling',
    command: commandOf('mise.toml', /\[tasks\."lint:spelling"\]\n(?:.+\n)*?run = "(.+)"/),
  },
];

// Each run of the hook or of CI starts cspell cold, twice: seconds on the 2-vCPU GitHub runner
const WIRING_TIMEOUT = 60_000;

// A copy of the repo's spellcheck, its script and configs only, around the staged files: the command
// of the hook or of CI runs there as it runs in the repo, and resolves to its exit code
function runInSandbox(command: string, stagedFileList: Record<string, string>): Promise<number | null> {
  const sandboxDirectory = mkdtempSync(path.join(tmpdir(), 'job-finder-spellcheck-'));
  for (const filePath of ['scripts/spellcheck.sh', 'cspell.config.yaml', 'cspell.fr.config.yaml', 'cspell-words.txt']) {
    mkdirSync(path.dirname(path.join(sandboxDirectory, filePath)), { recursive: true });
    copyFileSync(path.join(ROOT_DIRECTORY, filePath), path.join(sandboxDirectory, filePath));
  }
  symlinkSync(path.join(ROOT_DIRECTORY, 'node_modules'), path.join(sandboxDirectory, 'node_modules'));
  for (const [stagedFile, content] of Object.entries(stagedFileList)) {
    mkdirSync(path.dirname(path.join(sandboxDirectory, stagedFile)), { recursive: true });
    writeFileSync(path.join(sandboxDirectory, stagedFile), content);
  }
  const stagedFiles = Object.keys(stagedFileList).join(' ');
  return new Promise((resolve, reject) => {
    spawn('/bin/sh', ['-c', command.replace('{staged_files}', () => stagedFiles)], {
      cwd: sandboxDirectory,
      stdio: 'ignore',
    })
      .on('error', reject)
      .on('close', resolve);
  });
}

describe('spellcheck', () => {
  it('lets pass English code', () => {
    expect(isSpelledRight('src/actions/fixture.ts', 'export const candidateList = []; // The Candidates\n')).toBe(true);
  });

  it('catches a French identifier, comment or inline string', () => {
    expect(isSpelledRight('src/actions/fixture.ts', 'export const listeCandidats = [];\n')).toBe(false);
    expect(isSpelledRight('src/actions/fixture.ts', '// Les offres du candidat\nexport const x = 1;\n')).toBe(false);
    expect(isSpelledRight('src/web/fixture.tsx', "export const label = 'Enregistrer la lettre';\n")).toBe(false);
  });

  it('checks the French catalogue with the French dictionary', () => {
    expect(isSpelledRight('src/domain/catalogue/fr/fixture.ts', frenchCatalogue('Enregistrer la lettre'))).toBe(true);
    expect(isSpelledRight('src/domain/catalogue/fr/fixture.ts', frenchCatalogue('Enregistrr la lettre'))).toBe(false);
  });

  it("checks the French of a module's copy file with the French dictionary, in its strings only", () => {
    expect(isSpelledRight('src/modules/pep/copy.ts', moduleCopy({}))).toBe(true);
    expect(isSpelledRight('src/modules/pep/copy.ts', moduleCopy({ label: 'Le site est injoignabl.' }))).toBe(false);
    expect(isSpelledRight('src/modules/pep/copy.ts', moduleCopy({ name: 'listeMessages' }))).toBe(false);
    expect(isSpelledRight('src/modules/pep/copy.ts', moduleCopy({ comment: 'Les offres du candidat' }))).toBe(false);
  });

  it('keeps the French of a module in its copy file, its Parameter labels included', () => {
    expect(isSpelledRight('src/modules/pep/copy.ts', moduleCopy({ label: 'Titre recherché' }))).toBe(true);
    expect(isSpelledRight('src/modules/pep/copy.ts', moduleCopy({ label: 'Titre recherchéé' }))).toBe(false);
    const inlineLabel = "export const TITLE = { label: { fr: 'Enregistrer la lettre', en: 'Save the Letter' } };\n";
    expect(isSpelledRight('src/modules/pep/index.ts', inlineLabel)).toBe(false);
  });

  it('lets the redirects match a former French name, never use one elsewhere', () => {
    const redirect = "export const LIST = [{ from: 'candidat', to: 'candidate' }];\n";
    expect(isSpelledRight('src/web/redirects.ts', redirect)).toBe(true);
    expect(isSpelledRight('src/web/redirects.ts', "export const LIST = [{ to: 'candidat' }];\n")).toBe(false);
    expect(isSpelledRight('src/web/redirects.ts', `// Les anciennes routes\n${redirect}`)).toBe(false);
    expect(isSpelledRight('src/web/routes/fixture.ts', redirect)).toBe(false);
  });

  it('lets a test drive the French locale in its literals, never in its names or comments', () => {
    const assertion = "await expect(page.getByRole('button', { name: /^Enregistrer la lettre/ })).toBeVisible();\n";
    expect(isSpelledRight('e2e/fixture.test.ts', `it('saves the Letter', async () => {\n${assertion}});\n`)).toBe(true);
    expect(isSpelledRight('e2e/fixture.test.ts', `it('enregistre la lettre', async () => {\n${assertion}});\n`)).toBe(
      false,
    );
    expect(isSpelledRight('e2e/fixture.test.ts', '// Enregistre la lettre\nexport const x = 1;\n')).toBe(false);
  });

  it('leaves out the recorded fixtures and the migration history', () => {
    expect(isSpelledRight('test/fixtures/pep/fixture.html', '<p>Les offres du candidat</p>\n')).toBe(true);
    expect(isSpelledRight('prisma/migrations/0_fixture/migration.sql', '-- Les offres du candidat\n')).toBe(true);
  });

  // Both English files share one run; each failure needs its own, as the script stops at the first
  // failing pass. The three runs go side by side
  it.each(WIRING_LIST)(
    'runs both passes in $name',
    async ({ command }) => {
      const [englishStatus, frenchIdentifierStatus, misspelledLabelStatus] = await Promise.all([
        runInSandbox(command, {
          'src/actions/fixture.ts': 'export const candidateList = [];\n',
          'src/modules/pep/copy.ts': moduleCopy({}),
        }),
        runInSandbox(command, { 'src/actions/fixture.ts': 'export const listeCandidats = [];\n' }),
        runInSandbox(command, { 'src/modules/pep/copy.ts': moduleCopy({ label: 'Le site est injoignabl.' }) }),
      ]);
      expect(englishStatus).toBe(0);
      expect(frenchIdentifierStatus).not.toBe(0);
      expect(misspelledLabelStatus).not.toBe(0);
    },
    WIRING_TIMEOUT,
  );
});
