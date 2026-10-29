import type { Config } from '@react-router/dev/config';

// The front lives in src/ with the rest of the application, where the architecture test looks
// (ADR-0005)
export default { appDirectory: 'src/web' } satisfies Config;
