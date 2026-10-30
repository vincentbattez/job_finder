import type { Config } from 'stylelint';

export default {
  extends: ['stylelint-config-standard'],
  ignoreFiles: [
    // Setting ignoreFiles drops Stylelint's own default
    'node_modules/**',
    // The last shared classes waiting for a home: #86 deletes the file
    'src/web/legacy-components.css',
    // Each git worktree that Claude Code creates there lints itself
    '.claude/worktrees/**',
    'build/**',
    'playwright-report/**',
    'test-results/**',
  ],
  rules: {
    // The Hallmark stamp is a run of comments at the head of app.css, which sloplint reads as is
    'comment-empty-line-before': [
      'always',
      { except: ['first-nested'], ignore: ['stylelint-commands', 'after-comment'] },
    ],
    // Kebab-case BEM: block, block__element, block--modifier
    'selector-class-pattern': [
      '^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:__[a-z0-9]+(?:-[a-z0-9]+)*)?(?:--[a-z0-9]+(?:-[a-z0-9]+)*)?$',
      { message: (selector: string) => `Expected class selector "${selector}" to be kebab-case BEM` },
    ],
    // Every color comes from a token (tokens.css, exempt below): no hex, no named color, no color
    // function, except a relative color or color-mix() over a token
    'color-no-hex': true,
    'color-named': 'never',
    'declaration-property-value-disallowed-list': [
      { '/.*/': [String.raw`/\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\((?!\s*from\s+var\()/i`] },
      { message: (property: string) => `Expected a color token instead of a color function in "${property}"` },
    ],
    // Flat BEM, as tight as the real CSS allows: no ID, three compound selectors, specificity 0,3,1
    'selector-max-id': 0,
    'selector-max-compound-selectors': 3,
    'selector-max-specificity': '0,3,1',
    // Layers settle conflicts, not force
    'declaration-no-important': true,
    'no-duplicate-selectors': true,
    'declaration-block-no-duplicate-properties': true,
    'no-descending-specificity': true,
  },
  overrides: [
    {
      files: ['src/web/tokens.css'],
      rules: { 'color-no-hex': null, 'color-named': null, 'declaration-property-value-disallowed-list': null },
    },
    {
      // The reduced-motion reset and [hidden] must beat every layer
      files: ['src/web/base.css', 'src/web/utilities.css'],
      rules: { 'declaration-no-important': null },
    },
  ],
} satisfies Config;
