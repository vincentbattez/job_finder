import { index, route, type RouteConfig } from '@react-router/dev/routes';

import { REDIRECT_LIST } from './redirects.ts';

export default [
  index('routes/postings.tsx'),
  route('postings/:reference', 'routes/posting.tsx'),
  route('postings/:reference/status', 'routes/status.ts'),
  route('postings/:reference/archive', 'routes/archive.ts'),
  route('postings/:reference/notes', 'routes/notes.ts'),
  route('postings/:reference/:artifact/document', 'routes/document.ts'),
  route('postings/:reference/:artifact/chosen', 'routes/chosen-version.ts'),
  route('postings/:reference/visualization/:number', 'routes/visualization.ts'),
  route('candidate', 'routes/candidate.ts'),
  route('locale', 'routes/locale.ts'),
  route('profile', 'routes/profile.tsx'),
  route('notification-channel', 'routes/notification-channel.ts'),
  route('watch', 'routes/watch.ts'),
  route('candidates', 'routes/candidates.tsx'),
  route('instructions', 'routes/instructions.tsx'),
  route('run', 'routes/run.ts'),
  route('detect', 'routes/detect.ts'),
  route('import', 'routes/import.ts'),
  route('design', 'routes/design.tsx'),
  ...REDIRECT_LIST.map(({ from }) => route(from, 'routes/redirect.ts', { id: `redirect/${from}` })),
] satisfies RouteConfig;
