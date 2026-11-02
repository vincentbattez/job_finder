import { index, layout, route, type RouteConfig } from '@react-router/dev/routes';

import { REDIRECT_LIST } from './redirects.ts';

export default [
  index('routes/home.tsx'),
  route('applications', 'routes/applications.tsx'),
  route('postings', 'routes/postings.tsx'),
  route('postings/:reference', 'routes/posting.tsx'),
  route('postings/:reference/status', 'routes/status.ts'),
  route('postings/:reference/archive', 'routes/archive.ts'),
  route('postings/:reference/notes', 'routes/notes.ts'),
  route('postings/:reference/interviews', 'routes/interviews.ts'),
  route('postings/:reference/interviews/:number/ical', 'routes/ical.ts'),
  route('postings/:reference/:artifact/document', 'routes/document.ts'),
  route('postings/:reference/:artifact/chosen', 'routes/chosen-version.ts'),
  route('postings/:reference/interviews/:interview/visualization/:number', 'routes/visualization.ts'),
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
  // PROTOTYPE (branch prototype/v1-ux, never merged): the V1 front on the snapshot in data/, read-only
  route('prototype', 'prototype/layout.tsx', [
    index('prototype/index.tsx'),
    layout('prototype/shell.tsx', [
      route('new', 'prototype/lists.tsx', { id: 'prototype/new' }),
      route('to-apply', 'prototype/lists.tsx', { id: 'prototype/to-apply' }),
      route('applications', 'prototype/lists.tsx', { id: 'prototype/applications' }),
      route('postings/:reference', 'prototype/posting.tsx'),
      route('profile', 'prototype/placeholder.tsx', { id: 'prototype/profile' }),
      route('watches', 'prototype/placeholder.tsx', { id: 'prototype/watches' }),
      route('settings', 'prototype/placeholder.tsx', { id: 'prototype/settings' }),
      // The generation panel alone, on a Posting, while the Posting page is being built
      route('generation-demo/:reference', 'prototype/generation/demo.tsx'),
    ]),
    // Full screen, out of the Sidebar
    route('postings/:reference/interviews/:number/revision', 'prototype/revision.tsx'),
  ]),
  ...REDIRECT_LIST.map(({ from }) => route(from, 'routes/redirect.ts', { id: `redirect/${from}` })),
] satisfies RouteConfig;
