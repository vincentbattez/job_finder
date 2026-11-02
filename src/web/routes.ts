import { index, route, type RouteConfig } from '@react-router/dev/routes';

import { REDIRECT_LIST } from './redirects.ts';

export default [
  index('routes/new.tsx'),
  route('applications', 'routes/applications.tsx'),
  route('to-apply', 'routes/to-apply.tsx'),
  route('postings', 'routes/postings.tsx'),
  route('postings/:reference', 'routes/posting.tsx'),
  route('postings/:reference/status', 'routes/status.ts'),
  route('postings/:reference/archive', 'routes/archive.ts'),
  route('postings/:reference/keep', 'routes/keep.ts'),
  route('postings/:reference/notes', 'routes/notes.ts'),
  route('postings/:reference/interviews', 'routes/interviews.ts'),
  route('postings/:reference/interviews/:number/ical', 'routes/ical.ts'),
  route('postings/:reference/:artifact/document', 'routes/document.ts'),
  route('postings/:reference/:artifact/validate', 'routes/validate.ts'),
  route('candidate', 'routes/candidate.ts'),
  route('locale', 'routes/locale.ts'),
  route('profile', 'routes/profile.tsx'),
  route('notification-channel', 'routes/notification-channel.ts'),
  route('watch', 'routes/watch.ts'),
  route('settings', 'routes/settings.tsx'),
  route('instructions', 'routes/instructions.tsx'),
  route('run', 'routes/run.ts'),
  route('detect', 'routes/detect.ts'),
  route('import', 'routes/import.ts'),
  ...REDIRECT_LIST.map(({ from }) => route(from, 'routes/redirect.ts', { id: `redirect/${from}` })),
] satisfies RouteConfig;
