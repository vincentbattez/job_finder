import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const CSPELL_CLI_PATH = path.join(import.meta.dirname, '..', 'node_modules', 'cspell', 'bin.mjs');

// The spellcheck of the pre-commit hook and of CI (cspell.config.yaml), on a file that would sit at
// filePath: whether it passes
function isSpelledRight(filePath: string, content: string): boolean {
  const { status } = spawnSync(
    process.execPath,
    [CSPELL_CLI_PATH, 'lint', '--no-progress', '--no-summary', '--no-must-find-files', `stdin://${filePath}`],
    { cwd: path.join(import.meta.dirname, '..'), input: content, encoding: 'utf8' },
  );
  return status === 0;
}

// A file of the French catalogue holding a single label
function frenchCatalogue(label: string): string {
  return `export const FIXTURE_FR = { saveLetter: '${label}' };\n`;
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
});
