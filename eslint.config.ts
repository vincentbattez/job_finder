import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import sonarjs from 'eslint-plugin-sonarjs';
import unicorn from 'eslint-plugin-unicorn';
import unusedImports from 'eslint-plugin-unused-imports';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: [
      'data/',
      'dev-data/',
      'src/workspace/generated/',
      'playwright-report/',
      'test-results/',
      '.react-router/',
      'build/',
      // Each git worktree that Claude Code creates there lints itself
      '.claude/worktrees/',
    ],
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  unicorn.configs.recommended,
  sonarjs.configs.recommended,
  {
    linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: 'error' },
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    plugins: { 'unused-imports': unusedImports },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      // A domain value is only obtained by parsing it, never asserted (ADR-0005)
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      // SQLite and JSON both use null for a missing value
      'unicorn/no-null': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': 'error',
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['../*'], message: 'Import through the #/ alias instead of a parent folder.' }] },
      ],
      'no-restricted-exports': [
        'error',
        {
          restrictDefaultExports: {
            direct: true,
            named: true,
            defaultFrom: true,
            namedFrom: true,
            namespaceFrom: true,
          },
        },
      ],
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'default', format: ['camelCase'] },
        { selector: 'import', format: ['camelCase', 'PascalCase'] },
        // React tells a component from an HTML tag by its capital letter
        { selector: 'function', format: ['camelCase', 'PascalCase'] },
        { selector: 'variable', format: ['camelCase', 'UPPER_CASE'] },
        {
          selector: 'variable',
          types: ['boolean'],
          format: ['PascalCase'],
          prefix: ['is', 'has', 'should', 'can', 'did', 'will', 'must'],
        },
        {
          selector: ['variable', 'parameter'],
          types: ['array'],
          format: ['camelCase', 'UPPER_CASE'],
          suffix: ['List', '_LIST'],
        },
        { selector: 'typeLike', format: ['PascalCase'] },
        { selector: 'interface', format: ['PascalCase'], prefix: ['I'] },
        // Augmenting a library's interface keeps its name: Vitest's, which types inject()
        { selector: 'interface', filter: { regex: '^ProvidedContext$', match: true }, format: ['PascalCase'] },
        { selector: 'objectLiteralProperty', format: null },
      ],
    },
  },
  {
    // Tools load their config through a default export
    files: ['*.config.ts'],
    rules: { 'no-restricted-exports': 'off' },
  },
  {
    // Claude Code is installed by the user, not by the repo, so its launcher finds it on the PATH
    files: ['src/ai-session/acl/claude-code.ts'],
    rules: { 'sonarjs/no-os-command-from-path': 'off' },
  },
  {
    // Over plain http on the LAN (ADR-0002) the Clipboard API is withheld: copying goes through the
    // deprecated execCommand, which every browser still runs
    files: ['src/web/components/copy-command.tsx'],
    rules: { 'sonarjs/deprecation': 'off', '@typescript-eslint/no-deprecated': 'off' },
  },
  {
    // The example address of a Home Assistant is one on the LAN, which serves plain http by default
    // (ADR-0002); no request goes to it
    files: ['src/modules/notification-home-assistant/index.ts'],
    rules: { 'sonarjs/no-clear-text-protocols': 'off' },
  },
  {
    // A field typed into shows an example of what goes in it, so the Candidate knows what to write. A
    // select is left out: its first option is a choice of its own, such as « Toutes », or a hint.
    files: ['src/web/**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXOpeningElement[name.name='textarea']:not(:has(JSXAttribute[name.name='placeholder']))",
          message: 'Give this textarea a placeholder: an example of what to write in it.',
        },
        {
          selector:
            "JSXOpeningElement[name.name='input']:not(:has(JSXAttribute[name.name='type'][value.value=/^(hidden|file|checkbox|radio|submit|button|reset|range|color|image)$/])):not(:has(JSXAttribute[name.name='placeholder']))",
          message: 'Give this field a placeholder: an example of what to type in it.',
        },
      ],
    },
  },
  {
    // React Router loads the route config and each route module through a default export
    files: ['src/web/root.tsx', 'src/web/routes.ts', 'src/web/routes/*.{ts,tsx}'],
    rules: { 'no-restricted-exports': 'off' },
  },
  prettier,
);
