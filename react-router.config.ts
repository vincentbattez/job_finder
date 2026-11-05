import type { Config } from '@react-router/dev/config';

// The front lives in src/ with the rest of the application, where the architecture test looks
// (ADR-0005). Only the e2e tests build it (playwright.config.ts): this folder puts the server bundle
// as deep as src/workspace/acl/, whose database.ts finds the repo's root by climbing three folders.
export default { appDirectory: 'src/web', buildDirectory: 'build/e2e' } satisfies Config;
