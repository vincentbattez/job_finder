import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

const ROOT_DIRECTORY = path.join(import.meta.dirname, '..');
const CSPELL_CLI_PATH = path.join(ROOT_DIRECTORY, 'node_modules', 'cspell', 'bin.mjs');

// The two passes of scripts/spellcheck.sh: everything in English, then the French copy alone
const PASS_OPTION_LIST = [[], ['--config', 'cspell.fr.config.yaml', '--no-config-search']];

// A file of the French catalogue holding a single label
function frenchCatalogue(label: string): string {
  return `export const FIXTURE_FR = { saveLetter: '${label}' };\n`;
}

// A module's copy file, as src/modules/*/copy.ts writes it
function moduleCopy({ name = 'COPY_FR', comment = 'What the module tells', label = 'Le site est injoignable.' }) {
  return `// ${comment}\nconst ${name} = { unreachable: '${label}' };\n`;
}

const redirect = "export const LIST = [{ from: 'candidat', to: 'candidate' }];\n";
const inlineLabel = "export const TITLE = { label: { fr: 'Enregistrer la lettre', en: 'Save the Letter' } };\n";
const assertion = "await expect(page.getByRole('button', { name: /^Enregistrer la lettre/ })).toBeVisible();\n";

// Every case at its own path of one sandbox, so that each pass of the CLI runs once for all of them.
// A path keeps the cspell override of the file its case stands for: under another override the case
// would silently weaken (cspell.config.yaml, cspell.fr.config.yaml)
const FILE_BY_PATH: Record<string, string> = {
  // No override: English only
  'src/actions/english.ts': 'export const candidateList = []; // The Candidates\n',
  'src/actions/french-identifier.ts': 'export const listeCandidats = [];\n',
  'src/actions/french-comment.ts': '// Les offres du candidat\nexport const x = 1;\n',
  'src/web/french-string.tsx': "export const label = 'Enregistrer la lettre';\n",
  'src/modules/inline-label/index.ts': inlineLabel,
  'src/web/routes/redirect-elsewhere.ts': redirect,
  // The French catalogue
  'src/domain/catalogue/fr/right.ts': frenchCatalogue('Enregistrer la lettre'),
  'src/domain/catalogue/fr/misspelled.ts': frenchCatalogue('Enregistrr la lettre'),
  // The copy file of a module
  'src/modules/right/copy.ts': moduleCopy({}),
  'src/modules/misspelled-label/copy.ts': moduleCopy({ label: 'Le site est injoignabl.' }),
  'src/modules/french-identifier/copy.ts': moduleCopy({ name: 'listeMessages' }),
  'src/modules/french-comment/copy.ts': moduleCopy({ comment: 'Les offres du candidat' }),
  'src/modules/accented-label/copy.ts': moduleCopy({ label: 'Titre recherché' }),
  'src/modules/misspelled-accented-label/copy.ts': moduleCopy({ label: 'Titre recherchéé' }),
  // The files that match a former French name
  'src/web/redirects.ts': redirect,
  'src/workspace/layout.ts': "export const LIST = [{ to: 'candidat' }];\n",
  'src/domain/artifact-rename.ts': `// Les anciennes routes\n${redirect}`,
  // The tests
  'e2e/french-literal.test.ts': `it('saves the Letter', async () => {\n${assertion}});\n`,
  'e2e/french-test-name.test.ts': `it('enregistre la lettre', async () => {\n${assertion}});\n`,
  'e2e/french-comment.test.ts': '// Enregistre la lettre\nexport const x = 1;\n',
  // The paths left out
  'test/fixtures/pep/fixture.html': '<p>Les offres du candidat</p>\n',
  'prisma/migrations/0_fixture/migration.sql': '-- Les offres du candidat\n',
};

// A copy of the repo's spellcheck, its script and configs only, around the given files
function makeSandbox(fileList: Record<string, string>): string {
  const sandboxDirectory = mkdtempSync(path.join(tmpdir(), 'job-finder-spellcheck-'));
  for (const filePath of ['scripts/spellcheck.sh', 'cspell.config.yaml', 'cspell.fr.config.yaml', 'cspell-words.txt']) {
    mkdirSync(path.dirname(path.join(sandboxDirectory, filePath)), { recursive: true });
    copyFileSync(path.join(ROOT_DIRECTORY, filePath), path.join(sandboxDirectory, filePath));
  }
  symlinkSync(path.join(ROOT_DIRECTORY, 'node_modules'), path.join(sandboxDirectory, 'node_modules'));
  for (const [filePath, content] of Object.entries(fileList)) {
    mkdirSync(path.dirname(path.join(sandboxDirectory, filePath)), { recursive: true });
    writeFileSync(path.join(sandboxDirectory, filePath), content);
  }
  return sandboxDirectory;
}

// Each pass starts cspell cold: seconds on the 2-vCPU GitHub runner
const SPELLCHECK_TIMEOUT = 60_000;

// The files of FILE_BY_PATH that fail one of the passes, as the `path:line:col - Unknown word` lines
// of the CLI name them
const failingPathSet = new Set<string>();

// The spellcheck of the pre-commit hook and of CI, on the file at filePath: whether it passes both passes
function isSpelledRight(filePath: keyof typeof FILE_BY_PATH): boolean {
  return !failingPathSet.has(filePath);
}

