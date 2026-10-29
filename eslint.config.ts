import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import sonarjs from 'eslint-plugin-sonarjs';
import unicorn from 'eslint-plugin-unicorn';
import unusedImports from 'eslint-plugin-unused-imports';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['data/', 'dev-data/', 'src/workspace/generated/', 'playwright-report/', 'test-results/'] },
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
        { selector: 'objectLiteralProperty', format: null },
      ],
    },
  },
  {
    // Tools load their config through a default export
    files: ['*.config.ts'],
    rules: { 'no-restricted-exports': 'off' },
  },
  prettier,
);