beforeAll(() => {
  const sandboxDirectory = makeSandbox(FILE_BY_PATH);
  for (const optionList of PASS_OPTION_LIST) {
    const { stdout, error } = spawnSync(
      process.execPath,
      [
        CSPELL_CLI_PATH,
        'lint',
        ...optionList,
        '--no-progress',
        '--no-summary',
        '--no-must-find-files',
        '--dot',
        ...Object.keys(FILE_BY_PATH),
      ],
      { cwd: sandboxDirectory, encoding: 'utf8', timeout: SPELLCHECK_TIMEOUT },
    );
    if (error !== undefined) {
      throw error;
    }
    for (const line of stdout.split('\n')) {
      const filePath = /^(.+?):\d+:\d+ - Unknown word/.exec(line)?.[1];
      if (filePath !== undefined) {
        failingPathSet.add(filePath);
      }
    }
  }
}, SPELLCHECK_TIMEOUT);

describe('spellcheck', () => {
  it('lets pass English code', () => {
    expect(isSpelledRight('src/actions/english.ts')).toBe(true);
  });

  it('catches a French identifier, comment or inline string', () => {
    expect(isSpelledRight('src/actions/french-identifier.ts')).toBe(false);
    expect(isSpelledRight('src/actions/french-comment.ts')).toBe(false);
    expect(isSpelledRight('src/web/french-string.tsx')).toBe(false);
  });

  it('checks the French catalogue with the French dictionary', () => {
    expect(isSpelledRight('src/domain/catalogue/fr/right.ts')).toBe(true);
    expect(isSpelledRight('src/domain/catalogue/fr/misspelled.ts')).toBe(false);
  });

  it("checks the French of a module's copy file with the French dictionary, in its strings only", () => {
    expect(isSpelledRight('src/modules/right/copy.ts')).toBe(true);
    expect(isSpelledRight('src/modules/misspelled-label/copy.ts')).toBe(false);
    expect(isSpelledRight('src/modules/french-identifier/copy.ts')).toBe(false);
    expect(isSpelledRight('src/modules/french-comment/copy.ts')).toBe(false);
  });

  it('keeps the French of a module in its copy file, its Parameter labels included', () => {
    expect(isSpelledRight('src/modules/accented-label/copy.ts')).toBe(true);
    expect(isSpelledRight('src/modules/misspelled-accented-label/copy.ts')).toBe(false);
    expect(isSpelledRight('src/modules/inline-label/index.ts')).toBe(false);
  });

  it('lets the redirects match a former French name, never use one elsewhere', () => {
    expect(isSpelledRight('src/web/redirects.ts')).toBe(true);
    expect(isSpelledRight('src/workspace/layout.ts')).toBe(false);
    expect(isSpelledRight('src/domain/artifact-rename.ts')).toBe(false);
    expect(isSpelledRight('src/web/routes/redirect-elsewhere.ts')).toBe(false);
  });

  it('lets a test drive the French locale in its literals, never in its names or comments', () => {
    expect(isSpelledRight('e2e/french-literal.test.ts')).toBe(true);
    expect(isSpelledRight('e2e/french-test-name.test.ts')).toBe(false);
    expect(isSpelledRight('e2e/french-comment.test.ts')).toBe(false);
  });

  it('leaves out the recorded fixtures and the migration history', () => {
    expect(isSpelledRight('test/fixtures/pep/fixture.html')).toBe(true);
    expect(isSpelledRight('prisma/migrations/0_fixture/migration.sql')).toBe(true);
  });
});

// The command a configuration file runs, as written there
function commandOf(filePath: string, pattern: RegExp): string {
  const command = pattern.exec(readFileSync(path.join(ROOT_DIRECTORY, filePath), 'utf8'))?.[1];
  if (command === undefined) {
    throw new Error(`No spellcheck command in ${filePath}`);
  }
  return command;
}

const HOOK_COMMAND = commandOf('lefthook.yml', /- name: spelling\n\s+run: (.+)/);
const MISE_COMMAND = commandOf('mise.toml', /\[tasks\."lint:spelling"\]\n(?:.+\n)*?run = "(.+)"/);

// The command of the hook runs in a sandbox around the staged files, as it runs in the repo, and
// resolves to its exit code
function runInSandbox(stagedFileList: Record<string, string>): Promise<number | null> {
  const sandboxDirectory = makeSandbox(stagedFileList);
  const stagedFiles = Object.keys(stagedFileList).join(' ');
  return new Promise((resolve, reject) => {
    spawn('/bin/sh', ['-c', HOOK_COMMAND.replace('{staged_files}', () => stagedFiles)], {
      cwd: sandboxDirectory,
      stdio: 'ignore',
    })
      .on('error', reject)
      .on('close', resolve);
  });
}

describe('spellcheck wiring', { timeout: SPELLCHECK_TIMEOUT }, () => {
  // One script behind both, so that one run of it below stands for the two
  it('runs scripts/spellcheck.sh from the pre-commit hook and from mise run lint:spelling', () => {
    expect(HOOK_COMMAND).toBe('scripts/spellcheck.sh {staged_files}');
    expect(MISE_COMMAND).toBe('scripts/spellcheck.sh');
  });

  // Both English files share one run; each failure needs its own, as the script stops at the first
  // failing pass. The three runs go side by side
  it('runs both passes in scripts/spellcheck.sh', async () => {
    const [englishStatus, frenchIdentifierStatus, misspelledLabelStatus] = await Promise.all([
      runInSandbox({
        'src/actions/fixture.ts': 'export const candidateList = [];\n',
        'src/modules/pep/copy.ts': moduleCopy({}),
      }),
      runInSandbox({ 'src/actions/fixture.ts': 'export const listeCandidats = [];\n' }),
      runInSandbox({ 'src/modules/pep/copy.ts': moduleCopy({ label: 'Le site est injoignabl.' }) }),
    ]);
    expect(englishStatus).toBe(0);
    expect(frenchIdentifierStatus).not.toBe(0);
    expect(misspelledLabelStatus).not.toBe(0);
  });
});
